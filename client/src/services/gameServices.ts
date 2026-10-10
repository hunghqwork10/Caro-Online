// src/services/gameService.ts
import axios from 'axios';

export interface RoomPlayer {
  id: string;
  name: string;
  symbol: 'X' | 'O';
}

export interface RoomData {
  id: string;
  status: 'waiting' | 'playing' | 'finished';
  players: RoomPlayer[];
  board: string[][];
  boardSize: number;
  currentTurn: string;
  winnerId?: string | null;
}

export interface RoomSession {
  room: RoomData;
  playerId: string;
}

export interface AvailableRoom {
  id: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  boardSize: number;
  createdAt: number;
}

export async function getAvailableRooms(): Promise<AvailableRoom[]> {
  const response = await axios.get<AvailableRoom[]>('/api/rooms');
  return response.data;
}

export async function createRoom(name: string): Promise<RoomSession> {
  const response = await axios.post<RoomSession>('/api/rooms', {
    name,
    boardSize: 10,
  });
  return response.data;
}

export async function quickJoinRoom(name: string): Promise<RoomSession> {
  const response = await axios.post<RoomSession>('/api/rooms/quick-join', {
    name,
    boardSize: 10,
  });
  return response.data;
}

export async function joinRoom(
  roomId: string,
  name: string,
): Promise<RoomSession> {
  const response = await axios.post<RoomSession>(
    `/api/rooms/${roomId}/join`,
    { name },
  );
  return response.data;
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
): Promise<RoomData | null> => {
    
    // Tính toán index mảng 1 chiều từ tọa độ 2 chiều
    const index = (row * boardSize) + col;

    try {
        // Gọi API thông qua Vite proxy (/api)
        const response = await axios.post<RoomData>(`/api/rooms/${roomId}/moves`, {
            playerId: playerId,
            index: index
        });
        return response.data;
    } catch (error: any) {
        const data = error.response?.data;
        const message =
            typeof data === 'string' ? data : data?.message ?? error.message;

        alert(`Lỗi: ${message}`);
        return null;
    }
};
