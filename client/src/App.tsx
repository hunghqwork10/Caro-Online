import type { JSX } from 'react'
import './App.css'
import Board from './components/Board'
import React, { useState } from 'react'
import { createRoom, joinRoom, RoomSession } from './services/gameServices'

// Định nghĩa bộ các trạng thái cố định
const GAME_STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  CREDITS: 'CREDITS',
}

function MainMenu({
  onStart,
  onCredits,
  roomCode,
  setRoomCode,
  onJoinRoom,
}: {
  onStart: () => void;
  onCredits: () => void;
  roomCode: string;
  setRoomCode: (roomCode: string) => void;
  onJoinRoom: () => void;
}): JSX.Element {
  return (
    <div className="menu">
      <h1>Caro Online</h1>
      <button onClick={onStart}>Bắt đầu</button>
      <input
        value={roomCode}
        onChange={(event) => setRoomCode(event.target.value)}
        placeholder="Nhập mã phòng"
      />
      <button onClick={onJoinRoom}>Tham gia phòng</button>
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
  const [roomCode, setRoomCode] = useState('');
  const [roomCodeCopied, setRoomCodeCopied] = useState(false);

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

  const joinExistingRoom = async () => {
    try {
      if(!roomCode.trim()) {
        alert("Vui lòng nhập mã phòng!");
        return;
      }

      const joined = await joinRoom(roomCode.trim(), 'Người chơi 2')
      setSession(joined)
      setGameState(GAME_STATES.PLAYING)
    } catch (error) {
      console.error('Không tham gia được phòng:', error)
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
              onCredits={viewCredits}
              // Truyền thêm props để nhập room code nếu MainMenu xử lý việc này
              roomCode={roomCode}
              setRoomCode={setRoomCode}
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