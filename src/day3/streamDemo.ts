import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const parentDir = path.dirname(path.dirname(__dirname));
const filePath: string = path.join(parentDir, 'data', 'token-stream.json');

const responseSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  delayMs: z.number(),
  tokens: z.array(z.string()).nonempty(),
});

type response = z.infer<typeof responseSchema>;

const responseArraySchema = z.array(responseSchema);

const readDataArrayWithZod = (filePath: string): response[] => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const jsonData: response[] = responseArraySchema.parse(JSON.parse(data));
    return jsonData;
  } catch (error) {
    console.log(`Error Occurred while reading the Data!: ${error}`);
    return [];
  }
};

const llmResponses = readDataArrayWithZod(filePath);

// async generator to stream tokens...
async function* streamTokens(
  tokensList: string[],
  delay: number,
): AsyncGenerator<string, void, unknown> {
  for (const token of tokensList) {
    await new Promise((r) => setTimeout(r, delay));
    yield token;
  }
}

const recieveTokenStreams = async (response: response) => {
  console.log(`User: ${response.prompt}`);
  console.log('Assistant: ');
  for await (const token of streamTokens(response.tokens, response.delayMs)) {
    process.stdout.write(token + ' ');
  }
  console.log('\n' + '-'.repeat(50));
};

// process responses sequentially to avoid mixing the responses
async function main() {
  console.log('Starting token streaming...\n');

  for (const response of llmResponses) {
    await recieveTokenStreams(response);
  }

  console.log('All responses streamed successfully!');
}

main().catch(console.error);
