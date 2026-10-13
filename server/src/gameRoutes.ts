import { Router, Request, Response } from 'express'
import { Server, Socket } from 'socket.io'
import { requireAuth } from './auth'
import {
  AvailableGameRoom,
  GameRepositoryError,
  GameRoom,
  createRoom,
  getRoom,
  isRoomMember,
  joinRoom,
  leaveRoom,
  listAvailableRooms,
  quickJoinRoom,
  startRematch,
  submitMove,
} from './gameRepository'

const router = Router()
router.use(requireAuth)

let ioServer: Server | null = null

async function broadcastRoomList() {
  if (!ioServer) return
  try {
    const rooms = await listAvailableRooms()
    ioServer.emit('room_list_updated', rooms)
  } catch (error) {
    console.error('Không phát được danh sách phòng:', error)
  }
}

function sendError(res: Response, error: unknown) {
  if (error instanceof GameRepositoryError) {
    res.status(error.statusCode).json({ message: error.message })
    return
  }
  console.error('Lỗi xử lý phòng/trận:', error)
  res.status(500).json({ message: 'Lỗi hệ thống' })
}

function sessionResponse(room: GameRoom, userId: number) {
  return { room, playerId: String(userId) }
}

function emitRoomUpdate(room: GameRoom) {
  if (!ioServer) return
  ioServer.to(room.id).emit('move_updated', { room })
  if (room.status === 'finished' || room.status === 'closed') {
    ioServer.to(room.id).emit('game_over', {
      board: room.board,
      winnerId: room.winnerId,
      room,
    })
  }
}

export function setupGameSocket(io: Server) {
  ioServer = io
  io.on('connection', (socket: Socket) => {
    socket.on('join_room', async (roomCode: string) => {
      try {
        const userId = Number(socket.data.userId)
        if (!await isRoomMember(roomCode, userId)) {
          socket.emit('room_error', { message: 'Bạn không thuộc phòng này' })
          return
        }
        await socket.join(roomCode)
        const room = await getRoom(roomCode)
        socket.emit('move_updated', { room })
      } catch (error) {
        socket.emit('room_error', {
          message: error instanceof GameRepositoryError ? error.message : 'Không tải được phòng',
        })
      }
    })

    socket.on('leave_room', (roomCode: string) => {
      void socket.leave(roomCode)
    })
  })
}

router.post('/', async (req: Request<{}, {}, { boardSize?: number }>, res: Response) => {
  try {
    const room = await createRoom(req.authUser!.id)
    res.status(201).json(sessionResponse(room, req.authUser!.id))
    void broadcastRoomList()
  } catch (error) {
    sendError(res, error)
  }
})

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rooms: AvailableGameRoom[] = await listAvailableRooms()
    res.json(rooms)
  } catch (error) {
    sendError(res, error)
  }
})

router.post('/quick-join', async (req: Request, res: Response) => {
  try {
    const room = await quickJoinRoom(req.authUser!.id)
    res.json(sessionResponse(room, req.authUser!.id))
    emitRoomUpdate(room)
    void broadcastRoomList()
  } catch (error) {
    sendError(res, error)
  }
})

router.post('/:roomCode/join', async (req: Request<{ roomCode: string }>, res: Response) => {
  try {
    const room = await joinRoom(req.params.roomCode, req.authUser!.id)
    res.json(sessionResponse(room, req.authUser!.id))
    emitRoomUpdate(room)
    void broadcastRoomList()
  } catch (error) {
    sendError(res, error)
  }
})

router.post('/:roomCode/rematch', async (req: Request<{ roomCode: string }>, res: Response) => {
  try {
    const room = await startRematch(req.params.roomCode, req.authUser!.id)
    res.json(sessionResponse(room, req.authUser!.id))
    emitRoomUpdate(room)
  } catch (error) {
    sendError(res, error)
  }
})

router.post(
  '/:roomCode/moves',
  async (req: Request<{ roomCode: string }, {}, { index?: number }>, res: Response) => {
    try {
      const room = await submitMove(req.params.roomCode, req.authUser!.id, req.body.index as number)
      res.json(room)
      emitRoomUpdate(room)
    } catch (error) {
      sendError(res, error)
    }
  },
)

router.get('/:roomCode', async (req: Request<{ roomCode: string }>, res: Response) => {
  try {
    const room = await getRoom(req.params.roomCode)
    if (!room.players.some((player) => player.id === String(req.authUser!.id))) {
      res.status(403).json({ message: 'Bạn không thuộc phòng này' })
      return
    }
    res.json(room)
  } catch (error) {
    sendError(res, error)
  }
})

router.delete(
  '/:roomCode/players/:playerId',
  async (req: Request<{ roomCode: string; playerId: string }>, res: Response) => {
    if (req.params.playerId !== String(req.authUser!.id)) {
      res.status(403).json({ message: 'Không thể rời phòng thay người chơi khác' })
      return
    }
    try {
      const room = await leaveRoom(req.params.roomCode, req.authUser!.id)
      res.status(204).send()
      emitRoomUpdate(room)
      void broadcastRoomList()
    } catch (error) {
      sendError(res, error)
    }
  },
)

export default router