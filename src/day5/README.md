# Building Your First Real Agent

Move from a hand-rolled loop to a framework: multi-tool agents, conversation memory, and your first MCP server
connection.

## Learning Objectives

-  Compare the TypeScript agent-framework landscape and choose a default to go deep on.
- Build a multi-tool agent where the framework manages the tool-call loop.
- Add conversation memory across turns.
-  Connect to an MCP server and let the agent use its tools automatically.

## Python => TypeScript concept map

| In Python, you'd write… | In TypeScript, that becomes… |
|--------------------------|-------------------------------|
| LangGraph (Python) | Vercel AI SDK `generateText` / `streamText` with tools, or LangGraph.js |
| CrewAI / AutoGen conceptually | Vercel AI SDK multi-step tool calling (`maxSteps`) |
| a Python MCP client/server | the same MCP protocol, TypeScript client/server |

## Day 5 Content

### Install Dependencies

- install the following dependencies to build our first agent in TS:
```bash
npm install @ai-sdk/openai-compatible
npm install ai
npm install @ai-sdk/tui
npm install @modelcontextprotocol/server-filesystem ## stdio MCP
```

### Day 5 TS Programming/Concepts

- use your experience in building agents, check the [Vercel AI SDK](https://ai-sdk.dev/docs/introduction) (feel free to use other), and fight with the documentation to build your first agent.

## Day 5 Hands-on Lab

feel free to use any TS framework.

#### Lab: Multi-Tool Framework Agent with MCP (`tools.ts` + `agentV1.ts`)

Move from the Day 4 hand-rolled loop to a framework-managed loop: define 5 typed tools in `tools.ts`, then consume them (plus MCP filesystem tools) from a `ToolLoopAgent` in `agentV1.ts` via TUI. Reference implementation: `src/day5/tools.ts` + `src/day5/agentV1.ts`.

**1. Goal**

Practice the framework pattern (Python `AgentExecutor` / CrewAI conceptually → Vercel AI SDK `ToolLoopAgent`): `tool({ description, inputSchema, outputSchema?, execute })` definitions used directly by the agent — no manual `switch` dispatch like Day 4.

**2. Setup**

- Deps: `ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/tui`, `@ai-sdk/mcp`, `@modelcontextprotocol/server-filesystem`, `@modernized/arxiv-api`, `@tavily/core`, `dotenv`, `zod`.
- Env: project-root `.env` with `OPENCODE_API_KEY` + `TAVILY_API_KEY`. Note: `agentV1.ts` resolves it correctly with `path.dirname(path.dirname(__dirname))`; `tools.ts` uses single `dirname` (`src/.env`) so it only works when imported via the agent — rely on the agent's `dotenv.config`.
- Provider: `createOpenAICompatible({ name: 'opencode', apiKey, baseURL: "https://opencode.ai/zen/go/v1" })`, model `glm-5.3-flash`.
- Run (interactive — already running, don't start a second instance): `npx tsx src/day5/agentV1.ts` → `runTUI()` titled `automata`. Headless alternative is the commented-out `invokeAgent('what are the latest news about nvidia??')`.

**3. Tasks**

1. **Define the toolset in `tools.ts` (used verbatim by the agent):**
   - `calculatorTool`: `inputSchema z.object({ operation: z.enum(['add','subtract','multiply','divide','power']), a, b })` + `outputSchema { ..., result, formatted }`; `execute` switches on `operation` (throw on divide-by-zero / unknown op).
   - `searchPapersTool`: `inputSchema { topic, maxResults: z.number().gt(0) }`, `outputSchema z.array({ paperURL, title, summary, published, updated })`; `execute` calls arXiv `search()` and maps `papers.entries`; `catch` → `[]`.
   - `currentDateTimeTool`: `inputSchema { format: z.enum([...]).default('full'), timezone: z.string().default('UTC') }`; `execute` formats with `Intl.DateTimeFormat` + fallback on bad timezone.
   - `webSearchTool`: `inputSchema { query }`; `execute` via `tvly.search(query, { maxResults: 3, includeAnswer: true })` → `{ process, results, answer }`, errors → `{ process: 'failed', error }`.
   - `webExtractTool`: `inputSchema { urls: z.array(z.string()) }`; `execute` via `tvly.extract(urls)` → `{ title, content (500 chars) }`.
2. **Build the agent in `agentV1.ts`:**
   ```ts
   const agent = new ToolLoopAgent({
     model: provider('glm-5.3-flash'),
     instructions: 'You are helpfull assistant.',
     tools: { calculator: calculatorTool, searchPapers: searchPapersTool, currentDateTime: currentDateTimeTool, webSearch: webSearchTool, webExtract: webExtractTool, ...mcpTools },
     maxRetries: 5, onStepFinish, prepareStep,
   });
   ```
   `onStepFinish` logs `[step N] finishReason · tools · tokens`; `prepareStep` compacts with `pruneMessages` when `estimateTokens(messages) = len/4 > 100_000`.
3. **Attach MCP filesystem tools:** `getMCPClient()` → `createMCPClient({ transport: new StdioClientTransport({ command: 'npx', args: ['@modelcontextprotocol/server-filesystem', '/workspaces/typescript-for-AI-development'] }) })`, then `await mcpClient.tools()` spread into `tools` (same MCP protocol as a Python MCP client/server).
4. **Stream / interact:** headless `invokeAgent` uses `agent.stream({ prompt })` + `for await (const part of result.fullStream)` switching on `text-delta` / `tool-call` / `tool-result` / `finish`; TUI path `getAgent(mcpTools)` + `runAgentTUI({ title: 'automata', agent, tools: 'auto-collapsed', reasoning: 'full', responseStatistics: 'outputTokenCount', contextSize: 200_000 })`.

**4. Acceptance checklist**

- [ ] All 5 tools defined with `description` + Zod `inputSchema` and imported by name into the agent, no per-tool `if` dispatch.
- [ ] MCP filesystem tools merged via spread; agent lists local + MCP tools in TUI.
- [ ] Multi-step calls observed in TUI / `[step N]` logs; bad tool input surfaces as tool error, not a crash.
- [ ] `npx tsc --noEmit` passes; only one TUI instance running at a time.
