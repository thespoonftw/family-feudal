import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import staticFiles from '@fastify/static'
import { Server as SocketServer } from 'socket.io'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@family-feudal/shared'
import { registerSocketHandlers } from './socket/index.js'
import { registerDevRoutes } from './routes/dev.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors, { origin: true })

await fastify.register(
  async (app) => {
    registerDevRoutes(app)
  },
  { prefix: '/api' },
)

// Serve the built Vue client in production, with SPA fallback for client-side routes
if (process.env['NODE_ENV'] === 'production') {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const clientDist = join(__dirname, '../../client/dist')
  await fastify.register(staticFiles, {
    root: clientDist,
    prefix: '/',
    decorateReply: false,
  })
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({ error: 'Not found' })
    }
    return reply.sendFile('index.html', clientDist)
  })
}

await fastify.ready()

const io = new SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(fastify.server, {
  cors: { origin: '*' },
})

registerSocketHandlers(io)

const port = Number(process.env['PORT'] ?? 3002)
await fastify.listen({ port, host: '0.0.0.0' })
