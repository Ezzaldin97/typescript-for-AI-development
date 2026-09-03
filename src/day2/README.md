# Advanced Types & Runtime Validation

## Learning objectives

- Write and read generic functions, interfaces, and constraints.
- Model state with discriminated unions and handle it exhaustively.
- Use/Understand core utility types: Partial, Required, Pick, Omit, Record, Readonly.
- Define Zod schemas and derive static types from them with z.infer, exactly the pattern behind LLM tool-call
schemas.

## Python => TypeScript concept map

| In Python, you'd write… | In TypeScript, that becomes… |
|--------------------------|-------------------------------|
| `TypeVar` / `Generic[T]` | `function f<T>(x: T): T` / `interface Box<T>` |
| Pydantic `BaseModel` | Zod schema: `z.object({ ... })` |
| `model.model_validate(data)` | `schema.parse(data)` / `schema.safeParse(data)` |
| `Literal['a','b']` + `if`/`elif` | discriminated union + exhaustive `switch` |
| `TypedDict(total=False)` | `Partial<T>` |
| `dict[str, int]` | `Record<string, number>` |

## Core concepts to cover

- Generics: generic functions, generic interfaces, constraining with extends.
-  Union types and discriminated (tagged) unions -> the natural shape for "what kind of step did the agent just
take?"
-  Type narrowing: typeof, instanceof, the in operator, custom type guards, exhaustiveness checks with never.
-  Utility types: Partial<T>, Required<T>, Pick<T,K>, Omit<T,K>, Record<K,V>, Readonly<T>.
- Zod in depth
- Optional: classes in JS/TS.

## Day 2 Content

### Install additional dependencies:

Install [Zod](https://v3.zod.dev/) to handle schema validation
```bash
npm install zod
```

### Day 2 TS Programming/Concepts

- Cover Generics and Classes(Optional), check `index.ts`, to cover these topics, I recommend to check:

    - [Learn Typescript 2022 playlist - Elzero Web School(Arabic Content)](https://www.youtube.com/playlist?list=PLDoPjvoNmBAy532K9M_fjiAmrJ0gkCyLJ)
    - [Typescript Guide](https://www.convex.dev/typescript)

- Cover Zod Schema Validation, check `zodSchemaValidation.ts`, to cover this topic, I recommend to check and try with the official documentation of [Zod](https://v3.zod.dev/)

## Day 2 Hands-on Lab

#### Lab: Agent Steps Validator (`schema.ts`)

Build a runtime-validated agent-step runner: read untrusted `data/agent-steps.json`, validate with Zod, derive static types, and handle each step exhaustively. Reference implementation: `src/day2/schema.ts`.

**1. Goal**

Practice Day 2 concepts: generics, discriminated unions, narrowing + `never` exhaustiveness, utility types, and Zod (`z.object`, `z.discriminatedUnion`, `z.infer`, `parse` vs `safeParse`) the exact pattern behind LLM tool-call schemas. Input is an array of ~50 steps like:

```json
{ "type": "tool_call", "name": "get_weather", "input": { "city": "Paris", "unit": "celsius" } }
{ "type": "final_answer", "text": "The weather in Paris is currently 18°C and partly cloudy." }
{ "type": "error", "message": "Invalid ticker symbol: ZZZQ" }
```

Expected output (first 5 lines):

```text
execute get_weather tool with paramters: [object Object]
execute calculator tool with paramters: [object Object]
Agent: The weather in Paris is currently 18°C and partly cloudy.
execute get_stock_price tool with paramters: [object Object]
Error Ocurred: Invalid ticker symbol: ZZZQ
```

**2. Setup**

- Dataset: `data/agent-steps.json` (array, no header).
- Work in new file `src/day2/schema.ts` (don't modify the reference file until you've tried yourself).
- Install: `npm install zod`.
- Run dev mode with `npx tsx src/day2/schema.ts`, prod mode with `npm run build && node dist/day2/schema.js`.

**3. Tasks**

1. **Model the union with Zod (Pydantic `BaseModel` equivalent):**
   ```ts
   const agentStepsSchema = z.discriminatedUnion('type', [
     z.object({ type: z.literal('tool_call'), name: z.string(), input: z.object() }),
     z.object({ type: z.literal('final_answer'), text: z.string().min(2) }),
     z.object({ type: z.literal('error'), message: z.string().min(2) }),
   ]);
   ```
   Python parallel: `Literal['tool_call', ...]` + `BaseModel` subclasses → single `z.discriminatedUnion('type', [...])` on the `type` tag.
2. **Derive the static type + array schema:**
   ```ts
   type agentSteps = z.infer<typeof agentStepsSchema>;
   const agentStepsArraySchema = z.array(agentStepsSchema);
   ```
   Note the direction: schema first, type second (opposite of Pydantic where class defines both).
3. **Type the reader (function-type + validated parse):**
   ```ts
   const readDataArrayWithZod = (filePath: string): agentSteps[] => {
     try {
       const data = fs.readFileSync(filePath, 'utf-8');
       const jsonData: agentSteps[] = agentStepsArraySchema.parse(JSON.parse(data));
       return jsonData;
     } catch (error) {
       console.log(`Error Occurred while reading the Data!: ${error}`);
       return [];
     }
   };
   ```
   Remember `JSON.parse` returns `any` — `agentStepsArraySchema.parse(...)` (like `model.model_validate`) is what makes it safe. Resolve path with `path.join(path.dirname(path.dirname(__dirname)), 'data', 'agent-steps.json')`.
4. **Handle exhaustively with narrowing:**
   ```ts
   const execute = (step: agentSteps): string => {
     switch (step.type) {
       case 'tool_call': return `execute ${step.name} tool with paramters: ${step.input}`;
       case 'error': return `Error Ocurred: ${step.message}`;
       case 'final_answer': return `Agent: ${step.text}`;
       default:
         const _exhaustive: never = step; // compiler error if a case is missing
         return _exhaustive;
     }
   };
   const callAgent = (agentSteps: agentSteps[]): void => {
     agentSteps.forEach((step) => console.log(execute(step)));
   };
   ```
   Try deleting a `case` — `tsc` must fail on the `never` assignment. This is the TS equivalent of exhaustive `Literal + if/elif` checking.
5. **Cover generics + utility types (not in minimal version — you add them):** e.g. generic `function first<T>(xs: T[]): T | undefined { return xs[0]; }` with `extends` constraint, plus `Partial<agentSteps>`, `Pick`, `Omit`, `Record<string, number>` (Python `TypedDict(total=False)` / `dict[str, int]` equivalents). Verify with `npx tsc --noEmit`.

**4. Acceptance checklist**

- [ ] `z.discriminatedUnion('type', ...)` with all 3 variants, no explicit `any`.
- [ ] Type derived via `z.infer`, array validated via `z.array(...).parse(JSON.parse(...))`.
- [ ] Bad JSON / schema mismatch returns `[]` instead of crashing.
- [ ] `execute` uses `switch` + `never` exhaustiveness; missing case fails `tsc`.
- [ ] Works via both `tsx` (dev) and `tsc` + `node dist/...` (prod).
- [ ] Generic helper + one utility-type (`Partial`/`Pick`/`Omit`/`Record`/`Readonly`) compiles under `npm run build`.
