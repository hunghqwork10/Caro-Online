"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = exports.ioServer = void 0;
exports.setupGameSocket = setupGameSocket;
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Lưu phòng trong RAM; dữ liệu sẽ mất khi tiến trình server khởi động lại.
const rooms = new Map();
exports.ioServer = null;
// Giả lập Database người dùng
const USERS_DB = [];
const JWT_SECRET = "MA_BIM_MAT_CUA_RIENG_SERVER_123456"; // Khóa bí mật để ký token
function broadcastRoomList() {
    if (!exports.ioServer)
        return;
    const waitingRooms = [...rooms.values()]
        .filter((room) => room.status === 'waiting')
        .map((room) => ({
        id: room.id,
        hostId: room.hostId,
        playerCount: room.players.length,
        boardSize: room.boardSize,
        createdAt: room.createdAt,
        maxPlayers: room.maxPlayers,
    }));
    exports.ioServer.emit('room_list_updated', waitingRooms);
}
const router = (0, express_1.Router)();
exports.authRouter = (0, express_1.Router)();
// Đăng ký các sự kiện Socket.IO để đồng bộ phòng và nước đi giữa người chơi.
function setupGameSocket(io) {
    exports.ioServer = io;
    io.on('connection', (socket) => {
        // Người chơi tham gia vào phòng socket (để broadcast dễ hơn)
        socket.on('join_room', (roomId) => {
            void socket.join(roomId);
        });
        socket.on('leave_room', (roomId) => {
            void socket.leave(roomId);
        });
        // LẮNG NGHE SỰ KIỆN ĐÁNH CỜ
        socket.on('make_move', (data) => {
            const { roomId, userId, x, y } = data;
            const room = rooms.get(roomId);
            // 1. Kiểm tra phòng có tồn tại và đang chơi không
            if (!room || room.status !== 'playing') {
                socket.emit('move_error', { message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' });
                return;
            }
            // 2. Kiểm tra có đúng lượt của người này không
            if (room.currentTurn !== userId) {
                socket.emit('move_error', { message: 'Chưa tới lượt của bạn' });
                return;
            }
            // Tìm thông tin player hiện tại để lấy ký hiệu (X hay O)
            const player = room.players.find(p => p.id === userId);
            if (!player)
                return;
            // 3. Kiểm tra tọa độ hợp lệ và ô đó chưa bị đánh
            if (x < 0 || x >= room.boardSize || y < 0 || y >= room.boardSize || room.board[x][y] !== '') {
                socket.emit('move_error', { message: 'Nước đi không hợp lệ' });
                return;
            }
            // 4. Tiến hành cập nhật bàn cờ
            room.board[x][y] = player.symbol;
            // 5. Kiểm tra thắng thua (Thuật toán duyệt 5 quân liên tiếp)
            const isWin = checkWin(room.board, x, y, player.symbol, room.boardSize);
            if (isWin) {
                room.status = 'finished';
                room.winnerId = userId;
                // Thông báo trận đấu kết thúc và có người thắng
                io.to(roomId).emit('game_over', {
                    board: room.board,
                    winnerId: userId,
                    lastMove: { x, y }
                });
                io.to(roomId).emit('move_updated', { room });
                return;
            }
            // 6. Nếu chưa thắng, đổi lượt đi cho người chơi còn lại
            const nextPlayer = room.players.find(p => p.id !== userId);
            room.currentTurn = nextPlayer ? nextPlayer.id : userId;
            // 7. PHÁT SÓNG ĐỒNG BỘ ĐẾN CẢ PHÒNG
            io.to(roomId).emit('move_updated', { room });
        });
    });
}
// Kiểm tra nước đi mới nhất có tạo thành ít nhất 5 quân liên tiếp hay không.
function checkWin(board, r, c, symbol, size) {
    // 4 hướng di chuyển: [dòng, cột]
    const directions = [
        [0, 1], // Ngang
        [1, 0], // Dọc
        [1, 1], // Chéo xuống (phải)
        [-1, 1], // Chéo lên (phải)
    ];
    // Đếm quân cùng ký hiệu ở cả hai phía của nước vừa đánh.
    for (const [dr, dc] of directions) {
        let count = 1; // Tính chính quân vừa đánh
        // Đếm tiến về một phía
        let i = 1;
        while (r + dr * i >= 0 && r + dr * i < size && c + dc * i >= 0 && c + dc * i < size && board[r + dr * i][c + dc * i] === symbol) {
            count++;
            i++;
        }
        // Đếm lùi về phía ngược lại
        let j = 1;
        while (r - dr * j >= 0 && r - dr * j < size && c - dc * j >= 0 && c - dc * j < size && board[r - dr * j][c - dc * j] === symbol) {
            count++;
            j++;
        }
        // Nếu đủ 5 quân liên tiếp trở lên là thắng (luật Caro cơ bản)
        if (count >= 5)
            return true;
    }
    return false;
}
function handlePlayerLeave(roomId, userId, io) {
    const room = rooms.get(roomId);
    if (!room)
        return;
    // 1. Xóa người chơi rời đi ra khỏi mảng players
    room.players = room.players.filter(p => p.id !== userId);
    // 2. Nếu phòng không còn ai -> Xóa phòng khỏi Map để giải phóng RAM
    if (room.players.length === 0) {
        rooms.delete(roomId);
        return;
    }
    // 3. Nếu Host rời phòng -> Chuyển quyền Host cho người chơi duy nhất còn lại
    if (room.hostId === userId) {
        room.hostId = room.players[0].id;
    }
    // 4. RESET GAME STATE (Về trạng thái chờ và làm sạch bàn cờ)
    room.status = 'waiting';
    room.winnerId = null;
    // Khởi tạo lại mảng 2 chiều với các chuỗi rỗng '' dựa theo boardSize
    room.board = Array(room.boardSize).fill('').map(() => Array(room.boardSize).fill(''));
    // Đặt lượt đi mặc định cho người còn lại trong phòng (Host mới)
    room.currentTurn = room.hostId;
    // 5. PHÁT SÓNG ĐỒNG BỘ ĐẾN PHÒNG
    // Gửi sự kiện để người chơi còn lại cập nhật giao diện quay về màn hình chờ (waiting room)
    io.to(roomId).emit('room_reset', {
        message: 'Đối thủ đã rời phòng. Trận đấu được đặt lại về phòng chờ.',
        room: room // Gửi toàn bộ object room đã reset để Client đồng bộ lại
    });
}
/**
 * Endpoint POST /rooms/:roomId/moves
 */
router.post('/:roomId/moves', (req, res) => {
    const { roomId } = req.params;
    const { playerId, index } = req.body;
    // 1. Kiểm tra phòng tồn tại
    const room = rooms.get(roomId);
    if (!room) {
        return res.status(404).json({ message: 'Không tìm thấy phòng game' });
    }
    // 2. Validate: Phòng có đang chơi không?
    if (room.status !== 'playing') {
        return res.status(400).json({ message: 'Trận đấu chưa bắt đầu hoặc đã kết thúc' });
    }
    // 3. Validate: Người chơi có trong phòng này không?
    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
        return res.status(403).json({ message: 'Bạn không thuộc phòng đấu này' });
    }
    // 4. Validate: Kiểm tra index mảng 1 chiều gửi lên có hợp lệ không?
    const maxIndex = room.boardSize * room.boardSize;
    if (typeof index !== 'number' || index < 0 || index >= maxIndex) {
        return res.status(400).json({ message: 'Tọa độ nước đi không nằm trong bàn cờ' });
    }
    // Ánh xạ toán học: Đổi index 1 chiều thành tọa độ dòng (row) và cột (col) của mảng 2 chiều
    const row = Math.floor(index / room.boardSize);
    const col = index % room.boardSize;
    // 5. Validate: Ô cờ này đã có người đánh chưa?
    if (room.board[row][col] !== '') {
        return res.status(409).json({ message: 'Ô này đã có quân cờ' });
    }
    // 6. Validate: Kiểm tra xem có đúng lượt đi không? (Chống hack gửi request liên tục)
    if (room.currentTurn !== playerId) {
        return res.status(400).json({ message: 'Chưa tới lượt đi của bạn' });
    }
    // --- XỬ LÝ CẬP NHẬT TRẠNG THÁI TRẬN ĐẤU (SERVER-SIDE) ---
    // Đánh dấu ký hiệu (X hoặc O) lên bàn cờ
    room.board[row][col] = player.symbol;
    // 7. Chạy thuật toán kiểm tra thắng thua
    const isWin = checkWin(room.board, row, col, player.symbol, room.boardSize);
    if (isWin) {
        room.status = 'finished';
        room.winnerId = playerId;
    }
    else {
        // Kiểm tra điều kiện hòa (Bàn cờ không còn ô nào trống `''`)
        const isDraw = room.board.every((r) => r.every((cell) => cell !== ''));
        if (isDraw) {
            room.status = 'finished';
            room.winnerId = 'draw';
        }
        else {
            // Đổi lượt: Tìm người chơi còn lại trong mảng players để nhường lượt
            const nextPlayer = room.players.find((p) => p.id !== playerId);
            if (nextPlayer) {
                room.currentTurn = nextPlayer.id;
            }
        }
    }
    // 8. Đồng bộ Realtime (Tùy chọn): Nếu bạn gắn thực thể `io` vào app Express
    const io = req.app.get('io');
    if (io) {
        io.to(roomId).emit('move_updated', { room });
    }
    // 9. Trả lời kết quả phòng đấu mới nhất về cho Client vừa gọi API
    return res.status(200).json(room);
});
// ----- CÁC ROUTES API -----
// POST /rooms: xác thực dữ liệu và tạo phòng mới với người tạo làm host.
router.post('/', (req, res) => {
    const { name, boardSize = 15 } = req.body;
    if (!name || typeof name !== 'string') {
        res.status(400).json({ message: 'Tên người chơi là bắt buộc' });
        return;
    }
    if (!Number.isInteger(boardSize) || boardSize < 5 || boardSize > 30) {
        res.status(400).json({
            message: 'boardSize phải là số nguyên từ 5 đén 30',
        });
        return;
    }
    const playerId = (0, node_crypto_1.randomUUID)();
    const roomId = (0, node_crypto_1.randomUUID)().slice(0, 8);
    const room = {
        id: roomId,
        hostId: playerId,
        players: [
            {
                id: playerId,
                name: name.trim(),
                symbol: 'X',
            }
        ],
        status: 'waiting',
        boardSize,
        maxPlayers: 2,
        createdAt: Date.now(),
        // Tạo lưới rỗng; host mang X và được đi trước.
        board: Array.from({ length: boardSize }, () => Array(boardSize).fill('')),
        currentTurn: playerId,
    };
    rooms.set(roomId, room);
    broadcastRoomList();
    res.status(201).json({
        room,
        playerId,
    });
});
// API ĐĂNG KÝ (Tạo tài khoản)
exports.authRouter.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username?.trim() || !password) {
            res.status(400).json({ message: 'Tên tài khoản và mật khẩu là bắt buộc' });
            return;
        }
        if (USERS_DB.some((user) => user.username === username.trim())) {
            res.status(409).json({ message: 'Tên tài khoản đã tồn tại' });
            return;
        }
        const id = Date.now().toString();
        const normalizedUsername = username.trim();
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        USERS_DB.push({ id, username: normalizedUsername, passwordHash });
        const token = jsonwebtoken_1.default.sign({ userId: id, username: normalizedUsername }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({
            user: { id, username: normalizedUsername },
            token,
            message: 'Đăng ký thành công!',
        });
    }
    catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống" });
    }
});
// API ĐĂNG NHẬP
exports.authRouter.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({ message: 'Tên tài khoản và mật khẩu là bắt buộc' });
        return;
    }
    // 1. Tìm user trong DB
    const user = USERS_DB.find(u => u.username === username.trim());
    if (!user) {
        res.status(400).json({ message: "Tài khoản không tồn tại" });
        return;
    }
    // 2. Kiểm tra mật khẩu
    const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!isMatch) {
        res.status(400).json({ message: "Mật khẩu không chính xác" });
        return;
    }
    // 3. Tạo JWT Token (Hết hạn sau 1 ngày)
    const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    // 4. Trả dữ liệu về Frontend
    res.json({
        token,
        user: { id: user.id, username: user.username }
    });
});
// POST /rooms/quick-join: tham gia phòng chờ đầu tiên còn chỗ.
router.post('/quick-join', (req, res) => {
    const { name } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ message: 'Tên người chơi là bắt buộc' });
        return;
    }
    const availableRoom = [...rooms.values()].find((room) => room.status === 'waiting' && room.players.length < room.maxPlayers);
    if (!availableRoom) {
        res.status(404).json({ message: 'Hiện không có phòng trống' });
        return;
    }
    const playerId = (0, node_crypto_1.randomUUID)();
    availableRoom.players.push({
        id: playerId,
        name: name.trim(),
        symbol: 'O',
    });
    availableRoom.status = 'playing';
    exports.ioServer?.to(availableRoom.id).emit('game_start', availableRoom);
    exports.ioServer?.to(availableRoom.id).emit('move_updated', { room: availableRoom });
    broadcastRoomList();
    res.status(200).json({ room: availableRoom, playerId });
});
// GET /rooms: trả về danh sách rút gọn các phòng đang chờ người chơi.
router.get('/', (_req, res) => {
    // Chỉ liệt kê các phòng đang chờ và còn chỗ để người chơi có thể tham gia.
    const waitingRooms = [...rooms.values()]
        .filter((room) => room.status === 'waiting' && room.players.length < room.maxPlayers)
        .map((room) => ({
        id: room.id,
        hostId: room.hostId,
        hostName: room.players.find((player) => player.id === room.hostId)?.name ?? 'Host',
        playerCount: room.players.length,
        boardSize: room.boardSize,
        createdAt: room.createdAt,
        maxPlayers: room.maxPlayers,
    }));
    res.json(waitingRooms);
});
// GET /rooms/:roomId: lấy thông tin đầy đủ của một phòng theo ID.
router.get('/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
        res.status(404).json({ message: 'Không tìm thấy phòng' });
        return;
    }
    res.json(room);
});
// POST /rooms/:roomId/join: thêm người chơi thứ hai và bắt đầu trận.
router.post('/:roomId/join', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
        res.status(404).json({ message: 'Không tìm thấy phòng' });
        return;
    }
    if (room.status !== 'waiting' || room.players.length >= 2) {
        res.status(409).json({ message: 'Phòng đã đầy hoặc đã bắt đầu' });
        return;
    }
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
        res.status(400).json({ message: 'Tên người chơi là bắt buộc' });
        return;
    }
    const playerId = (0, node_crypto_1.randomUUID)();
    const player = {
        id: playerId,
        name: name.trim(),
        symbol: 'O',
    };
    // Người thứ hai vào phòng sẽ nhận O và chuyển trận sang trạng thái đang chơi.
    room.players.push(player);
    room.status = 'playing';
    exports.ioServer?.to(room.id).emit('game_start', room);
    exports.ioServer?.to(room.id).emit('move_updated', { room });
    broadcastRoomList();
    res.status(200).json({
        room,
        playerId,
    });
});
// DELETE /rooms/:roomId/players/:playerId: cho người chơi rời phòng.
router.delete('/:roomId/players/:playerId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
        res.status(404).json({ message: 'Không tìm thấy phòng' });
        return;
    }
    const playerIndex = room.players.findIndex((player) => player.id === req.params.playerId);
    if (playerIndex === -1) {
        res.status(404).json({ message: 'Không tìm thấy người chơi' });
        return;
    }
    room.players.splice(playerIndex, 1);
    // Xóa phòng khi trống; nếu còn người thì trả phòng về trạng thái chờ.
    if (room.players.length === 0) {
        rooms.delete(room.id);
    }
    else {
        room.status = 'waiting';
        room.hostId = room.players[0].id;
    }
    broadcastRoomList();
    res.status(204).send();
});
exports.default = router;
//# sourceMappingURL=rooms.js.map