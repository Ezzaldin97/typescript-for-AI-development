import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const parentDir = path.dirname(path.dirname(__dirname));
const filePath: string = path.join(parentDir, 'data', 'agent-steps.json');

const agentStepsSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('tool_call'),
    name: z.string(),
    input: z.object(),
  }),
  z.object({
    type: z.literal('final_answer'),
    text: z.string().min(2),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string().min(2),
  }),
]);

type agentSteps = z.infer<typeof agentStepsSchema>;

const agentStepsArraySchema = z.array(agentStepsSchema);

const readDataArrayWithZod = (filePath: string): agentSteps[] => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const jsonData: agentSteps[] = agentStepsArraySchema.parse(
      JSON.parse(data),
    );
    return jsonData;
  } catch (error) {
    console.log(`Error Occurred while reading the Data!: ${error}`);
    return [];
  }
};

const steps = readDataArrayWithZod(filePath);

const execute = (step: agentSteps): string => {
  switch (step.type) {
    case 'tool_call':
      return `execute ${step.name} tool with paramters: ${step.input}`;
    case 'error':
      return `Error Ocurred: ${step.message}`;
    case 'final_answer':
      return `Agent: ${step.text}`;
    default:
      const _exhaustive: never = step; // compiler error if a case is missing
      return _exhaustive;
  }
};

const callAgent = (agentSteps: agentSteps[]): void => {
  agentSteps.forEach((step) => console.log(execute(step)));
};

callAgent(steps);
