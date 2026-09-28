// src/services/gameService.ts
import axios from 'axios';

export interface RoomResponse {
    id: string;
    status: 'waiting' | 'playing' | 'finished';
    board: string[][];
    currentTurn: string;
    winnerId?: string | 'draw' | null;
}

/**
 * Hàm gửi nước đi từ Front-end lên Back-end
 */
export const sendMoveToServer = async (
    roomId: string, 
    playerId: string, 
    row: number, 
    col: number, 
    boardSize: number
): Promise<RoomResponse | null> => {
    
    // Tính toán index mảng 1 chiều từ tọa độ 2 chiều
    const index = (row * boardSize) + col;

    try {
        // Gọi API thông qua Vite proxy (/api)
        const response = await axios.post<RoomResponse>(`/api/rooms/${roomId}/moves`, {
            playerId: playerId,
            index: index
        });
        return response.data;
    } catch (error: any) {
        if (error.response) {
            alert(`Lỗi: ${error.response.data.message}`);
        } else {
            console.error('Lỗi kết nối mạng:', error.message);
        }
        return null;
    }
};
