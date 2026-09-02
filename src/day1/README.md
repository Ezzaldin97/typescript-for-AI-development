# TypeScript & Node.js Foundations

## Learning objectives

-  Install and configure a strict TypeScript project from scratch (Node.js LTS, pnpm, tsconfig.json).
- Explain how TypeScript's compile-time types differ from Python's optional runtime type hints.
- Use interfaces, type aliases, unions, and function types confidently.
- run/compile workflow (tsx vs tsc + node).

## Python => TypeScript concept map

| In Python, you'd write… | In TypeScript, that becomes… |
|--------------------------|-------------------------------|
| pip / venv / requirements.txt | npm or pnpm + package.json |
| python script.py | tsx src/index.ts (dev) or tsc && node dist/index.js (prod) |
| def f(x: int) -> str | function f(x: number): string |
| Optional[str] / None | string \| null (and, separately, string \| undefined) |
| f"{name} is {age}" | `${name} is ${age}` |
| duck typing | structural typing, checked by the compiler, not at call time |

## Day 1 Content

### Quickstart-friendly TypeScript template

there are templates for TS projects like [create-typescript-app](https://github.com/JoshuaKGoldberg/create-typescript-app), but for now let's create everything from scratch.

- Open your terminal and navigate to the directory where you want to create the project.
- create `./src` and `./dist` directories
- Run `npm init -y` in  your terminal.


### Install Dependencies

before installing dependencies read this carefully: [npm vs pnpm vs npx](https://earthly.dev/blog/npm-vs-npx-vs-pnmp/).

- installs TypeScript type definitions for Node.js core modules. When you're using TypeScript, it needs to know the types (function signatures, parameter types, return types, etc.) for the code you're using. Since Node.js is written in JavaScript, TypeScript doesn't know about Node.js's built-in modules by default.
```bash
npm install @types/node --save-dev
 ```
- install TypeScript as a dev dependency
```bash 
npm install typescript --save-dev
```
- initialize the TypeScript compiler:
```bash
npx tsc --init
```
- in `package.json` add the following to `scripts` section to build/compile compiled TS scripts.
```json
// this is the same of how to run scripts using uv in python
"scripts": {
    "build": "npx tsc",
    "watch": "npx tsc --watch"
  }
// to compile TS scripts, run `npm run build`
```

### Configure `tsconfig.json`

Our project uses a strict `tsconfig.json` at the repo root (see `../../tsconfig.json`).
Generated with `npx tsc --init`, then trimmed for Node.js (see https://aka.ms/tsconfig).
Only the uncommented options below are active — commented-out ones are intentionally left off for Day 1 ergonomics.

#### 1. File Layout

| Option | Value | Meaning |
|--------|-------|---------|
| `rootDir` | `"./src"` | All compilable `.ts` files must live under `src/`. Preserves folder structure on emit and errors if you import outside it. Think: enforce `src/` as source-of-truth (like `src/` layout in Python packaging). |
| `outDir` | `"./dist"` | Where `tsc` emits compiled `.js` (+ maps/declarations). `npm run build` → `node dist/index.js` for prod. `dist/` is excluded from compilation and git. |
| `include` | `["src/**/*"]` | Top-level (not in `compilerOptions`): only compile files under `src/`. |
| `exclude` | `["node_modules", "dist"]` | Top-level: never compile dependencies or previous build output. |

#### 2. Environment Settings (module / target)

| Option | Value | Meaning |
|--------|-------|---------|
| `module` | `"nodenext"` | Use Node.js-native module resolution + emit. Respects `package.json` `"type"` for ESM vs CJS, requires `.js` extensions in relative imports. Correct choice for modern Node. See https://aka.ms/tsconfig/module. |
| `target` | `"esnext"` | Emit modern JavaScript without downleveling. Assumes Node LTS supports it. No async/await or optional-chaining polyfills needed (unlike targeting `es2016` for old browsers). |
| `types` | `["node"]` | Only auto-include `@types/node` globals (`process`, `Buffer`, `__dirname`, etc.). Prevents leaking every `@types/*` package into global scope and speeds up compilation. Needs `npm install -D @types/node`. `lib` is left default (derived from `target`). |

#### 3. Other Outputs (debuggability / libraries)

| Option | Value | Meaning |
|--------|-------|---------|
| `sourceMap` | `true` | Emits `*.js.map` alongside output so stack traces/debuggers map back to original `.ts`. |
| `declaration` | `true` | Emits `*.d.ts` type-declaration files. Required if you publish as a library; harmless for apps. |
| `declarationMap` | `true` | Emits `*.d.ts.map` so Go-to-Definition on a `.d.ts` jumps to the `.ts` source. |

#### 4. Stricter Typechecking

| Option | Value | Meaning |
|--------|-------|---------|
| `strict` | `true` | Master switch. Enables `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables`. Main difference vs Python type hints: `null`/`undefined` are distinct checked types instead of runtime `None` errors. |
| `noImplicitAny` | `true` | (Also enabled by `strict`, listed explicitly for emphasis.) Error when TS would infer `any`, e.g. untyped function param. Forces explicit annotations. |
| `noUncheckedIndexedAccess` | `true` | Adds `undefined` to any index-signature access: `const v = obj[key]` → `T \| undefined`. Forces you to handle missing keys, like Python `dict.get()` vs `dict[]`. |

#### 5. Style / Lint-like Checks

| Option | Value | Meaning |
|--------|-------|---------|
| `noUnusedParameters` | `true` | Error on declared but unused function parameters. Prefix with `_` (`_req`) to intentionally ignore. Catches stale refactors early. |

#### 6. Recommended / Tooling Interop Options

| Option | Value | Meaning |
|--------|-------|---------|
| `jsx` | `"react-jsx"` | Use the React 17+ automatic JSX runtime (no `import React` needed per file). No-op for pure Node, but keeps template future-proof for React. |
| `verbatimModuleSyntax` | `false` | Allow TS to elide type-only imports automatically. If `true`, you'd be forced to write `import type { Foo }`. `false` = less friction for Day 1. |
| `isolatedModules` | `true` | Ensure each file transpiles in isolation (required by `tsx`, esbuild, SWC). Forbids features needing cross-file info like `const enum` or non-module ambient namespaces. |
| `noUncheckedSideEffectImports` | `true` | Type-check side-effect-only imports (`import "./setup"`): file must exist/resolve. Catches typos in polyfill/setup imports. |
| `moduleDetection` | `"force"` | Treat every `.ts` file as an ES module (as if it had `export {}`). Prevents accidental global-scope variables and Python-style “script” globals; you must use `import`/`export` explicitly. |
| `skipLibCheck` | `true` | Skip type-checking all `*.d.ts` library files for faster builds. Safe: libs are pre-checked, we only check our code. |

### Day 1 TS programming/concepts:

for Day 1 cover the following topics:

- Explain how TypeScript's compile-time types differ from Python's optional runtime type hints.
- cover and use: 
    - interfaces
    - type aliases
    - unions
    - function types.

to cover these topics, I recommend to check:

- [Learn Typescript 2022 playlist - Elzero Web School(Arabic Content)](https://www.youtube.com/playlist?list=PLDoPjvoNmBAy532K9M_fjiAmrJ0gkCyLJ)
- [Typescript Guide](https://www.convex.dev/typescript)

- Unfortunetly, unlike python, there is no jupyter notebook, so when you cover and finish all topics check/run/uncomment and run `index.ts` to test your understanding.

### Day 1 Hands-on Lab

#### Lab: Top-N Cited Paper Sorter (`paperSorter.ts`)

Build a small, strictly-typed CLI that reads `data/papers.json` and prints the top-N most-cited papers. Reference implementation: `src/day1/paperSorter.ts`.

**1. Goal**

Practice Day 1 concepts: `interface`, `type` alias, function types, unions — plus the strict `tsconfig.json` + run/compile workflow. Input is an array of ~50 papers like:

```json
{ "title": "Attention Is All You Need", "year": 2017, "citations": 118000 }
```

Expected output for `topCited(papers, 3)`:

```text
paper name: Deep Residual Learning for Image Recognition, published in: 2016, # of citations: 196000
paper name: Adam: A Method for Stochastic Optimization, published in: 2015, # of citations: 155000
paper name: ImageNet Classification with Deep Convolutional Neural Networks, published in: 2012, # of citations: 132000
```

**2. Setup**

- Dataset: `data/papers.json` (array, no header).
- Work in new file `src/day1/paperSorter.ts` (don't modify the reference file until you've tried yourself).
- Run dev mode with `npx tsx src/day1/paperSorter.ts`, prod mode with `npm run build && node dist/day1/paperSorter.js`.

**3. Tasks**

1. **Model the data with an `interface`:**
   ```ts
   interface Paper {
     title: string;
     year: number;
     citations: number;
   }
   ```
   Note how this differs from Python: checked at compile time, erased at runtime. Try passing `{ title: "x" }` and observe `tsc` failing where Python `mypy` would only warn.
2. **Type the reader with a function-type alias:**
   ```ts
   type ReadPapers = (path: string) => Paper[];
   ```
   Implement `const readData: ReadPapers = (filePath) => {...}` using `fs.readFileSync(filePath, 'utf-8')` + `JSON.parse`. Remember `JSON.parse` returns `any` — annotate as `Paper[]` and wrap in `try/catch`: log `Error Occured while reading the Data!: ${error}` and return `[]` on failure. Resolve path with `path.join(path.dirname(path.dirname(__dirname)), 'data', 'papers.json')`.
3. **Implement `topCited`:**
   ```ts
   const topCited = (allPapers: Paper[], n: number = 1): Paper[] => {
     return allPapers.sort((a, b) => b.citations - a.citations).slice(0, n);
   };
   ```
   Default `n = 1`. Call `topCited(papers, 3).forEach(...)` and print each with a template literal: `` `paper name: ${paper.title}, published in: ${paper.year}, # of citations: ${paper.citations}` `` (TS equivalent of Python f-string).
4. **Add a `union` (not in the minimal version — you add it):** e.g. `type PaperFilter = { kind: "top"; n: number } | { kind: "year"; year: number };` and filter accordingly. This satisfies the Day 1 unions objective.

**4. Acceptance checklist**

- [ ] `interface Paper` + function-type alias used, no explicit `any`.
- [ ] Missing file / bad JSON returns `[]` instead of crashing.
- [ ] `topCited(papers, 3)` prints 3 lines in descending `citations` order.
- [ ] Works via both `tsx` (dev) and `tsc` + `node dist/...` (prod).
- [ ] Extension with a union type compiles under `npm run build`.
