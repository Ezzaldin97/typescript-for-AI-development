# Typescript for AI development

## Program at a Glance

Seven focused days that take you from a bare TypeScript project to a deployed, multi-tool AI agent, reusing
everything you already know about types, validation, and testing from Python, and mapping it explicitly onto the
TypeScript/Node ecosystem as you go.

| Day                                                                                     | Focus                                               | Key Deliverable                                                                                                                   |
| --------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [Day 1](./src/day1/README.md)                                                           | TypeScript & Node.js Foundations                    | A strict-mode TS project that runs via `pnpm tsx src/index.ts`, containing a fully-typed paper-sorter script with no `any`.       |
| [Day 2](./src/day2/README.md)                                                           | Advanced Types & Runtime Validation                 | schemas.ts with three Zod schemas plus inferred types, and a discriminated-union step handler with exhaustiveness checking.       |
| [Day 3](./src/day3/README.md)                                                           | Async Patterns, Tooling                             | fetchWithRetry.ts, streamDemo.ts, and a clean lint run.                                                                           |
| [Day 4](./src/day4/README.md)                                                           | LLM SDKs, Tool Use & Structured Output              | chat.ts (streaming chatbot) and toolLoop.ts (a working, hand-rolled single-tool agent loop).                                      |
| [Day 5](./src/day5/README.md)                                                           | Building Your First Real Agent                      | agentV1.ts, a working multi-tool agent with conversation memory, using a framework plus at least one MCP-provided tool.           |
| [Day 6](./src/day6/README.md)                                                           | Multi-Agent Orchestration, Persistence & Guardrails | multiAgent.ts and db.ts, a persisted, guarded, two-agent system with structured logs.                                             |
| Day 7                                                                                   | Capstone: Build & Ship a Complete Agent App         | A deployed, working agent application with a live URL, a README covering architecture and limitations, and a short written retro. |

## Prerequisites & Setup

- Node.js LTS (v20+) installed, plus pnpm enabled via corepack.
- VS Code with the TypeScript, ESLint, and Prettier extensions.
- An Anthropic/OpenAI(OpenAI-Compatible) API key, available as an environment variable.
- Git
- Assumed background:
  - fluent Python with type hints
  - hands-on Pydantic and FastAPI experience
  - comfort with REST/JSON, at least one prior LLM API call made from Python.

## Resources and Additional Materials

- [Learn Typescript 2022 playlist - Elzero Web School(Arabic Content)](https://www.youtube.com/playlist?list=PLDoPjvoNmBAy532K9M_fjiAmrJ0gkCyLJ)
- [Typescript Guide](https://www.convex.dev/typescript)
- [JS event loop, Prommise, async/await fundamentals](https://www.digitalocean.com/community/tutorials/understanding-the-event-loop-callbacks-promises-and-async-await-in-javascript)
- [Callbacks, Promises, async/await short tutorial(Arabic)](https://www.youtube.com/watch?v=2dBPEOyqubU)
- [Zod V3](https://v3.zod.dev/)
- [OpenAI TS SDK](https://developers.openai.com/api/reference/typescript)
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction)
- [Langchain/LangGraph JS](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [MCP Guide](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro)
