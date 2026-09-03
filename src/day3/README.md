# Async Patterns, Tooling

## Learning Objectives

- Use async/await, Promise.all/allSettled, and understand the Node event loop at a working level.
- Consume streamed data with async iterators (for await...of) how token streaming works under the hood.
- run lint/format with ESLint + Prettier.
- Handle secrets and environment variables the Node way.

## Python => TypeScript concept map

| In Python, you'd write… | In TypeScript, that becomes… |
|--------------------------|-------------------------------|
| `async def` / `await` | `async function` / `await` |
| `asyncio.gather(*tasks)` | `Promise.all([...tasks])` |
| `async for chunk in stream:` | `for await (const chunk of stream) { }` |
| `ruff` / `black` | `eslint` / `prettier` |
| `python-dotenv` | `dotenv` (or built-in Node `--env-file`) |

## Day 3 Content

### Install Dependencies

before installing the linting/formatting dependencies check the following resources:

- [Linting in TypeScript using ESLint and Prettier](https://blog.logrocket.com/linting-typescript-eslint-prettier/)
- [TS v7 problems with eslint](https://typescript-eslint.io/users/dependency-versions/)

then start the installation and configuration

- because `typescript-eslint` is incompatible with `typescript^7`, the version range of TypeScript currently supported by typescript-eslint is >=4.8.4 <6.1.0, so TS 7.0.2 is outside what it accepts. we need to downgrade Typescript then install `eslint` for linting [eslint TS supported versions](https://typescript-eslint.io/users/dependency-versions/)
```bash
npm install typescript@^5.9 --save-dev
npm install eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin --save-dev
```
- create a configuration file using the CLI. Run the following command in the terminal:
```bash
npx eslint --init
```
- stick with the below configuration:
```ts
import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  // Base ESLint recommended rules
  eslint.configs.recommended,
  
  // TypeScript ESLint recommended rules
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        // Add other globals if needed:
        process: "readonly",
        __dirname: "readonly",
        setTimeout: "readonly",
        // __filename: "readonly",
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "no-unused-vars": "error",
      "no-undef": "error",
      "prefer-const": "error",
      "no-console": "warn",
    },
  },
  
  // Global ignore patterns
  {
    ignores: ["dist/**", "node_modules/**"],
  },
];
```
- add the following to scripts in `package.json` to be able to execute linting using `npm run`
```json
"scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
}
```
- add Prettier to our project. Run the following command in the terminal:
```bash
npm install --save-dev prettier
```
- create `.prettierrc.json` to set the configuration, for now stick with following: 
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "semi": true
}
```
- add the following to scripts in `package.json` to be able to execute formatting using `npm run`
```json
"scripts": {
    "format": "prettier --ignore-path .gitignore --write \"./src/**/*.+(js|ts|json)\"",
    "format:fix": "prettier --write src"
}
```
- run the following and check the result/output in terminal:
```bash
npm run lint
npm run format
```

### Day 3 TS Programming/Concepts

- cover Promises, callbacks, async/await and event loop in Javascript, then check `index.ts`.
use the following materials to cover these topics:
    - [JS event loop, Prommise, async/await fundamentals](https://www.digitalocean.com/community/tutorials/understanding-the-event-loop-callbacks-promises-and-async-await-in-javascript)
    - [Callbacks, Promises, async/await short tutorial(Arabic)](https://www.youtube.com/watch?v=2dBPEOyqubU)

- cover the iterator and generators from [Understanding TypeScript Async Generator Return Types](https://www.xjavascript.com/blog/typescript-async-generator-return-type/).
you should have a full understanding of what's iterators and generators from python.

- check how handle secrets and env variables using `dotenv` from [Using Environment Variables in TypeScript with dotenv](https://medium.com/@sushantkadam15/using-environment-variables-in-typescript-with-dotenv-dc0c35939059)

## Day 3 Hands-on Lab

#### Lab: Token Stream Simulator (`streamDemo.ts`)

Simulate LLM token streaming with an `async` generator + `for await...of`, validated with Zod. Reference implementation: `src/day3/streamDemo.ts`.

**1. Goal**

Practice Day 3 concepts: `async`/`await`, `AsyncGenerator`, `for await...of` (Python `async for`), sequential vs concurrent execution (Python `asyncio.gather` vs `Promise.all`), plus Zod validation. Input is `data/token-stream.json` (5 prompts):

```json
{ "id": "stream-1", "prompt": "What's the weather like in Cairo today?", "delayMs": 40, "tokens": ["It's", "currently", "34°C", "..."] }
```

Expected output:

```text
Starting token streaming...

User: What's the weather like in Cairo today?
Assistant:
It's currently 34°C and sunny in Cairo, with light winds.
--------------------------------------------------
...
All responses streamed successfully!
```

**2. Setup**

- Dataset: `data/token-stream.json` (array of `{ id, prompt, delayMs, tokens }`).
- Work in new file `src/day3/streamDemo.ts` (don't modify the reference file until you've tried yourself).
- Run dev mode with `npx tsx src/day3/streamDemo.ts`, prod mode with `npm run build && node dist/day3/streamDemo.js`.

**3. Tasks**

1. **Validate input with Zod (Day 2 reuse):**
   ```ts
   const responseSchema = z.object({
     id: z.string(),
     prompt: z.string(),
     delayMs: z.number(),
     tokens: z.array(z.string()).nonempty(),
   });
   type response = z.infer<typeof responseSchema>;
   const responseArraySchema = z.array(responseSchema);
   ```
   Implement `readDataArrayWithZod(filePath: string): response[]` with `fs.readFileSync` + `responseArraySchema.parse(JSON.parse(data))`, `try/catch` → `[]` on failure. Resolve path with `path.join(path.dirname(path.dirname(__dirname)), 'data', 'token-stream.json')`.
2. **Write the `async` generator (Python `async def` + `yield` equivalent):**
   ```ts
   async function* streamTokens(tokensList: string[], delay: number): AsyncGenerator<string, void, unknown> {
     for (const token of tokensList) {
       await new Promise((r) => setTimeout(r, delay));
       yield token;
     }
   }
   ```
   Each `await setTimeout` yields to the Node event loop — no thread is blocked (unlike `time.sleep`).
3. **Consume with `for await...of` (Python `async for` equivalent):**
   ```ts
   const recieveTokenStreams = async (response: response) => {
     console.log(`User: ${response.prompt}`);
     console.log('Assistant: ');
     for await (const token of streamTokens(response.tokens, response.delayMs)) {
       process.stdout.write(token + ' ');
     }
     console.log('\n' + '-'.repeat(50));
   };
   ```
   `process.stdout.write` keeps tokens on one line; `console.log` would add a newline per token.
4. **Run sequentially + handle errors:**
   ```ts
   async function main() {
     console.log('Starting token streaming...\n');
     for (const response of llmResponses) {
       await recieveTokenStreams(response); // sequential: avoids mixing streams
     }
     console.log('All responses streamed successfully!');
   }
   main().catch(console.error);
   ```
   Note: `for...of` + `await` = sequential. `Promise.all(llmResponses.map(recieveTokenStreams))` (Python `asyncio.gather`) = concurrent but interleaves stdout.
5. **Apply Day 3 tooling (not in `streamDemo.ts` — you add it):** run `npm run lint` / `npm run format`, fix any `no-console` warnings. Verify with `npx tsc --noEmit`.

**4. Acceptance checklist**

- [ ] Zod schema validates array; bad JSON / empty `tokens` returns `[]` instead of crashing.
- [ ] `streamTokens` is an `AsyncGenerator` with `await setTimeout` + `yield`.
- [ ] Tokens consumed via `for await...of` and printed on one line per response.
- [ ] Responses stream sequentially (`await` in loop); `main().catch` handles rejections.
- [ ] Works via both `tsx` (dev) and `tsc` + `node dist/...` (prod).
- [ ] `npm run lint` / `npm run format` pass.
