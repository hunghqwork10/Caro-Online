"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_crypto_1 = require("node:crypto");
const rooms = new Map();
const router = (0, express_1.Router)();
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
        createdAt: Date.now(),
    };
    rooms.set(roomId, room);
    res.status(201).json({
        room,
        playerId,
    });
});
router.get('/', (_req, res) => {
    const waitingRooms = [...rooms.values()]
        .filter((room) => room.status === 'waiting')
        .map((room) => ({
        id: room.id,
        hostId: room.hostId,
        playerCount: room.players.length,
        boardSize: room.boardSize,
        createdAt: room.createdAt,
    }));
    res.json(waitingRooms);
});
router.get('/:roomId', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
        res.status(404).json({ message: 'Phòng không tồn tại' });
        return;
    }
    res.json(room);
});
//# sourceMappingURL=room.js.map