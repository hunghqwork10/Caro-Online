import type { JSX } from 'react'
import './App.css'
import Board from './components/Board'
import React, { useEffect, useState } from 'react'
import { AvailableRoom, createRoom, getAvailableRooms, joinRoom, quickJoinRoom, RoomSession } from './services/gameServices'

// Định nghĩa bộ các trạng thái cố định
const GAME_STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  CREDITS: 'CREDITS',
}

function MainMenu({
  onStart,
  onQuickJoin,
  onCredits,
  availableRooms,
  roomsLoading,
  roomsError,
  joiningRoomId,
  onRefreshRooms,
  onJoinRoom,
}: {
  onStart: () => void;
  onQuickJoin: () => void;
  onCredits: () => void;
  availableRooms: AvailableRoom[];
  roomsLoading: boolean;
  roomsError: string;
  joiningRoomId: string | null;
  onRefreshRooms: () => void;
  onJoinRoom: (roomId: string) => void;
}): JSX.Element {
  return (
    <div className="menu">
      <h1>Caro Online</h1>
      <button onClick={onStart}>Bắt đầu</button>
      <button onClick={onQuickJoin}>Vào phòng ngẫu nhiên</button>
      <section className="available-rooms" aria-labelledby="available-rooms-title">
        <div className="available-rooms-header">
          <h2 id="available-rooms-title">Phòng đang chờ</h2>
          <button type="button" onClick={onRefreshRooms} disabled={roomsLoading}>
            {roomsLoading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
        {roomsError && <p role="alert">{roomsError}</p>}
        {!roomsError && !roomsLoading && availableRooms.length === 0 && (
          <p>Hiện chưa có phòng trống.</p>
        )}
        <ul className="available-rooms-list">
          {availableRooms.map((room) => (
            <li key={room.id}>
              <div>
                <strong>{room.hostName}</strong>
                <span>{room.playerCount}/{room.maxPlayers} người · Bàn {room.boardSize}×{room.boardSize}</span>
              </div>
              <button
                type="button"
                onClick={() => onJoinRoom(room.id)}
                disabled={joiningRoomId !== null}
              >
                {joiningRoomId === room.id ? 'Đang vào...' : 'Tham gia'}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <button onClick={onCredits}>Credits</button>
    </div>
  )
}

function Credits({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="menu">
      <h1>Credits</h1>
      <p>Game Caro Online thực hiện bởi nhóm phát triển.</p>
      <button onClick={onBack}>Về menu</button>
    </div>
  )
}

function App(): JSX.Element {
  const [gameState, setGameState] = React.useState(GAME_STATES.MENU);
  const [session, setSession] = React.useState<RoomSession | null>(null);
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState('');
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (gameState !== GAME_STATES.MENU) return;

    let isActive = true;
    const loadRooms = async (showLoading: boolean) => {
      if (showLoading) setRoomsLoading(true);
      try {
        const rooms = await getAvailableRooms();
        if (isActive) {
          setAvailableRooms(rooms);
          setRoomsError('');
        }
      } catch (error) {
        console.error('Không tải được danh sách phòng:', error);
        if (isActive) setRoomsError('Không tải được danh sách phòng. Vui lòng thử lại.');
      } finally {
        if (isActive && showLoading) setRoomsLoading(false);
      }
    };

    void loadRooms(true);
    const refreshInterval = window.setInterval(() => void loadRooms(false), 5000);

    return () => {
      isActive = false;
      window.clearInterval(refreshInterval);
    };
  }, [gameState]);

  const refreshAvailableRooms = async () => {
    setRoomsLoading(true);
    try {
      setAvailableRooms(await getAvailableRooms());
      setRoomsError('');
    } catch (error) {
      console.error('Không tải được danh sách phòng:', error);
      setRoomsError('Không tải được danh sách phòng. Vui lòng thử lại.');
    } finally {
      setRoomsLoading(false);
    }
  };

  // hàm xử lý logic chuyển trạng thái
  const startGame = async () => {
    try {
      const created = await createRoom('Người chơi 1'); // tạm dùng tên cố định
      setSession(created);
      setGameState(GAME_STATES.PLAYING);
    } catch (error) {
      console.error('Không tạo được phòng: ', error);
    }
  };

  const quickJoin = async () => {
    try {
      const joined = await quickJoinRoom('Người chơi');
      setSession(joined);
      setGameState(GAME_STATES.PLAYING);
    } catch (error) {
      console.error('Không thể vào phòng ngẫu nhiên:', error);
      alert('Không thể vào phòng ngẫu nhiên. Vui lòng thử lại.');
    }
  };

  const joinExistingRoom = async (roomId: string) => {
    setJoiningRoomId(roomId);
    try {
      const joined = await joinRoom(roomId, 'Người chơi');
      setSession(joined);
      setGameState(GAME_STATES.PLAYING);
    } catch (error) {
      console.error('Không tham gia được phòng:', error)
      alert('Phòng này không còn trống. Danh sách phòng sẽ được cập nhật.');
      await refreshAvailableRooms();
    } finally {
      setJoiningRoomId(null);
    }
  };

  const viewCredits = () => setGameState(GAME_STATES.CREDITS);
  const backToMenu = () => setGameState(GAME_STATES.MENU);
  const copyRoomCode = async () => {
    if (!session) return;

    try {
      await navigator.clipboard.writeText(session.room.id);
      setRoomCodeCopied(true);
      window.setTimeout(() => setRoomCodeCopied(false), 1500);
    } catch (error) {
      console.error('Không sao chép được mã phòng:', error);
    }
  };

  if (gameState === GAME_STATES.MENU) {
    return <MainMenu
          onStart={startGame}
              onQuickJoin={quickJoin}
              onCredits={viewCredits}
              availableRooms={availableRooms}
              roomsLoading={roomsLoading}
              roomsError={roomsError}
              joiningRoomId={joiningRoomId}
              onRefreshRooms={refreshAvailableRooms}
              onJoinRoom={joinExistingRoom}
            />
  }

  if (gameState === GAME_STATES.CREDITS) {
    return <Credits onBack={backToMenu} />
  }

  return (
    <>
      {session && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          <span>Mã phòng: <strong>{session.room.id}</strong></span>
          <button onClick={copyRoomCode}>
            {roomCodeCopied ? 'Đã sao chép' : 'Sao chép mã'}
          </button>
        </div>
      )}
      {session && (
        <Board room={session.room} playerId={session.playerId} />
      )}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
        <button style={{ padding: '6px', cursor: 'pointer', fontSize: '14px' }} onClick={backToMenu}>Về menu</button>
      </div>
    </>
  )
}

export default App