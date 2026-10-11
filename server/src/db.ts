import 'dotenv/config'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('Thiếu DATABASE_URL trong file server/.env')
}

export const pool = new Pool({ connectionString })