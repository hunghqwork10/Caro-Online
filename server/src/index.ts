import { createServer } from 'node:http'
import express, { Express, Response } from 'express'
import { Server } from 'socket.io'
import roomsRouter, { setupGameSocket } from './rooms'

const app: Express = express()
const PORT = process.env.PORT || 5000
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  },
})

app.use(express.json())
app.set('io', io)
setupGameSocket(io)

app.get('/', (_req, res: Response) => {
  res.send('Server is running')
})

app.use('/rooms', roomsRouter);

httpServer.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`)
})
