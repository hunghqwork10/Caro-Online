import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from './db'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('Thiếu JWT_SECRET trong file server/.env')

const authRouter = Router()

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string }
    const normalizedUsername = username?.trim()
    if (!normalizedUsername || !password) {
      res.status(400).json({ message: 'Tên tài khoản và mật khẩu là bắt buộc' })
      return
    }
    if (normalizedUsername.length > 50) {
      res.status(400).json({ message: 'Tên tài khoản tối đa 50 ký tự' })
      return
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const { rows } = await pool.query<{
      id: number;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    }>(
      'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $1) RETURNING id, username, display_name, avatar_url',
      [normalizedUsername, passwordHash],
    )
    const user = rows[0]
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' },
    )
    res.status(201).json({
      user: {
        id: String(user.id),
        username: user.username,
        display_name: user.display_name ?? user.username,
        avatar_url: user.avatar_url ?? null,
      },
      token,
      message: 'Đăng ký thành công!',
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      res.status(409).json({ message: 'Tên tài khoản đã tồn tại' })
      return
    }
    console.error('Lỗi đăng ký:', error)
    res.status(500).json({ message: 'Lỗi hệ thống' })
  }
})

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string }
    const normalizedUsername = username?.trim()
    if (!normalizedUsername || !password) {
      res.status(400).json({ message: 'Tên tài khoản và mật khẩu là bắt buộc' })
      return
    }

    const { rows } = await pool.query<{
      id: number
      username: string
      password_hash: string
      display_name: string | null
      avatar_url: string | null
    }>(
      'SELECT id, username, password_hash, display_name, avatar_url FROM users WHERE username = $1',
      [normalizedUsername],
    )
    const user = rows[0]
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      res.status(400).json({ message: 'Tên tài khoản hoặc mật khẩu không chính xác' })
      return
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' },
    )
    res.json({
      token,
      user: {
        id: String(user.id),
        username: user.username,
        display_name: user.display_name ?? user.username,
        avatar_url: user.avatar_url ?? null,
      },
    })
  } catch (error) {
    console.error('Lỗi đăng nhập:', error)
    res.status(500).json({ message: 'Lỗi hệ thống' })
  }
})

export default authRouter