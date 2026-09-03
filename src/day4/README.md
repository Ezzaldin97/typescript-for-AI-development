# LLM SDKs, Tool Use & Structured Output

Talk to LLM from TypeScript, stream responses, and hand-build a single-tool agent loop so you understand every
moving part before reaching for a framework.

## Learning Objectives

- Call LLM Provider TypeScript SDK for both streaming and non-streaming completions.
- Define a tool schema with Zod and convert it to the JSON schema the API expects.
- Implement the full tool_use fi execute fi tool_result loop by hand.
- Validate structured model output against a Zod schema before trusting it.

## Python => TypeScript concept map

| In Python, you'd write… | In TypeScript, that becomes… |
|--------------------------|-------------------------------|
| `anthropic.messages.create(...)` | `client.messages.create({...})` (`@anthropic-ai/sdk`) |
| `with client.messages.stream(...) as s:` | `for await (const e of client.messages.stream({...}))` |
| function calling / `tools=[...]` | `tools: [...]` with a Zod-derived JSON schema |
| pydantic `.model_json_schema()` | `zod-to-json-schema(ZodObject)` |

## Day 4 Content

### Installing Dependencies

- for day 4 Hands-onn Lab we need to install the following:
```bash
npm install dotenv
npm install openai
npm install @modernized/arxiv-api
```

### Day 4 TS Programming/Concepts

this day, you will use what you already know about agents, chatbots, tools etc..
but create everything in Typescript.
check LLM Typescript SDKs, I used [OpenAI SDK](https://developers.openai.com/api/reference/typescript)

## Day 4 Hands-on Lab

the following Reference Implementations use Opencode(OpenAI-Compatible LLM Provider), but feel free to use your favourite provider.

#### Lab A: Streaming Chat with Memory (`chat.ts`)

Build an interactive streaming chatbot with validated in-memory history. Reference implementation: `src/day4/chat.ts`.

**1. Goal**

Practice LLM SDK streaming + Zod-validated memory: `client.chat.completions.create({ stream: true })` with `for await...of` (Python `with stream() as s` equivalent), plus `z.discriminatedUnion('role', ...)` for `system/user/assistant` messages.

**2. Setup**

- Deps: `npm install dotenv openai` (arXiv not needed for this lab).
- Env: project-root `.env` with `OPENCODE_API_KEY=...`. Loaded via `dotenv.config({ path: path.join(path.dirname(path.dirname(__dirname)), '.env') })`.
- Client: `new OpenAI({ apiKey: process.env['OPENCODE_API_KEY'], baseURL: "https://opencode.ai/zen/go/v1" })`.
- Run: `npx tsx src/day4/chat.ts`, prod: `npm run build && node dist/day4/chat.js`. Type `exit` to quit.

**3. Tasks**

1. **Model history with Zod:**
   ```ts
   const chatHistorySchema = z.discriminatedUnion('role', [
     z.object({ role: z.literal('system'), content: z.string().min(1) }),
     z.object({ role: z.literal('user'), content: z.string().min(1) }),
     z.object({ role: z.literal('assistant'), content: z.string().min(1) }),
   ]);
   type chatHistory = z.infer<typeof chatHistorySchema>;
   const chatHistoryArraySchema = z.array(chatHistorySchema).optional().default([]);
   ```
2. **Implement memory:** `let history: chatHistoryArray = []`; `insertIntoMemory(input): boolean` via `chatHistorySchema.parse` + `push` (`false` on error); `fetchMemory()` returns `[{ role: "system", content: "You are a coding assistant" }, ...history]`.
3. **Stream a reply:**
   ```ts
   const stream = await client.chat.completions.create({
     model: 'glm-5.3-flash', messages: currentHistory, stream: true, max_completion_tokens: 512,
   });
   for await (const event of stream) {
     const content = event.choices[0]?.delta?.content || '';
     // process.stdout.write(content) + accumulate fullResponse
   }
   insertIntoMemory({ role: "assistant", content: fullResponse });
   ```
4. **Add the REPL:** `readline.createInterface`, `askQuestion` promise wrapper, `while (running)` loop handling `exit` / empty input, `await callLLM(trimmedInput)` per turn.

**4. Acceptance checklist**

- [ ] History validated via discriminated union; bad inserts return `false`, never crash.
- [ ] System prompt prepended on every call; user + assistant turns accumulate.
- [ ] Tokens stream on one line via `process.stdout.write`; full reply saved to memory.
- [ ] `exit` closes `readline`; empty input re-prompts.
- [ ] `npx tsc --noEmit` passes.

#### Lab B: Single-Tool Agent Loop (`toolLoop.ts`)

Hand-build the `tool_use → execute → tool_result` loop with one arXiv tool. Reference implementation: `src/day4/toolLoop.ts`.

**1. Goal**

Understand every moving part before frameworks: Zod request/response schemas → JSON-schema `tools` → streaming `client.responses.create` → manual dispatch → follow-up summarization. Single prompt: `"Search for papers about adaptive agents"`.

**2. Setup**

- Deps: `npm install dotenv openai @modernized/arxiv-api`.
- Same `.env` / client as Lab A.
- Run: `npx tsx src/day4/toolLoop.ts` (non-interactive).

**3. Tasks**

1. **Define tool I/O with Zod:**
   ```ts
   const searchPapersRequestSchema = z.object({ topic: z.string().nonempty(), maxResults: z.number().gt(0) });
   const searchPapersResultSchema = z.array(z.object({
     paperURL: z.string().nonempty(), title: z.string().nonempty(), summary: z.string().nonempty(),
     published: z.string().nonempty(), updated: z.string().nonempty(),
   }));
   ```
2. **Implement `searchPapers`:** call `search({ searchQueryParams: [{ include: [{ name: params.topic }] }], start: 0, maxResults })`, map `papers.entries` → `{ paperURL: paper.id, title, summary, published, updated }`; `catch` → `[]`.
3. **Declare the tool (Zod → JSON schema by hand):**
   ```ts
   const tools: OpenAI.Responses.Tool[] = [{
     type: "function", name: "search_papers",
     description: "Search for papers on arXiv based on a topic.",
     parameters: { type: "object", properties: { topic: { type: "string", ... }, maxResults: { type: "number", ... } },
       required: ["topic", "maxResults"], additionalProperties: false }, strict: true,
   }];
   ```
   (Python parallel: `tools=[...]`; Pydantic `.model_json_schema()` → here hand-written, stretch: generate with `zod-to-json-schema`.)
4. **Implement `executeTool`:** `if (toolCall.name === 'search_papers')` → `searchPapersRequestSchema.parse(JSON.parse(toolCall.arguments))` → `await searchPapers(...)` → `JSON.stringify(searchPapersResultSchema.parse(results))`; errors → `JSON.stringify({ error })`.
5. **Run the streamed loop:** `client.responses.create({ model: 'gpt-5.6-luna', instructions, input: prompt, tools, tool_choice: 'auto', stream: true })`, then `for await` handling `response.output_text.delta` (print), `response.output_item.added` (capture `function_call`), `response.function_call_arguments.delta` (accumulate), `response.function_call_arguments.done` (execute + follow-up `client.responses.create({ input: prompt + tool result, stream: true })` streamed under `Summary:`), `response.completed`.

**4. Acceptance checklist**

- [ ] Bad tool args / arXiv errors return JSON error string, never throw.
- [ ] Tool result validated with `searchPapersResultSchema` before the follow-up call.
- [ ] Streaming text, tool-call capture, execution, and summary all observed in one run.
- [ ] `npx tsc --noEmit` passes.
