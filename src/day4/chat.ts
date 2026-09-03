import { z } from 'zod';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';

dotenv.config({ path: path.join(path.dirname(path.dirname(__dirname)), '.env') });

const client = new OpenAI({
  apiKey: process.env['OPENCODE_API_KEY'],
  baseURL: "https://opencode.ai/zen/go/v1"
});

const chatHistorySchema = z.discriminatedUnion('role',
    [
        z.object(
            {
                role: z.literal('system'),
                content: z.string().min(1)
            }
        ),
        z.object(
            {
                role: z.literal('user'),
                content: z.string().min(1)
            }
        ),
        z.object(
            {
                role: z.literal('assistant'),
                content: z.string().min(1)
            }
        ),
    ]
)

type chatHistory = z.infer<typeof chatHistorySchema>

const chatHistoryArraySchema = z.array(chatHistorySchema).optional().default([]);

type chatHistoryArray = z.infer<typeof chatHistoryArraySchema>

let history: chatHistoryArray = []

const insertIntoMemory = (input: chatHistory): boolean =>  {
    try {
        const currentInput = chatHistorySchema.parse(input)
        history.push(currentInput)
        return true
    } catch(error)  {
        console.log(`Error Occurred when insert into Memory: ${error}`)
        return false
    }
}

const fetchMemory = (): chatHistoryArray => {
    const systemPart: chatHistory = {
        role: "system",
        content: 'You are a coding assistant', 
    }
    const modifiedHistory: chatHistoryArray = [systemPart, ...history];
    return modifiedHistory
}

const callLLM = async (prompt: string): Promise<void> => {
    insertIntoMemory({
        role: "user",
        content: prompt
    });
    const currentHistory = fetchMemory();
    const stream = await client.chat.completions.create({
        model: 'glm-5.3-flash',
        messages: currentHistory,
        stream: true,
        max_completion_tokens: 512,
    });

    let fullResponse = '';
    let isFirstChunk = true;
    for await (const event of stream) {
        try {
            const content = event.choices[0]?.delta?.content || '';
            if (content) {
                if (isFirstChunk) {
                    process.stdout.write('\n');
                    isFirstChunk = false;
                }
                process.stdout.write(content);
                fullResponse += content;
            }
        } catch (error)  {
            console.log(error);
        }
    }
    insertIntoMemory({
        role: "assistant",
        content: fullResponse,
    });
}

const interactiveChat = async (): Promise<void> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const askQuestion = (query: string): Promise<string> => {
        return new Promise((resolve) => {
            rl.question(query, resolve);
        });
    };

    console.log('Type your questions (type "exit" to quit)');
    console.log('='.repeat(50));

    let running = true;
    while (running) {
        const input = await askQuestion('\nYou > ');
        const trimmedInput = input.trim();

        if (trimmedInput.toLowerCase() === 'exit') {
            console.log('Farewell!');
            running = false;
            rl.close();
            break;
        }

        if (!trimmedInput) {
            console.log('Please type a question.');
            continue;
        }

        await callLLM(trimmedInput);
    }
};

interactiveChat();