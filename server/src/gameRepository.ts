import { randomUUID } from 'node:crypto'
import { PoolClient } from 'pg'
import { pool } from './db'

export type GameRoomStatus = 'waiting' | 'playing' | 'finished' | 'closed'

export interface GamePlayer {
  id: string
  name: string
  displayName?: string
  symbol: 'X' | 'O'
  avatarUrl?: string | null
}

export interface GameRoom {
  id: string
  status: GameRoomStatus
  players: GamePlayer[]
  board: string[][]
  boardSize: number
  currentTurn: string
  winnerId: string | null
}

export interface AvailableGameRoom {
  id: string
  hostName: string
  playerCount: number
  maxPlayers: number
  boardSize: number
  createdAt: number
}

interface RoomRow {
  db_room_id: number
  room_code: string
  host_id: number
  guest_id: number | null
  room_status: 'waiting' | 'playing' | 'closed'
  created_at: Date
  host_name: string
  host_avatar_url: string | null
  guest_name: string | null
  guest_avatar_url: string | null
  match_id: number | null
  board_size: number | null
  player_x_id: number | null
  player_o_id: number | null
  current_turn_id: number | null
  winner_id: number | null
  result_status: string | null
}

interface MatchRow {
  id: number
  room_id: number
  player_x_id: number
  player_o_id: number
  current_turn_id: number
  board_size: number
  result_status: string
  winner_id: number | null
}

export class GameRepositoryError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message)
    this.name = 'GameRepositoryError'
  }
}

async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function getRoomRow(roomCode: string, client?: PoolClient): Promise<RoomRow> {
  const queryable = client ?? pool
  const { rows } = await queryable.query<RoomRow>(
    `SELECT r.id AS db_room_id, r.room_code, r.host_id, r.guest_id,
            r.status AS room_status, r.created_at,
            COALESCE(host.display_name, host.username) AS host_name,
            host.avatar_url AS host_avatar_url,
            COALESCE(guest.display_name, guest.username) AS guest_name,
            guest.avatar_url AS guest_avatar_url,
            m.id AS match_id, m.board_size, m.player_x_id, m.player_o_id,
            m.current_turn_id, m.winner_id, m.result_status
     FROM rooms r
     JOIN users host ON host.id = r.host_id
     LEFT JOIN users guest ON guest.id = r.guest_id
     LEFT JOIN LATERAL (
       SELECT id, board_size, player_x_id, player_o_id, current_turn_id,
              winner_id, result_status
       FROM matches
       WHERE room_id = r.id
       ORDER BY id DESC
       LIMIT 1
     ) m ON TRUE
     WHERE r.room_code = $1`,
    [roomCode],
  )

  if (!rows[0]) throw new GameRepositoryError('Không tìm thấy phòng', 404)
  return rows[0]
}

async function roomFromRow(row: RoomRow, client?: PoolClient): Promise<GameRoom> {
  const boardSize = row.board_size ?? 15
  const players: GamePlayer[] = [{
    id: String(row.host_id),
    name: row.host_name,
    displayName: row.host_name,
    symbol: 'X',
    avatarUrl: row.host_avatar_url ?? null,
  }]

  if (row.guest_id !== null && row.guest_name !== null) {
    players.push({
      id: String(row.guest_id),
      name: row.guest_name,
      displayName: row.guest_name,
      symbol: 'O',
      avatarUrl: row.guest_avatar_url ?? null,
    })
  }

  const board = new Array(boardSize).fill(0).map(() => new Array<string>(boardSize).fill(''))
  if (row.match_id !== null) {
    const queryable = client ?? pool
    const { rows } = await queryable.query<{
      x_coordinate: number
      y_coordinate: number
      symbol: 'X' | 'O'
    }>(
      'SELECT x_coordinate, y_coordinate, symbol FROM match_moves WHERE match_id = $1 ORDER BY move_number',
      [row.match_id],
    )
    for (const move of rows) board[move.x_coordinate][move.y_coordinate] = move.symbol
  }

  let status: GameRoomStatus
  if (row.room_status === 'closed') status = 'closed'
  else if (row.match_id === null) status = 'waiting'
  else if (row.result_status === 'ongoing') status = 'playing'
  else status = 'finished'

  let winnerId: string | null = null
  if (row.result_status === 'draw') winnerId = 'draw'
  else if (row.winner_id !== null) winnerId = String(row.winner_id)

  return {
    id: row.room_code,
    status,
    players,
    board,
    boardSize,
    currentTurn: String(row.current_turn_id ?? row.host_id),
    winnerId,
  }
}

async function createMatch(
  client: PoolClient,
  roomId: number,
  hostId: number,
  guestId: number,
  boardSize: number,
): Promise<void> {
  await client.query(
    `INSERT INTO matches
       (room_id, player_x_id, player_o_id, current_turn_id, board_size, result_status)
     VALUES ($1, $2, $3, $2, $4, 'ongoing')`,
    [roomId, hostId, guestId, boardSize],
  )
}

async function joinLockedRoom(client: PoolClient, roomCode: string, guestId: number): Promise<void> {
  const { rows } = await client.query<{
    id: number
    host_id: number
    guest_id: number | null
    status: string
  }>(
    'SELECT id, host_id, guest_id, status FROM rooms WHERE room_code = $1 FOR UPDATE',
    [roomCode],
  )
  const room = rows[0]
  if (!room) throw new GameRepositoryError('Không tìm thấy phòng', 404)
  if (room.host_id === guestId) throw new GameRepositoryError('Bạn đã là chủ phòng', 409)
  if (room.status !== 'waiting' || room.guest_id !== null) {
    throw new GameRepositoryError('Phòng đã đầy hoặc không còn chờ', 409)
  }

  await client.query(
    "UPDATE rooms SET guest_id = $1, status = 'playing' WHERE id = $2",
    [guestId, room.id],
  )
  await createMatch(client, room.id, room.host_id, guestId, 15)
}

function checkWin(board: string[][], row: number, column: number, symbol: string): boolean {
  const directions: [number, number][] = [[0, 1], [1, 0], [1, 1], [-1, 1]]
  for (const [rowStep, columnStep] of directions) {
    let count = 1
    for (const sign of [-1, 1]) {
      let nextRow = row + rowStep * sign
      let nextColumn = column + columnStep * sign
      while (
        nextRow >= 0 && nextRow < board.length &&
        nextColumn >= 0 && nextColumn < board.length &&
        board[nextRow][nextColumn] === symbol
      ) {
        count++
        nextRow += rowStep * sign
        nextColumn += columnStep * sign
      }
    }
    if (count >= 5) return true
  }
  return false
}

export async function createRoom(userId: number): Promise<GameRoom> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = randomUUID().slice(0, 8).toUpperCase()
    const { rowCount } = await pool.query(
      'INSERT INTO rooms (room_code, host_id) VALUES ($1, $2) ON CONFLICT (room_code) DO NOTHING',
      [roomCode, userId],
    )
    if (rowCount === 1) return getRoom(roomCode)
  }
  throw new GameRepositoryError('Không tạo được mã phòng, vui lòng thử lại', 503)
}

export async function listAvailableRooms(): Promise<AvailableGameRoom[]> {
  const { rows } = await pool.query<{
    room_code: string
    host_name: string
    guest_id: number | null
    created_at: Date
    board_size: number | null
  }>(
    `SELECT r.room_code, COALESCE(u.display_name, u.username) AS host_name,
            r.guest_id, r.created_at, m.board_size
     FROM rooms r
     JOIN users u ON u.id = r.host_id
     LEFT JOIN LATERAL (
       SELECT board_size FROM matches WHERE room_id = r.id ORDER BY id DESC LIMIT 1
     ) m ON TRUE
     WHERE r.status = 'waiting' AND r.guest_id IS NULL
     ORDER BY r.created_at`,
  )

  return rows.map((row) => ({
    id: row.room_code,
    hostName: row.host_name,
    playerCount: row.guest_id === null ? 1 : 2,
    maxPlayers: 2,
    boardSize: row.board_size ?? 15,
    createdAt: row.created_at.getTime(),
  }))
}

export async function getRoom(roomCode: string): Promise<GameRoom> {
  return roomFromRow(await getRoomRow(roomCode))
}

export async function isRoomMember(roomCode: string, userId: number): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM rooms WHERE room_code = $1 AND (host_id = $2 OR guest_id = $2)',
    [roomCode, userId],
  )
  return rows.length > 0
}

export async function joinRoom(roomCode: string, guestId: number): Promise<GameRoom> {
  await withTransaction((client) => joinLockedRoom(client, roomCode, guestId))
  return getRoom(roomCode)
}

export async function quickJoinRoom(guestId: number): Promise<GameRoom> {
  const roomCode = await withTransaction(async (client) => {
    const { rows } = await client.query<{ room_code: string }>(
      `SELECT room_code FROM rooms
       WHERE status = 'waiting' AND guest_id IS NULL AND host_id <> $1
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
      [guestId],
    )
    const room = rows[0]
    if (!room) throw new GameRepositoryError('Hiện không có phòng trống', 404)
    await joinLockedRoom(client, room.room_code, guestId)
    return room.room_code
  })
  return getRoom(roomCode)
}

export async function leaveRoom(roomCode: string, userId: number): Promise<GameRoom> {
  await withTransaction(async (client) => {
    const { rows } = await client.query<{
      id: number
      host_id: number
      guest_id: number | null
      status: string
    }>(
      'SELECT id, host_id, guest_id, status FROM rooms WHERE room_code = $1 FOR UPDATE',
      [roomCode],
    )
    const room = rows[0]
    if (!room) throw new GameRepositoryError('Không tìm thấy phòng', 404)
    if (room.host_id !== userId && room.guest_id !== userId) {
      throw new GameRepositoryError('Bạn không thuộc phòng này', 403)
    }

    const { rows: matches } = await client.query<{
      id: number
      player_x_id: number
      player_o_id: number
    }>(
      `SELECT id, player_x_id, player_o_id FROM matches
       WHERE room_id = $1 AND result_status = 'ongoing'
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [room.id],
    )
    const match = matches[0]
    if (match) {
      const winnerId = match.player_x_id === userId ? match.player_o_id : match.player_x_id
      await client.query(
        "UPDATE matches SET result_status = 'surrender', winner_id = $1, ended_at = CURRENT_TIMESTAMP WHERE id = $2",
        [winnerId, match.id],
      )
    }
    await client.query("UPDATE rooms SET status = 'closed' WHERE id = $1", [room.id])
  })
  return getRoom(roomCode)
}

export async function startRematch(roomCode: string, userId: number): Promise<GameRoom> {
  await withTransaction(async (client) => {
    const { rows } = await client.query<{
      id: number
      host_id: number
      guest_id: number | null
      status: string
    }>(
      'SELECT id, host_id, guest_id, status FROM rooms WHERE room_code = $1 FOR UPDATE',
      [roomCode],
    )
    const room = rows[0]
    if (!room) throw new GameRepositoryError('Không tìm thấy phòng', 404)
    if (room.host_id !== userId && room.guest_id !== userId) {
      throw new GameRepositoryError('Bạn không thuộc phòng này', 403)
    }
    if (room.status !== 'playing' || room.guest_id === null) {
      throw new GameRepositoryError('Phòng không thể bắt đầu ván mới', 409)
    }

    const { rows: previousMatches } = await client.query<{ board_size: number; result_status: string }>(
      'SELECT board_size, result_status FROM matches WHERE room_id = $1 ORDER BY id DESC LIMIT 1 FOR UPDATE',
      [room.id],
    )
    const previousMatch = previousMatches[0]
    if (!previousMatch || previousMatch.result_status === 'ongoing') {
      throw new GameRepositoryError('Ván hiện tại chưa kết thúc', 409)
    }

    await createMatch(client, room.id, room.host_id, room.guest_id, previousMatch.board_size)
  })
  return getRoom(roomCode)
}

export async function submitMove(
  roomCode: string,
  userId: number,
  index: number,
): Promise<GameRoom> {
  await withTransaction(async (client) => {
    const { rows } = await client.query<MatchRow>(
      `SELECT m.id, m.room_id, m.player_x_id, m.player_o_id,
              m.current_turn_id, m.board_size, m.result_status, m.winner_id
       FROM matches m JOIN rooms r ON r.id = m.room_id
       WHERE r.room_code = $1 AND r.status = 'playing' AND m.result_status = 'ongoing'
       ORDER BY m.id DESC LIMIT 1 FOR UPDATE OF m`,
      [roomCode],
    )
    const match = rows[0]
    if (!match) throw new GameRepositoryError('Không có ván đang diễn ra', 409)
    const { row, column, symbol } = validateMove(match, userId, index)
    const { board, nextMoveNumber } = await loadMoveState(client, match)
    if (board[row][column] !== '') throw new GameRepositoryError('Ô này đã có quân cờ', 409)

    board[row][column] = symbol
    await client.query(
      `INSERT INTO match_moves
         (match_id, player_id, move_number, x_coordinate, y_coordinate, symbol)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [match.id, userId, nextMoveNumber, row, column, symbol],
    )
    await updateMatchAfterMove(client, match, userId, symbol, row, column, board)
  })
  return getRoom(roomCode)
}

function validateMove(match: MatchRow, userId: number, index: number) {
  if (match.player_x_id !== userId && match.player_o_id !== userId) {
    throw new GameRepositoryError('Bạn không thuộc trận đấu này', 403)
  }
  if (match.current_turn_id !== userId) {
    throw new GameRepositoryError('Chưa tới lượt đi của bạn', 400)
  }
  if (!Number.isInteger(index) || index < 0 || index >= match.board_size * match.board_size) {
    throw new GameRepositoryError('Tọa độ nước đi không nằm trong bàn cờ', 400)
  }

  return {
    row: Math.floor(index / match.board_size),
    column: index % match.board_size,
    symbol: match.player_x_id === userId ? 'X' : 'O',
  }
}

async function loadMoveState(client: PoolClient, match: MatchRow) {
  const { rows: moves } = await client.query<{
    move_number: number
    x_coordinate: number
    y_coordinate: number
    symbol: 'X' | 'O'
  }>(
    'SELECT move_number, x_coordinate, y_coordinate, symbol FROM match_moves WHERE match_id = $1 ORDER BY move_number',
    [match.id],
  )
  const board = new Array(match.board_size).fill(0).map(() => new Array<string>(match.board_size).fill(''))
  let lastMoveNumber = 0
  for (const move of moves) {
    board[move.x_coordinate][move.y_coordinate] = move.symbol
    lastMoveNumber = move.move_number
  }
  return { board, nextMoveNumber: lastMoveNumber + 1 }
}

async function updateMatchAfterMove(
  client: PoolClient,
  match: MatchRow,
  userId: number,
  symbol: string,
  row: number,
  column: number,
  board: string[][],
) {
  const hasWon = checkWin(board, row, column, symbol)
  const isDraw = !hasWon && board.every((boardRow) => boardRow.every((cell) => cell !== ''))
  if (hasWon || isDraw) {
    await client.query(
      `UPDATE matches
       SET result_status = $1, winner_id = $2, ended_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [hasWon ? 'win' : 'draw', hasWon ? userId : null, match.id],
    )
    return
  }

  const nextTurn = match.player_x_id === userId ? match.player_o_id : match.player_x_id
  await client.query('UPDATE matches SET current_turn_id = $1 WHERE id = $2', [nextTurn, match.id])
}