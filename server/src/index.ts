import 'dotenv/config'
import { createServer } from 'node:http'
import express, { Express, Response } from 'express'
import { Server } from 'socket.io'
import roomsRouter, { setupGameSocket } from './gameRoutes'
import authRouter from './authRoutes'
import { pool } from './db'
import { authenticateToken } from './auth'

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  'http://localhost:5173',
  'https://caro-online-5n87.vercel.app',
].filter((origin): origin is string => Boolean(origin))

const app: Express = express()
const PORT = process.env.PORT || 5000
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})

io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  const user = typeof token === 'string' ? authenticateToken(token) : null

  if (!user) {
    next(new Error('Unauthorized'))
    return
  }

  socket.data.userId = String(user.id)
  next()
})

app.use(express.json())
app.use((req, res, next) => {
  const origin = req.headers.origin
  const isAllowedOrigin = origin ? allowedOrigins.includes(origin) : true

  if (origin && isAllowedOrigin) {
    res.header('Access-Control-Allow-Origin', origin)
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.header('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }

  next()
})

app.set('io', io)
setupGameSocket(io)

app.get('/', (_req, res: Response) => {
  res.send('Server is running')
})

app.use('/rooms', roomsRouter)
app.use('/auth', authRouter)
app.use('/api/rooms', roomsRouter)
app.use('/api/auth', authRouter)

async function startServer() {
  try {
    await pool.query('SELECT 1')
    console.log('PostgreSQL connected')
    httpServer.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`)
    })
  } catch (error) {
    console.error('Không thể kết nối PostgreSQL:', error)
    process.exitCode = 1
  }
}

void startServer()
