import express, { Express, Request, Response } from 'express'

const app: Express = express()
const PORT = process.env.PORT || 5000

app.use(express.json())

app.get('/', (_req: Request, res: Response) => {
  res.send('Server is running')
})

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`)
})
