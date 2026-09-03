import { z } from 'zod';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import search from "@modernized/arxiv-api";

dotenv.config({ path: path.join(path.dirname(path.dirname(__dirname)), '.env') });

const client = new OpenAI({
  apiKey: process.env['OPENCODE_API_KEY'],
  baseURL: "https://opencode.ai/zen/go/v1"
});

const searchPapersResultSchema = z.array(
    z.object({
        paperURL: z.string().nonempty(),
        title: z.string().nonempty(),
        summary: z.string().nonempty(),
        published: z.string().nonempty(),
        updated: z.string().nonempty()
    })
)

const searchPapersRequestSchema = z.object({
    topic: z.string().nonempty(),
    maxResults: z.number().gt(0)
})

type searchPapersResult = z.infer<typeof searchPapersResultSchema>
type searchPapersRequest = z.infer<typeof searchPapersRequestSchema>

const searchPapers = async (params: searchPapersRequest): Promise<searchPapersResult> => {
    try {
        const papers = await search({
            searchQueryParams: [
                {
                    include: [{name: params.topic}],
                }
            ],
            start: 0,
            maxResults: params.maxResults
        });
        let results: searchPapersResult = [];
        for (const paper of papers.entries) {
            const temp = {
                paperURL: paper.id,
                title: paper.title,
                summary: paper.summary,
                published: paper.published,
                updated: paper.updated
            }
            results.push(temp)
        }
        return results;
    } catch (error) {
        console.error("Error searching papers:", error);
        return [];
    }
}

const tools: OpenAI.Responses.Tool[] = [
    {
        type: "function",
        name: "search_papers",
        description: "Search for papers on arXiv based on a topic.",
        parameters: {
            type: "object",
            properties: {
                topic: {
                    type: "string",
                    description: "topic used to search for papers on arXiv",
                },
                maxResults: {
                    type: "number",
                    description: "maximum number of results",
                }
            },
            required: ["topic", "maxResults"],
            additionalProperties: false,
        },
        strict: true,
    },
]

// Tool execution function
const executeTool = async (toolCall: any): Promise<string> => {
    if (toolCall.name === 'search_papers') {
        try {
            const args = searchPapersRequestSchema.parse(JSON.parse(toolCall.arguments));
            const results = await searchPapers({
                topic: args.topic,
                maxResults: args.maxResults || 3
            });
            const validatedResult = JSON.stringify(searchPapersResultSchema.parse(results));
            return validatedResult
        } catch (error) {
            return JSON.stringify({ error: error });
        }
    }
    return JSON.stringify({ error: 'Unknown tool' });
}

const callLLM = async (prompt: string): Promise<void> => {
    // Use responses API for tool calling
    const response = await client.responses.create({
        model: 'gpt-5.6-luna',
        instructions: 'You are a helpful assistant that can search for academic papers. When you search, use the search_papers tool.',
        input: prompt,
        tools: tools,
        tool_choice: 'auto',
        stream: true,
    });

    let fullResponse = '';
    let isFirstChunk = true;
    let toolCallData: any = null;

    for await (const event of response) {
        try {
            // Handle different event types
            
            // 1. Text delta events
            if (event.type === 'response.output_text.delta') {
                const content = event.delta || '';
                if (content) {
                    if (isFirstChunk) {
                        process.stdout.write('\nAssistant: ');
                        isFirstChunk = false;
                    }
                    process.stdout.write(content);
                    fullResponse += content;
                }
            }
            
            // 2. Tool call events (function call)
            if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
                console.log('\nTool called:', event.item.name);
                toolCallData = {
                    name: event.item.name,
                    arguments: event.item.arguments || ''
                };
            }
            
            // 3. Tool call argument delta (streaming arguments)
            if (event.type === 'response.function_call_arguments.delta') {
                if (!toolCallData) {
                    toolCallData = {
                        name: '',
                        arguments: ''
                    };
                }
                toolCallData.arguments += event.delta || '';
            }
            
            // 4. Tool call complete
            if (event.type === 'response.function_call_arguments.done') {
                if (toolCallData) {
                    console.log('\n Executing tool...');
                    
                    // Execute the tool
                    const result = await executeTool({
                        name: toolCallData.name,
                        arguments: toolCallData.arguments
                    });
                    
                    console.log('Tool execution complete!');
                    
                    // Create a follow-up response with the tool result
                    const followUp = await client.responses.create({
                        model: 'gpt-5.6-luna',
                        instructions: 'You are a helpful assistant that can search for academic papers.',
                        input: prompt + `\n\nTool result from search_papers:\n${result}`,
                        stream: true,
                    });
                    
                    let followResponse = '';
                    let isFollowFirst = true;
                    for await (const followEvent of followUp) {
                        if (followEvent.type === 'response.output_text.delta') {
                            const content = followEvent.delta || '';
                            if (content) {
                                if (isFollowFirst) {
                                    console.log('\nSummary:');
                                    isFollowFirst = false;
                                }
                                process.stdout.write(content);
                                followResponse += content;
                            }
                        }
                        if (followEvent.type === 'response.completed') {
                            console.log('\n');
                        }
                    }
                }
            }
            
            // 5. Response completed
            if (event.type === 'response.completed') {
                if (!toolCallData) {
                    console.log('\n');
                }
            }
            
        } catch (error) {
            console.error('Error processing event:', error);
        }
    }
}
``
callLLM("Search for papers about adaptive agents");
