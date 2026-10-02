import { useEffect, useState } from "react";
import Square from "./Square";
import { SquareValue } from "../types";
import { RoomData, sendMoveToServer } from "../services/gameServices";
import { io } from 'socket.io-client';

interface BoardProps {
    room: RoomData;
    playerId: string;
}

const BOARD_SIZE: number = 10; // đặt kích thước bàn cờ (ví dụ 10x10)

const socket = io("http://localhost:5000/"); // Kết nối tới server

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

export default function Board({ room, playerId }: BoardProps) {
    const roomId = room.id;

    // định nghĩa kiểu rõ ràng cho state: Array của SquareValue
    const [squares, setSquares] = useState<SquareValue[]>(
        Array(BOARD_SIZE * BOARD_SIZE).fill(null)
    );

    const [xIsNext, setXIsNext] = useState<boolean>(true);
    const [winner, setWinner] = useState<SquareValue>(null);
    const [winnerId, setWinnerId] = useState<string | null>(null);
    const [currentTurnId, setCurrentTurnId] = useState<string>(room.currentTurn);

    useEffect(() => {
        if (!roomId) return;

        const unsubscribe = subscribeToRoomChanges(roomId, (updatedRoom) => {
            if (updatedRoom?.board) {
                // 1. Cập nhật mảng ô cờ cho BẢO CẢ 2 NGƯỜI
                const flatSquares = updatedRoom.board.flat() as SquareValue[];
                setSquares(flatSquares);

                // 2. Cập nhật lượt đi tiếp theo
                if (updatedRoom.currentTurn) {
                    setCurrentTurnId(updatedRoom.currentTurn);
                }

                // 3. Cập nhật trạng thái thắng/thua (nếu có)
                if (updatedRoom.winnerId) {
                    setWinnerId(updatedRoom.winnerId);
                }
            }
        });

        // Cleanup listener khi unmount component
        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [roomId]);

    const handleClick = async (index: number) => {
        // 1. CHỐNG CLICK BỪA Ở CLIENT (Tối ưu trải nghiệm)
        // Nếu ô đã được đánh hoặc game đã kết thúc, hoặc KHÔNG PHẢI lượt của mình thì chặn luôn không cho click
        if (squares[index] || winner || currentTurnId !== playerId) return;

        // 2. GỬI NƯỚC ĐI LÊN SERVER ĐỂ KIỂM TRA CHỐNG CHEAT
        // (Bóc tách index ngược lại thành row và col để truyền vào hàm service)
        const row = Math.floor(index / BOARD_SIZE);
        const col = index % BOARD_SIZE;

        const updatedRoom = await sendMoveToServer(roomId, playerId, row, col, BOARD_SIZE);

        // 3. CẬP NHẬT GIAO DIỆN KHI SERVER ĐỒNG Ý
        if (updatedRoom) {
            // Vì Backend đang trả về mảng 2 chiều 'board', ta cần làm phẳng (flatten) nó
            // thành mảng 1 chiều 'squares' để khớp với State hiện tại
            const flatSquares = updatedRoom.board.flat() as SquareValue[];
            setSquares(flatSquares);

            // Cập nhật người thắng từ Server (nếu có)
            if (updatedRoom.winnerId) {
                // Nếu winnerId là 'draw' thì xử hòa, ngược lại lấy ký hiệu của người thắng
                setWinnerId(updatedRoom.winnerId);
            } else {
                // Cập nhật lượt đi dựa trên ID người chơi tiếp theo do Server chỉ định
                // (Có thể chuyển biến currentTurnId thành state để lưu)
                setCurrentTurnId(updatedRoom.currentTurn);
            }
        }
    }

    const resetGame = () => {
        setSquares(Array(BOARD_SIZE * BOARD_SIZE).fill(null));
        setXIsNext(true);
        setWinner(null);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
            <div style={{ marginBottom: '10px', fontSize: '18px', fontWeight: 'bold' }}>
                {winnerId ? (
                    <span>
                        {winnerId === 'draw' ? 'Hoà' : `Người thắng: ${winnerId}`}
                    </span>
                ) : (
                    <>Lượt đi tiếp theo: {currentTurnId}</>
                )}
            </div>

            {/* Bàn cờ render tự động bằng CSS Grid */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${BOARD_SIZE}, 40px)`,
                    gridTemplateRows: `repeat(${BOARD_SIZE}, 40px)`,
                    border: '2px solid #333',
                }}
            >
                {squares.map((value: SquareValue, index: number) => (
                    <Square 
                        key={index}
                        value={value}
                        onClick={() => handleClick(index)}
                    />
                ))}
            </div>

            <button onClick={resetGame} style={{ marginTop: '15px', padding: '8px 20px', fontSize: '16px', cursor: 'pointer' }}>
                Reset
            </button>
        </div>
    )
}