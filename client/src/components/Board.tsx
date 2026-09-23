import React, { useState } from "react";
import Square from "./Square";
import { SquareValue } from "../types";
import { checkWinner } from "../utils";

const BOARD_SIZE: number = 10; // đặt kích thước bàn cờ (ví dụ 10x10)

export default function Board() {
    // định nghĩa kiểu rõ ràng cho state: Array của SquareValue
    const [squares, setSquares] = useState<SquareValue[]>(
        Array(BOARD_SIZE * BOARD_SIZE).fill(null)
    );

    const [xIsNext, setXIsNext] = useState<boolean>(true);
    const [winner, setWinner] = useState<SquareValue>(null);

    const handleClick = (index: number) => {
        // Nếu ô đã được đánh hoặc game đã kết thúc thì không xử lý
        if (squares[index] || winner) return;

        // Sao chép mảng cũ để đảm bảo tính bất biến (immutability) trong React
        const nextSquares: SquareValue[] = squares.slice();
        nextSquares[index] = xIsNext ? 'X' : 'O';

        // Kiểm tra xem nước đi vừa rồi có tạo ra người thắng không
        if (checkWinner(index, nextSquares, BOARD_SIZE)) {
            setWinner(nextSquares[index]);
        } else {
            setXIsNext(!xIsNext);
        }

        setSquares(nextSquares);
    }

    const resetGame = () => {
        setSquares(Array(BOARD_SIZE * BOARD_SIZE).fill(null));
        setXIsNext(true);
        setWinner(null);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
            <div style={{ marginBottom: '10px', fontSize: '18px', fontWeight: 'bold' }}>
                {winner ? (
                    <>Người thắng: <span style={{ color: winner === 'X' ? 'blue' : 'red' }}>{winner}</span></>
                ) : (
                    <>Lượt đi tiếp theo: <span style={{ color: xIsNext ? 'blue' : 'red' }}>{xIsNext ? 'X' : 'O'}</span></>
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