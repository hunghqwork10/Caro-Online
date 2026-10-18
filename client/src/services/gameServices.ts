// src/services/gameService.ts
import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_URL ? `${API_URL}${normalizedPath}` : normalizedPath;
};

function authConfig() {
  const token = localStorage.getItem('token');
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

export interface RoomPlayer {
  id: string;
  name: string;
  displayName?: string;
  symbol: 'X' | 'O';
  avatarUrl?: string | null;
}

export interface RoomData {
  id: string;
  status: 'waiting' | 'playing' | 'finished' | 'closed';
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
  const response = await axios.get<AvailableRoom[]>(buildApiUrl('/api/rooms'), authConfig());
  return response.data;
}

export async function createRoom(name: string): Promise<RoomSession> {
  const response = await axios.post<RoomSession>(buildApiUrl('/api/rooms'), {
    name,
    boardSize: 15,
  }, authConfig());
  return response.data;
}

export async function quickJoinRoom(name: string): Promise<RoomSession> {
  const response = await axios.post<RoomSession>(buildApiUrl('/api/rooms/quick-join'), {
    name,
    boardSize: 15,
  }, authConfig());
  return response.data;
}

export async function joinRoom(
  roomId: string,
  name: string,
): Promise<RoomSession> {
  const response = await axios.post<RoomSession>(
    buildApiUrl(`/api/rooms/${roomId}/join`),
    { name },
    authConfig(),
  );
  return response.data;
}

export async function startRematch(roomId: string): Promise<RoomSession> {
  const response = await axios.post<RoomSession>(
    buildApiUrl(`/api/rooms/${roomId}/rematch`),
    {},
    authConfig(),
  );
  return response.data;
}

export async function leaveRoom(roomId: string, playerId: string): Promise<void> {
  await axios.delete(buildApiUrl(`/api/rooms/${roomId}/players/${playerId}`), authConfig());
}

/**
 * Hàm gửi nước đi từ Front-end lên Back-end
 */
export const sendMoveToServer = async (
    roomId: string, 
    row: number, 
    col: number, 
    boardSize: number
): Promise<RoomData | null> => {
    
    // Tính toán index mảng 1 chiều từ tọa độ 2 chiều
    const index = (row * boardSize) + col;

    try {
        // Gọi API thông qua Vite proxy (/api)
        const response = await axios.post<RoomData>(buildApiUrl(`/api/rooms/${roomId}/moves`), {
            index: index
        }, authConfig());
        return response.data;
    } catch (error: any) {
        const data = error.response?.data;
        const message =
            typeof data === 'string' ? data : data?.message ?? error.message;

        alert(`Lỗi: ${message}`);
        return null;
    }
};
