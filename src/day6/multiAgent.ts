import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { 
    ToolLoopAgent, 
    readUIMessageStream, 
    toUIMessageStream,
    tool,
    pruneMessages, type ModelMessage 
} from 'ai';
import { runAgentTUI } from '@ai-sdk/tui';
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport as StdioClientTransport } from '@ai-sdk/mcp/mcp-stdio';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

import {calculatorTool, searchPapersTool, currentDateTimeTool, webSearchTool, webExtractTool} from './tools'

dotenv.config({ path: path.join(path.dirname(path.dirname(__dirname)), '.env') });

const provider = createOpenAICompatible({
  name: 'opencode',
  apiKey: process.env['OPENCODE_API_KEY'] || '',
  baseURL: "https://opencode.ai/zen/go/v1"
});

const getMCPClient = async () => {
    const mcpClient = await createMCPClient({
        transport: new StdioClientTransport({
            command: 'npx',
            args: [
                '@modelcontextprotocol/server-filesystem',
                '/workspaces/typescript-for-AI-development'
            ],
        }),
    });
    return mcpClient
}

const COMPACTION_THRESHOLD = 100_000;

const estimateTokens = (messages: ModelMessage[]) => {
  return JSON.stringify(messages).length / 4;
};

const executorAgent = (mcpTools?: any) => {
    const agent = new ToolLoopAgent({
        model: provider('glm-5.3-flash'),
        instructions: `You are intelligent executor agent. Complete the task autonomously.
        IMPORTANT: When you have finished, write a clear summary of your findings as your final response.
        This summary will be returned to the main agent, so include all relevant information.`,
        tools: {
            calculator: calculatorTool,
            searchPapers: searchPapersTool,
            currentDateTime: currentDateTimeTool,
            webSearch: webSearchTool,
            webExtract: webExtractTool,
            ...mcpTools
        },
        maxRetries: 5,
        onStepFinish: async ({ stepNumber, toolCalls, usage, finishReason }) => {
            console.log(
                `\n[step ${stepNumber + 1}] ${finishReason} · tools: ${
                    toolCalls?.map((c) => c.toolName).join(', ') || 'none'
                } · tokens: ${usage.totalTokens}`
            );
        },
        prepareStep: async ({ messages }) => {
            if (estimateTokens(messages) > COMPACTION_THRESHOLD) {
                return {
                    messages: pruneMessages({
                        messages,
                        reasoning: 'all',
                        toolCalls: 'before-last-3-messages',
                        emptyMessages: 'remove',
                    }),
                };
            }
        },
    });
    return agent
}

const executorTool = tool({
    description: 'Execution tool to search, search research topics, calculate, and interact with filesystem. just give it clear task.',
    inputSchema: z.object({
        task: z.string().nonempty().describe('The research task to complete'),
    }),
    execute: async function* ({ task }, { abortSignal }) {
        const fsMCP = await getMCPClient();
        const fsTools = fsMCP.tools();
        const execSubagent = executorAgent(fsTools);
        // Start the subagent with streaming
        try{
            const result = await execSubagent.stream({
                prompt: task,
                abortSignal,
            });
            // Each iteration yields a complete, accumulated UIMessage
            for await (const message of readUIMessageStream({
                stream: toUIMessageStream({ stream: result.stream }),
            })) {
                yield message;
            }
        } finally {
            await fsMCP.close()
        }
    },
    toModelOutput: ({ output: message }) => {
        // Extract just the final text as a summary
        const lastTextPart = message?.parts.findLast(p => p.type === 'text');
        return {
            type: 'text',
            value: lastTextPart?.text ?? 'Task completed.',
        };
    },
});

const mainAgent = () => {
    const mainAgent = new ToolLoopAgent({
        model: provider('omen-alpha'),
        instructions: `You are intelligent assistant that supported with executor.
        Your Task is to understand the objective of the given question, and delegate tasks
        to executor then return the answer after finalize the requirements.
        `,
        tools: {
            executor: executorTool,
        },
    });
    return mainAgent;
}

const runTUI = async () => {
    const agent = mainAgent();
    await runAgentTUI({
        title: 'automata',
        agent,
        tools: 'full',
        reasoning: 'full',
        responseStatistics: 'outputTokenCount',
        contextSize: 200_000,
    });
};

runTUI().catch((error) => {
  console.error('Error:', error);
});