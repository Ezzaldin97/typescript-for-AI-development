import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { ToolLoopAgent, pruneMessages, type ModelMessage } from 'ai';
import { runAgentTUI } from '@ai-sdk/tui';
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport as StdioClientTransport } from '@ai-sdk/mcp/mcp-stdio';
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

const getAgent = (mcpTools: any) => {
    const agent = new ToolLoopAgent({
        model: provider('glm-5.3-flash'),
        instructions: 'You are helpfull assistant.',
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

const invokeAgent = async (prompt: string): Promise<void> => {
    const fsMCPClient = await getMCPClient();
    const fsTools = await fsMCPClient.tools();
    const agent = new ToolLoopAgent({
        model: provider('glm-5.3-flash'),
        instructions: 'You are helpfull assistant.',
        tools: {
            calculator: calculatorTool,
            searchPapers: searchPapersTool,
            currentDateTime: currentDateTimeTool,
            webSearch: webSearchTool,
            webExtract: webExtractTool,
            ...fsTools
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
    const result = await agent.stream({
        prompt: prompt
    });
    let fullResponse: string = '';
    for await (const part of result.fullStream) {
        switch (part.type) {
            case 'text-delta':
                fullResponse += part.text;
                process.stdout.write(part.text);
                break;
            case 'tool-call':
                console.log(`\ncalling ${part.toolName}`, part.input);
                break;
            case 'tool-result':
                console.log(`${part.toolName} returned`, part.output);
                break;
            case 'finish':
                console.log(`\n[done] ${part.finishReason}`);
                break;
        }
    }
    console.log();
}

/*
(async () => {
    try {
        await invokeAgent('what are the latest news about nvidia??');
    } catch (error) {
        console.error('Error:', error);
    }
})();
*/

const runTUI = async () => {
    const mcpClient = await getMCPClient();
    const mcpTools = await mcpClient.tools();
    const agent = getAgent(mcpTools)
    await runAgentTUI({
        title: 'automata',
        agent,
        tools: 'auto-collapsed',
        reasoning: 'full',
        responseStatistics: 'outputTokenCount',
        contextSize: 200_000,
    });
};

runTUI().catch((error) => {
  console.error('Error:', error);
});