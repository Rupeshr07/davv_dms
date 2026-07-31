import app from './app.js'
import { env } from './config/env.js'
import { ensureDatabaseReady } from './services/bootstrap.service.js'

await ensureDatabaseReady()

const server = app.listen(env.port, () => {
  console.log(`Server ready on port ${env.port}`)
})

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0)
  })
})

export default app
