import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { 
    ToolLoopAgent, 
    readUIMessageStream, 
    toUIMessageStream,
    convertToModelMessages,
    generateId,
    tool,
    pruneMessages, type ModelMessage, type UIMessage 
} from 'ai';
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport as StdioClientTransport } from '@ai-sdk/mcp/mcp-stdio';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

import {calculatorTool, searchPapersTool, currentDateTimeTool, webSearchTool, webExtractTool} from './tools';
import { createChat, loadChat, saveChat } from './memory';

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
        const fsTools = await fsMCP.tools();
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

export const mainAgent = () => {
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

// The ToolLoopAgent is stateless: every stream() call only sees what you pass.
// So history lives outside the agent in SQLite (UIMessage[] per chatId).
// The executor sub-agent stays ephemeral per task, its final summary already
// lands in the main history via executorTool.toModelOutput, so don't share
// the main chat history with it.

/** Ensure the chat row exists and return its history. */
export const getChatHistory = (chatId: string): UIMessage[] => {
    createChat(chatId);
    return loadChat(chatId);
};

/** Extract printable text from a UIMessage (for CLI display / return value). */
export const getMessageText = (message: UIMessage | undefined): string => {
    if (!message) return '';
    return message.parts
        .filter((p): p is Extract<UIMessage['parts'][number], { type: 'text' }> => p.type === 'text')
        .map((p) => p.text)
        .join('');
};

export type PersistentTurnResult = {
    text: string;
    messages: UIMessage[];
};

// Run one persistent turn: load history -> append user msg -> stream main
// agent with full history -> append assistant msg -> save.

export const runPersistentTurn = async (
    chatId: string,
    userText: string,
    opts: { abortSignal?: AbortSignal; onTextDelta?: (text: string) => void } = {}
): Promise<PersistentTurnResult> => {
    const agent = mainAgent();
    const messages: UIMessage[] = getChatHistory(chatId);

    messages.push({
        id: generateId(),
        role: 'user',
        parts: [{ type: 'text', text: userText }],
    });

    const modelMessages = await convertToModelMessages(messages, { tools: agent.tools });

    const result = await agent.stream({
        prompt: modelMessages,
        abortSignal: opts.abortSignal,
    });

    // Collect the accumulated assistant UIMessage the same way executorTool does.
    let assistantMessage: UIMessage | undefined;
    for await (const msg of readUIMessageStream({
        stream: toUIMessageStream({ stream: result.stream }),
    })) {
        assistantMessage = msg as UIMessage;
        const delta = getMessageText(assistantMessage);
        if (delta && opts.onTextDelta) opts.onTextDelta(delta);
    }

    if (assistantMessage) {
        messages.push(assistantMessage);
    }
    saveChat(chatId, messages);

    return { text: getMessageText(assistantMessage) || 'Task completed.', messages };
};