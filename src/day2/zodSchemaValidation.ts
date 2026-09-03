import { z } from 'zod';

const myFirstSchema = z.string().nonempty();

try {
  myFirstSchema.parse('Hi!!!');
  myFirstSchema.parse(1000); // should throw an error
  console.log('Safe!!');
} catch (error) {
  console.log(`Error Occurred when validating the scehma: ${error}`);
}

// safe mode doesn't throw an error....
myFirstSchema.safeParse('Hi!!!');
myFirstSchema.safeParse(100);

const User = z.object({
  username: z.string(),
});

User.parse({ username: 'Ludwig' });

//type User = z.infer<typeof User>;

const schema = z.coerce.string();
console.log(schema.parse('tuna')); // => "tuna"
console.log(schema.parse(12)); // => "12"

const emailSchema = z.email({ message: 'Invalid email address' });
console.log(emailSchema.parse('hi@example.com'));

const textLengthSchema = z.string().min(2).max(10);
console.log(textLengthSchema.parse('Ezz'));

const InputNumberSchema = z.number().gt(3);
console.log(InputNumberSchema.parse(5));

const Dog = z.object({
  name: z.string(),
  age: z.number(),
});

// extract the inferred type like this
type Dog = z.infer<typeof Dog>;

// equivalent to
/*type Dog = {
  name: string;
  age: number;
};*/

// Literals, Enums & Unions
// Python parallel: Literal['a', 'b'] -> z.literal / z.enum / z.union

const directionSchema = z.union([z.literal('up'), z.literal('down')]);
console.log(directionSchema.parse('up')); // => "up"

const roleSchema = z.enum(['admin', 'user', 'guest']);
console.log(roleSchema.parse('admin')); // => "admin"

const stringOrNumberSchema = z.union([z.string(), z.number()]);
console.log(stringOrNumberSchema.parse('hello')); // => "hello"
console.log(stringOrNumberSchema.parse(42)); // => 42

// Optional, Nullable, Default & Catch
// Python parallel: Optional[str] / None, Field(default=...)

const optionalSchema = z.object({
  nickname: z.string().optional(), // string | undefined
  bio: z.string().nullable(), // string | null
  country: z.string().default('Unknown'), // default when undefined
  score: z.number().catch(0), // fallback on invalid input
});

console.log(optionalSchema.parse({ bio: null })); // => { bio: null, country: 'Unknown', score: 0 }
console.log(optionalSchema.parse({ nickname: 'Ezz', bio: 'AI', country: 'EG', score: 5 }));

// Arrays, Records & Object helpers
// Python parallel: list[str], dict[str, int], TypedDict(total=False)

const tagsSchema = z.array(z.string()).min(1).max(5);
console.log(tagsSchema.parse(['ts', 'zod'])); // => ['ts', 'zod']

const scoresSchema = z.record(z.string(), z.number()); // like dict[str, int]
console.log(scoresSchema.parse({ math: 90, ai: 95 })); // => { math: 90, ai: 95 }

const BaseUser = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  age: z.number().optional(),
});

const ExtendedUser = BaseUser.extend({ role: roleSchema }); // add fields
const PublicUser = BaseUser.pick({ id: true, name: true }); // subset (like Pick<T, K>)
const PartialUser = BaseUser.partial(); // all optional (like Partial<T> / TypedDict(total=False))

console.log(ExtendedUser.parse({ id: '1', name: 'Ezz', email: 'hi@example.com', role: 'admin' }));
console.log(PublicUser.parse({ id: '1', name: 'Ezz' }));
console.log(PartialUser.parse({})); // => {} — everything optional

type BaseUserType = z.infer<typeof BaseUser>;
const readonlyUser: Readonly<BaseUserType> = { id: '1', name: 'Ezz', email: 'hi@example.com' };
console.log(readonlyUser.name);

// Mini discriminated union (see schema.ts for the full agent-steps version)
const shapeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('circle'), radius: z.number().positive() }),
  z.object({ kind: z.literal('square'), size: z.number().positive() }),
]);
type Shape = z.infer<typeof shapeSchema>;
const area = (shape: Shape): number =>
  shape.kind === 'circle' ? Math.PI * shape.radius ** 2 : shape.size ** 2;
console.log(area(shapeSchema.parse({ kind: 'circle', radius: 2 })));
