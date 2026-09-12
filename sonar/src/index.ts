import { Hono, type Context, type Next } from 'hono'
import { streamSSE } from 'hono/streaming'
import { cors } from 'hono/cors'
import { trimTrailingSlash } from 'hono/trailing-slash'
import { timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { generateId } from 'ai'
import { runPersistentTurn, getChatHistory } from './agent.js'
import { listChats, deleteChat } from './memory.js'

const app = new Hono()

const API_KEY = process.env.SONAR_API_KEY || ''

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  '*',
  cors(
    corsOrigins.length > 0
      ? { origin: corsOrigins, allowMethods: ['GET', 'POST', 'DELETE'], allowHeaders: ['Content-Type'] }
      : undefined
  )
)

app.use('*', trimTrailingSlash())

const chatRequestSchema = z.object({
  chatId: z.string().min(1).optional(),
  message: z.string().min(1, 'message must not be empty'),
})

/** Bearer token / x-api-key auth against SONAR_API_KEY (main.ts exits if unset). */
const requireApiKey = async (c: Context, next: Next) => {
  if (!API_KEY) return c.json({ error: 'SONAR_API_KEY is not configured' }, 500)
  const auth = c.req.header('authorization')
  const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : c.req.header('x-api-key') || ''
  const ok =
    provided.length === API_KEY.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(API_KEY))
  if (!ok) return c.json({ error: 'Unauthorized' }, 401)
  await next()
}

app.use('/chat', requireApiKey)
app.use('/chats/*', requireApiKey)

app.get('/', (c) => {
  return c.json({
    name: 'sonar',
    version: '1.0.0',
    routes: {
      'POST /chat': 'Run a research turn (SSE stream)',
      'GET /chats': 'List chats',
      'GET /chats/:id': 'Get chat history',
      'DELETE /chats/:id': 'Delete a chat',
    },
  })
})

app.post('/chat', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = chatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body', issues: parsed.error.issues }, 400)
  }

  const { chatId = generateId(), message } = parsed.data

  return streamSSE(c, async (stream) => {
    try {
      let lastLen = 0
      await stream.writeSSE({ event: 'start', data: JSON.stringify({ chatId }) })

      const { text } = await runPersistentTurn(chatId, message, undefined, {
        onTextDelta: (full) => {
          if (full.length > lastLen) {
            const delta = full.slice(lastLen)
            lastLen = full.length
            void stream.writeSSE({ event: 'delta', data: JSON.stringify({ text: delta }) })
          }
        },
      })

      if (lastLen === 0 && text) {
        await stream.writeSSE({ event: 'delta', data: JSON.stringify({ text }) })
      }

      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({ chatId, text }),
      })
    } catch (error) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({
          chatId,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      })
    }
  })
})

app.get('/chats', async (c) => {
  return c.json({ chats: await listChats() })
})

app.get('/chats/:id', async (c) => {
  const id = c.req.param('id')
  const messages = await getChatHistory(id)
  return c.json({ chatId: id, messages })
})

app.delete('/chats/:id', async (c) => {
  const id = c.req.param('id')
  await deleteChat(id)
  return c.json({ chatId: id, deleted: true })
})

app.onError((err, c) => {
  console.error('[sonar:server]', err)
  return c.json({ error: err instanceof Error ? err.message : 'Internal server error' }, 500)
})

export default app
