# sonar

Hono web server exposing an AI deep-research agent (Vercel AI SDK `ToolLoopAgent`)
with Tavily web tools, arXiv, and Turso-backed chat memory.

Routes:

| Route                 | Auth                 | Description                        |
| --------------------- | -------------------- | ---------------------------------- |
| `GET /`               | none                 | Route listing / health check       |
| `POST /chat`          | Bearer / x-api-key   | Run a research turn (SSE stream)   |
| `GET /chats`          | Bearer / x-api-key   | List chats                         |
| `GET /chats/:id`      | Bearer / x-api-key   | Get chat history                   |
| `DELETE /chats/:id`   | Bearer / x-api-key   | Delete a chat                      |

Auth: `Authorization: Bearer <SONAR_API_KEY>` or `x-api-key: <SONAR_API_KEY>`.

## Local development

```bash
npm install
cp .env.example .env          # fill in real values
npm run dev                   # tsx src/main.ts (@hono/node-server)
# or: vc dev                  # runs through the Vercel build pipeline
```

Generate `SONAR_API_KEY` with: `openssl rand -base64 32`

## Deploying to Vercel

Prerequisites: [Vercel CLI](https://vercel.com/docs/cli) installed and logged in.
Vercel detects the Hono app automatically (framework preset `hono`) from the
default export in `src/index.ts`.

```bash
vercel link -y                # one-time: link sonar/ to a Vercel project
vercel env pull --yes         # optional: sync local env from the project

# push env vars (values come from local .env; add for production and/or preview)
printf '%s' "$OPENCODE_API_KEY"   | vercel env add OPENCODE_API_KEY   production
printf '%s' "$TAVILY_API_KEY"     | vercel env add TAVILY_API_KEY     production
printf '%s' "$TURSO_AUTH_TOKEN"   | vercel env add TURSO_AUTH_TOKEN   production
printf '%s' "$TURSO_DATABASE_URL" | vercel env add TURSO_DATABASE_URL production
printf '%s' "$SONAR_API_KEY"      | vercel env add SONAR_API_KEY      production
printf '%s' "$CORS_ORIGINS"       | vercel env add CORS_ORIGINS       production

vercel build                  # verify the build pipeline locally (recommended)
vercel deploy -y --no-wait    # preview deployment
vercel deploy --prod -y --no-wait   # promote to production
```

Required env vars: `OPENCODE_API_KEY`, `TAVILY_API_KEY`, `TURSO_AUTH_TOKEN`,
`TURSO_DATABASE_URL`, `SONAR_API_KEY`, `CORS_ORIGINS` (comma-separated browser
origins; CLI/server-to-server clients are unaffected). `FAKE_API_KEY` from
`.env.example` is unused by the server.

## Testing

```bash
BASE=<deployment-url>
TOKEN=$(grep '^SONAR_API_KEY=' .env | cut -d= -f2- | tr -d '"')

curl $BASE                                             # public route listing
curl -N -X POST $BASE/chat \                           # SSE stream
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"chatId":"test-1","message":"..."}'
curl -H "Authorization: Bearer $TOKEN" $BASE/chats     # list chats
curl -H "Authorization: Bearer $TOKEN" $BASE/chats/test-1
curl -X DELETE -H "Authorization: Bearer $TOKEN" $BASE/chats/test-1
```

`-N` disables curl buffering so SSE deltas render live. `chatId` is optional —
the server generates one (returned in the SSE `start` event).

## Deployment notes / issues resolved

- **Hono detection**: Vercel requires the default export of the Hono app at a
  recognized entrypoint (`app/index/server` at root or under `src/`). Here it is
  `src/index.ts`. `src/main.ts` (`@hono/node-server`) is local-dev only; Vercel
  ignores it.
- **Framework preset**: the project was originally created with preset "Other",
  so zero-config Hono builds never engaged (build ran `tsc` and looked for a
  `public/` dir). Fixed by setting the framework to `hono` on the project (CLI
  cannot change it — project settings or `PATCH /v10/projects/{id}`).
- **No build script**: the Vercel hono build runs any npm `build` script before
  bundling (`considerBuildCommand: true`), but `tsc` is unnecessary — the build
  machine only installs production deps and `@vercel/node` transpiles TS itself.
  Renamed `build` → `compile` to keep it local-only.
- **@types/node as a prod dependency**: the Vercel build machine installs
  production dependencies only, so `@types/node` was moved from
  `devDependencies` to `dependencies` to keep it available during builds.
- **`typeRoots` in tsconfig**: `@vercel/node` transpiles with the TypeScript 7
  compiler using a temp `tsconfig` in `/tmp` that `extends` the project config.
  Default type resolution happens relative to that temp dir, so
  `types: ["node"]` failed with `TS2688`. Explicit
  `"typeRoots": ["./node_modules/@types"]` resolves relative to the project and
  fixes it.
- **`.env` security**: `vercel deploy` does NOT respect `.gitignore` — it packs
  everything except `.vercelignore` entries. `.vercelignore` excludes `.env*`
  so secrets never reach deployment storage.
- **Duration limit**: the Hobby plan caps function executions at 300s
  (Fluid compute). Very deep research turns may return a 504 mid-stream; the
  Pro plan raises the cap to 800s (`maxDuration`).
- **CORS**: `CORS_ORIGINS` is a comma-separated allowlist for browser clients.
  Update it (or re-add the env var) when a frontend domain exists.
