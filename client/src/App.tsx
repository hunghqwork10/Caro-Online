import type { JSX } from 'react'
import './App.css'
import Board from './components/Board'
import React from 'react'

// Định nghĩa bộ các trạng thái cố định
const GAME_STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  CREDITS: 'CREDITS',
}

function MainMenu({ onStart, onCredits }: { onStart: () => void; onCredits: () => void }): JSX.Element {
  return (
    <div className="menu">
      <h1>Caro Online</h1>
      <button onClick={onStart}>Bắt đầu</button>
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

  // hàm xử lý logic chuyển trạng thái
  const startGame = () => setGameState(GAME_STATES.PLAYING);
  const viewCredits = () => setGameState(GAME_STATES.CREDITS);
  const backToMenu = () => setGameState(GAME_STATES.MENU);

  if (gameState === GAME_STATES.MENU) {
    return <MainMenu onStart={startGame} onCredits={viewCredits} />
  }

  if (gameState === GAME_STATES.CREDITS) {
    return <Credits onBack={backToMenu} />
  }

  return (
    <>
      <Board />
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
        <button onClick={backToMenu}>Về menu</button>
      </div>
    </>
  )
}

export default App