import type { NextFunction, Request, Response } from 'express'
import jwt, { JwtPayload } from 'jsonwebtoken'

export interface AuthenticatedUser {
  id: number
  username: string
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Thiếu JWT_SECRET trong file server/.env')
  return secret
}

const JWT_SECRET = getJwtSecret()

export function authenticateToken(token: string): AuthenticatedUser | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (typeof payload === 'string') return null

    const claims = payload as JwtPayload
    const userId = Number(claims.userId)
    if (!Number.isSafeInteger(userId) || userId <= 0 || typeof claims.username !== 'string') {
      return null
    }

    return { id: userId, username: claims.username }
  } catch {
    return null
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.header('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  const user = token ? authenticateToken(token) : null

  if (!user) {
    res.status(401).json({ message: 'Vui lòng đăng nhập lại' })
    return
  }

  req.authUser = user
  next()
}