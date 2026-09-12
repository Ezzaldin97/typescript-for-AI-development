import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { 
    ToolLoopAgent, 
    readUIMessageStream, 
    toUIMessageStream,
    convertToModelMessages,
    generateId,
    tool,
    isStepCount,
    Output,
    pruneMessages, type ModelMessage, type UIMessage 
} from 'ai';
import {
  agentGuardrails,
  piiDetector
} from 'ai-sdk-guardrails';
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from 'pino';
import { randomUUID } from 'crypto';

// import { researcherOutput } from './schemas'
import {calculatorTool, currentDateTimeTool, webSearchTool, webExtractTool} from './tools.js';
import { createChat, loadChat, saveChat } from './memory.js';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const sessionId = randomUUID(); // keep this stable per conversation/thread required by opencode 8/9/2026

const provider = createOpenAICompatible({
  name: 'opencode',
  apiKey: process.env['OPENCODE_API_KEY'] || '',
  baseURL: "https://opencode.ai/zen/go/v1",
  supportsStructuredOutputs: true,
  headers: {
    'x-opencode-session': sessionId,
  },
});

const COMPACTION_THRESHOLD = 100_000;

const estimateTokens = (messages: ModelMessage[]) => {
  return JSON.stringify(messages).length / 4;
};

const researchAgent = () => {
    const agent = new ToolLoopAgent({
        model: provider('glm-5.3-flash'),
        instructions: `You are intelligent researcher. Complete the search task autonomously.
        IMPORTANT: When you have finished, your FINAL response must be clear, concise with source URL.
        It will be returned to the main agent, so include all relevant information.
        ]`,
        tools: {
            webSearch: webSearchTool,
            webExtract: webExtractTool
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
        stopWhen: isStepCount(20),
    });
    return agent
};

const researchTool = tool({
    description: 'research tool to search  about giving topics/task. just give it clear task.',
    inputSchema: z.object({
        task: z.string().nonempty().describe('The research task to complete'),
    }),
    execute: async function* ({ task }, { abortSignal }) {
        const researchSubagent = researchAgent();
        // Start the subagent with streaming
        const result = await researchSubagent.stream({
            prompt: task,
            abortSignal,
        });
        // Each iteration yields a complete, accumulated UIMessage
        for await (const message of readUIMessageStream({
            stream: toUIMessageStream({ stream: result.stream }),
        })) {
            yield message;
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

const mainAgent = (logger?: Logger) => {
    const mainAgent = new ToolLoopAgent({
        ...agentGuardrails({
            model: provider('omen-alpha'),
            inputGuardrails: [piiDetector()]
        }),
        instructions: `You are **sonar** an intelligent deep researcher that supported with researcher and other helper tools like calculator and current date and datetime in various time formats.
        Your Task is to understand the objective of the given question, and delegate tasks
        to researcher and use your helper tools then return the answer after finalize the requirements.
        IMPORTANT: provide the final answer with answers in bullet points supported by source URL if exists.
        `,
        tools: {
            calculator: calculatorTool,
            currentDatetime: currentDateTimeTool,
            researcher: researchTool,
        },
        output: Output.text(),
        onStepFinish: ({ usage, stepNumber, finishReason }) => {
            const inputTokens = usage?.inputTokens ?? 0;
            const outputTokens = usage?.outputTokens ?? 0;

            if (logger) {
                logger.info({
                    event: 'agent.step.finish',
                    stepNumber,
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens,
                    finishReason,
                }, `Step ${stepNumber} completed`);
            }
        }
    });
    return mainAgent;
};

// The ToolLoopAgent is stateless: every stream() call only sees what you pass.
// So history lives outside the agent in Turso Cloud (UIMessage[] per chatId).
// The executor sub-agent stays ephemeral per task, its final summary already
// lands in the main history via executorTool.toModelOutput, so don't share
// the main chat history with it.

/** Ensure the chat row exists and return its history. */
export const getChatHistory = async (chatId: string): Promise<UIMessage[]> => {
    await createChat(chatId);
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
    logger?: Logger,
    opts: { abortSignal?: AbortSignal; onTextDelta?: (text: string) => void } = {}
): Promise<PersistentTurnResult> => {
    const agent = mainAgent(logger);
    const messages: UIMessage[] = await getChatHistory(chatId);

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
    await saveChat(chatId, messages);

    return { text: getMessageText(assistantMessage) || 'Task completed.', messages };
};
