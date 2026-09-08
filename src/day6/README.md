# Multi-Agent Orchestration, Persistence & Guardrails

Split work across agents, persist state across restarts, and add the safety rails a production agent needs.

## Learning Objectives

- Implement an orchestrator/sub-agent pattern (planner + worker).
- Persist agent state so a conversation can resume after a restart.
- Add structured logging and basic cost/token tracing.
- Add guardrails: schema-validated tool I/O, step limits, and human-in-the-loop confirmation for risky actions.

## Python => TypeScript concept map

| In Python, you'd write… | In TypeScript, that becomes… |
|--------------------------|-------------------------------|
| multi-agent frameworks you may know (CrewAI, AutoGen), conceptually | hand-rolled orchestrator/sub-agent with the Vercel AI SDK or LangGraph.js |
| `SQLAlchemy` / `sqlite3` | `better-sqlite3` or an ORM (Drizzle, Prisma) |
| Python `logging` / OpenTelemetry | `pino` (structured logs) + simple span-style tracing |

## Day 6 Content

## Install Dependencies:

- install `better-sqlite3` or any  and its typescript type definiation:
```bash
npm install better-sqlite3
npm install @types/better-sqlite3
```

- install `pino` and its typescript type definition:
```bash
npm install pino @types/pino
```

## Day 6 TS Programming/Concepts

- use your experience to complete the multi-agent orchestration/Persistence/gurdrails lab, check the [Vercel AI SDK](https://ai-sdk.dev/docs/introduction) (feel free to use other), and fight with the documentation to build your first agent.

## Day 6 Hands-on Lab

#### Lab: Orchestrator + Persistent Memory (`tools.ts` + `multiAgent.ts` + `memory.ts` + `tui.ts`)

Build a two-agent system that remembers and reports its costs: an orchestrator delegates work to an executor sub-agent, every turn is saved to SQLite so a chat survives restarts, and every orchestrator step is logged as structured JSON with token usage. Reference files: `src/day6/tools.ts`, `multiAgent.ts`, `memory.ts`, `tui.ts`. Guardrails come in a later lab.

**1. Goal**

Understand four ideas and wire them together: sub-agent-as-tool, `ToolLoopAgent` statelessness (history must live outside the agent), a load → turn → save loop, and per-step usage logging as structured JSON. No copy-paste: read the reference files, then reconstruct the flow in your own words and code.

**2. Setup**

- Deps: Day 5 set plus `npm install better-sqlite3` (and `@types/better-sqlite3` as dev) and `npm install pino`.
- Env: project-root `.env` with `OPENCODE_API_KEY` + `TAVILY_API_KEY`. Optional: `LOG_LEVEL=debug` to raise log verbosity (default `info`).
- Logs land in `logs/<chatId>-<timestamp>.log` (or `logs/NOID-<timestamp>.log` for ephemeral runs) — one JSON line per orchestrator step.
- Note: the provider sends a stable `x-opencode-session` header per process (required by the opencode gateway) — don't regenerate it per turn.
- Run ephemeral (in-memory only): `npx tsx src/day6/tui.ts`
- Run persistent: `npx tsx src/day6/tui.ts --persist <chatId>` — quit with `/exit`, re-run with the same id, history must resume.
- Verify: `npx tsc --noEmit`.

**3. Tasks (think first, then write)**

1. **Tools (`tools.ts`):** reuse the five Day 5 tools unchanged for the executor. Ask yourself: why does the orchestrator never get these tools directly — what breaks if it does?
2. **Executor as a streaming tool (`multiAgent.ts`, `executorTool`):** a sub-agent wrapped in `tool()` whose `execute` is an `async function*`. Figure out: why stream instead of awaiting one result? What does the parent model actually receive back, and which piece of the tool definition controls that? What must happen to the MCP client even when the sub-agent throws?
3. **Persistence (`memory.ts`):** a `chats` table holding each chat's messages as JSON text, with create/load/save/list/delete helpers. Figure out: why store messages as a JSON `TEXT` column instead of one row per message? Why does `saveChat` fall back to `INSERT` when `UPDATE` touches zero rows?
4. **Persistent turn (`multiAgent.ts`, `runPersistentTurn`):** load history → append user message → convert → stream main agent → append assistant message → save. Figure out: the agent is stateless, so what exactly must be passed into `stream()` for it to "remember"? Why convert `UIMessage[]` before sending, and why keep the ephemeral executor away from the main history?
5. **Entry points (`tui.ts`):** ephemeral TUI vs persistent CLI selected by argv (`--persist`, bare chat id, or default). Figure out: why can't the stock `runAgentTUI` resume a chat on its own — what does the manual loop provide that it doesn't?
6. **Usage logging (`tui.ts` + `multiAgent.ts` `onStepFinish`):** one JSON line per orchestrator step — event name, step number, input/output/total tokens, finish reason. Figure out: why does each run get its own log file instead of appending to one shared file? Why is the logger passed down as an optional argument instead of a module-level global — what does that buy you for testing? Only the orchestrator's steps are logged, not the executor's — where would you hook in worker-side logging if you needed per-sub-task cost attribution?

**4. Acceptance checklist**

- [ ] Delegate a research question end-to-end; executor steps stream, final answer returns.
- [ ] In `--persist` mode: `/exit`, re-run with the same chat id, and the resumed history prints before your next prompt.
- [ ] A restart mid-conversation loses nothing already saved — confirm by checking the resume preview.
- [ ] After any run, `logs/` holds a `<chatId>-<timestamp>.log` file with one `agent.step.finish` JSON line per step, token counts included.
- [ ] `npx tsc --noEmit` passes.

**5. Coming next (don't build yet)**

- Guardrails: step limits, validated tool I/O, human-in-the-loop confirmation for risky tools.
