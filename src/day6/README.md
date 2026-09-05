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

- use your experience to complete the multi-agent orchestration/Persistence/gurdrails lab, check the [Vercel AI SDK](https://ai-sdk.dev/docs/introduction) (feel free to use other), and fight with the documentation to build your first agent.

## Day 6 Hands-on Lab

#### Lab: Orchestrator + Executor Sub-Agent (`tools.ts` + `multiAgent.ts`)

Hand-roll the CrewAI/AutoGen-style orchestrator/worker pattern with the Vercel AI SDK: the main agent delegates research tasks to an executor sub-agent *exposed as a streaming tool*. Reference implementations: `src/day6/tools.ts` (270 lines, same 5-tool set as Day 5) + `src/day6/multiAgent.ts` (146 lines). Persistence & guardrails will be layered on in a follow-up lab.

**1. Goal**

Practice multi-agent orchestration: a `ToolLoopAgent` (orchestrator, `omen-alpha`) whose only tool `executor` spawns a second `ToolLoopAgent` (worker, `glm-5.3-flash` + all 5 tools + MCP filesystem tools) and streams its progress back via an `async function*` `execute`.

**2. Setup**

- Deps: same as Day 5 — `ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/tui`, `@ai-sdk/mcp`, `@modelcontextprotocol/server-filesystem`, `@modernized/arxiv-api`, `@tavily/core`, `dotenv`, `zod`.
- Env: project-root `.env` with `OPENCODE_API_KEY` + `TAVILY_API_KEY`. `multiAgent.ts` resolves it with double `path.dirname`; `tools.ts` uses single `dirname` (`src/.env`) — it only works when imported via `multiAgent.ts`'s `dotenv.config`.
- Run (interactive TUI titled `automata`, tools `full`, reasoning `full`): `npx tsx src/day6/multiAgent.ts`. Don't run a second instance while one is open.

**3. Tasks**

1. **Reuse the toolset (`tools.ts`):** copy Day 5's five `tool()` definitions (`calculatorTool`, `searchPapersTool`, `currentDateTimeTool`, `webSearchTool`, `webExtractTool`) with their Zod `inputSchema`/`outputSchema` — unchanged, exported for the executor.
2. **Build the executor (worker) agent:**
   ```ts
   const executorAgent = (mcpTools?: any) => new ToolLoopAgent({
     model: provider('glm-5.3-flash'),
     instructions: `You are intelligent executor agent. Complete the task autonomously.
       IMPORTANT: When you have finished, write a clear summary of your findings as your final response.
       This summary will be returned to the main agent, so include all relevant information.`,
     tools: { calculator, searchPapers, currentDateTime, webSearch, webExtract, ...mcpTools },
     maxRetries: 5, onStepFinish, prepareStep, // step logging + pruneMessages above 100k est. tokens
   });
   ```
3. **Expose the sub-agent as a streaming tool (the key pattern):**
   ```ts
   const executorTool = tool({
     description: 'Execution tool to search, search research topics, calculate, and interact with filesystem. just give it clear task.',
     inputSchema: z.object({ task: z.string().nonempty() }),
     execute: async function* ({ task }, { abortSignal }) {
       const fsMCP = await getMCPClient();
       const fsTools = await fsMCP.tools(); // note: reference file misses `await` — add it
       const execSubagent = executorAgent(fsTools);
       try {
         const result = await execSubagent.stream({ prompt: task, abortSignal });
         for await (const message of readUIMessageStream({
           stream: toUIMessageStream({ stream: result.stream }),
         })) {
           yield message; // each yield = accumulated UIMessage
         }
       } finally {
         await fsMCP.close();
       }
     },
     toModelOutput: ({ output: message }) => ({
       type: 'text',
       value: message?.parts.findLast(p => p.type === 'text')?.text ?? 'Task completed.',
     }),
   });
   ```
   `async function*` makes the tool stream; `toModelOutput` is what the orchestrator model actually sees (only the worker's final summary).
4. **Build the orchestrator (planner) agent:**
   ```ts
   const mainAgent = () => new ToolLoopAgent({
     model: provider('omen-alpha'),
     instructions: `You are intelligent assistant that supported with executor.
       Your Task is to understand the objective of the given question, and delegate tasks
       to executor then return the answer after finalize the requirements.`,
     tools: { executor: executorTool },
   });
   ```
5. **Run interactively:** `runTUI()` → `runAgentTUI({ title: 'automata', agent, tools: 'full', reasoning: 'full', responseStatistics: 'outputTokenCount', contextSize: 200_000 })` and delegate a research question end-to-end.

**4. Acceptance checklist**

- [ ] Orchestrator has exactly one tool (`executor`); worker has the 5 local tools + MCP filesystem tools.
- [ ] Sub-agent streams through `readUIMessageStream` + `toUIMessageStream`; orchestrator only receives the final text summary via `toModelOutput`.
- [ ] MCP client closed in `finally`; `abortSignal` forwarded to the sub-agent.
- [ ] Missing `await` on `fsMCP.tools()` in `executorTool` fixed (compare Day 5 `agentV1.ts`).
- [ ] `npx tsc --noEmit` passes; only one TUI instance at a time.

**5. Stretch goals / Coming next**

- Persistence (next lab): save conversation state with `better-sqlite3` (Python `sqlite3` parallel) so a session resumes after restart.
- Guardrails (next lab): step limits, schema-validated tool I/O, human-in-the-loop confirmation for risky tools.
- Observability (next lab): swap `console.log` for `pino` structured logs + simple span-style tracing.
- Generalize: make `executorTool` take a worker-agent id so the orchestrator can pick among multiple specialists.
