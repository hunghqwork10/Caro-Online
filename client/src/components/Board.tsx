import { useEffect, useState } from "react";
import Square from "./Square";
import { SquareValue } from "../types";
import { RoomData, sendMoveToServer, startRematch } from "../services/gameServices";
import { io } from 'socket.io-client';
import './Board.css';

interface BoardProps {
    readonly room: RoomData;
    readonly playerId: string;
    readonly onBackToMenu: () => void;
}

const socket = io("http://localhost:5000/", { autoConnect: false });

function getPlayerInitials(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return 'P';

    return trimmed
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'P';
}

function flattenBoard(board: string[][]): SquareValue[] {
    return board.flat().map((value) => value === '' ? null : value as SquareValue);
}

function subscribeToRoomChanges(
    roomId: string,
    callback: (updatedRoom: RoomData) => void,
) {
    const handleRoomUpdate = ({ room: updatedRoom }: { room: RoomData }) => {
        callback(updatedRoom);
    };

    socket.emit('join_room', roomId);
    socket.on('move_updated', handleRoomUpdate);

    return () => {
        socket.off('move_updated', handleRoomUpdate);
        socket.emit('leave_room', roomId);
    };
}

export default function Board({ room, playerId, onBackToMenu }: BoardProps) {
    const roomId = room.id;
    const [currentRoom, setCurrentRoom] = useState(room);
    const [squares, setSquares] = useState<SquareValue[]>(() => flattenBoard(room.board));
    const [winnerId, setWinnerId] = useState<string | null>(room.winnerId ?? null);
    const [currentTurnId, setCurrentTurnId] = useState<string>(room.currentTurn);
    const [players, setPlayers] = useState(room.players);
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        if (!roomId) return;

        socket.auth = { token: localStorage.getItem('token') };
        socket.connect();
        const unsubscribe = subscribeToRoomChanges(roomId, (updatedRoom) => {
            if (updatedRoom?.board) {
                // 1. Cập nhật mảng ô cờ cho BẢO CẢ 2 NGƯỜI
                setCurrentRoom(updatedRoom);
                setSquares(flattenBoard(updatedRoom.board));
                setPlayers(updatedRoom.players);

                // 2. Cập nhật lượt đi tiếp theo
                setCurrentTurnId(updatedRoom.currentTurn);
                setWinnerId(updatedRoom.winnerId ?? null);
            }
        });

        // Cleanup listener khi unmount component
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
            socket.disconnect();
        };
    }, [roomId]);

    const handleClick = async (index: number) => {
        // 1. CHỐNG CLICK BỪA Ở CLIENT (Tối ưu trải nghiệm)
        // Nếu ô đã được đánh hoặc game đã kết thúc, hoặc KHÔNG PHẢI lượt của mình thì chặn luôn không cho click
        if (squares[index] || currentRoom.status !== 'playing' || currentTurnId !== playerId) return;

        // 2. GỬI NƯỚC ĐI LÊN SERVER ĐỂ KIỂM TRA CHỐNG CHEAT
        // (Bóc tách index ngược lại thành row và col để truyền vào hàm service)
        const row = Math.floor(index / currentRoom.boardSize);
        const col = index % currentRoom.boardSize;

        const updatedRoom = await sendMoveToServer(roomId, row, col, currentRoom.boardSize);

        // 3. CẬP NHẬT GIAO DIỆN KHI SERVER ĐỒNG Ý
        if (updatedRoom) {
            // Vì Backend đang trả về mảng 2 chiều 'board', ta cần làm phẳng (flatten) nó
            // thành mảng 1 chiều 'squares' để khớp với State hiện tại
            setCurrentRoom(updatedRoom);
            setSquares(flattenBoard(updatedRoom.board));
            setPlayers(updatedRoom.players);
            setWinnerId(updatedRoom.winnerId ?? null);
            setCurrentTurnId(updatedRoom.currentTurn);
        }
    }

    const currentTurnName = players.find((player) => player.id === currentTurnId)?.name ?? currentTurnId;
    const leftPlayer = players[0] ?? null;
    const rightPlayer = players[1] ?? null;
    let statusMessage: string;
    if (currentRoom.status === 'closed') {
        statusMessage = winnerId
            ? `Phòng đã đóng; ${players.find((player) => player.id === winnerId)?.name ?? winnerId} thắng do đối thủ rời phòng`
            : 'Phòng đã đóng';
    } else if (winnerId === 'draw') {
        statusMessage = 'Hoà';
    } else if (winnerId) {
        statusMessage = `Người thắng: ${players.find((player) => player.id === winnerId)?.name ?? winnerId}`;
    } else if (currentRoom.status === 'waiting') {
        statusMessage = 'Đang chờ đối thủ tham gia';
    } else {
        statusMessage = `Lượt đi tiếp theo: ${currentTurnName}`;
    }

    const renderPlayerCard = (player: typeof players[number] | null, side: 'left' | 'right') => {
        if (!player) {
            return (
                <aside className={`board-player board-player-empty board-player-${side}`}>
                    <div className="player-avatar-fallback">?</div>
                    <div className="player-info">
                        <span className="player-symbol">–</span>
                        <strong>Đang chờ</strong>
                    </div>
                </aside>
            );
        }

        const displayName = player.displayName ?? player.name;
        const avatarText = getPlayerInitials(displayName);
        const isCurrentTurn = currentTurnId === player.id;

        return (
            <aside className={`board-player board-player-${side} ${isCurrentTurn ? 'is-turn' : ''}`}>
                <div className="player-avatar-wrap">
                    {player.avatarUrl ? (
                        <img
                            src={player.avatarUrl}
                            alt={displayName}
                            className="player-avatar-image"
                        />
                    ) : (
                        <div className="player-avatar-fallback">{avatarText}</div>
                    )}
                </div>
                <div className="player-info">
                    <span className="player-symbol">{player.symbol}</span>
                    <strong>{displayName}</strong>
                </div>
            </aside>
        );
    };

    const resetGame = async () => {
        if (currentRoom.status !== 'finished' || isResetting) return;
        setIsResetting(true);
        try {
            const newSession = await startRematch(roomId);
            setCurrentRoom(newSession.room);
            setSquares(flattenBoard(newSession.room.board));
            setPlayers(newSession.room.players);
            setWinnerId(null);
            setCurrentTurnId(newSession.room.currentTurn);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không thể bắt đầu ván mới');
        } finally {
            setIsResetting(false);
        }
    }

    return (
        <section className="board-panel">
            <div className="board-layout">
                {renderPlayerCard(leftPlayer, 'left')}

                <div className="board-main-column">
                    <div className="board-status" aria-live="polite">
                        <span>{statusMessage}</span>
                    </div>

                    <div
                        className="board-grid"
                        style={{
                            gridTemplateColumns: `repeat(${currentRoom.boardSize}, minmax(0, 1fr))`,
                            gridTemplateRows: `repeat(${currentRoom.boardSize}, minmax(0, 1fr))`,
                        }}
                    >
                        {squares.map((value: SquareValue, index: number) => (
                            <Square
                                key={`${Math.floor(index / currentRoom.boardSize)}-${index % currentRoom.boardSize}`}
                                value={value}
                                onClick={() => handleClick(index)}
                            />
                        ))}
                    </div>

                    <div className="board-actions">
                        <button
                            className="board-reset"
                            onClick={resetGame}
                            disabled={currentRoom.status !== 'finished' || isResetting}
                        >
                            {isResetting ? 'Đang tạo ván...' : 'Chơi lại'}
                        </button>
                        <button className="board-leave" onClick={onBackToMenu}>
                            Về menu
                        </button>
                    </div>
                </div>

                {renderPlayerCard(rightPlayer, 'right')}
            </div>
        </section>
    )
}