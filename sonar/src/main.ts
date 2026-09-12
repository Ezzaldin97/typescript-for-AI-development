import { serve } from '@hono/node-server'
import app from './index.js'

const port = Number(process.env.PORT ?? 3000)

if (!process.env.SONAR_API_KEY) {
  console.error(
    '[sonar:server] SONAR_API_KEY is not set. Generate one with: openssl rand -base64 32'
  )
  process.exit(1)
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Sonar server listening on http://localhost:${info.port}`)
})
