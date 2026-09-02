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

