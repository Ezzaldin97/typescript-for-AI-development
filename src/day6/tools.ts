import { tool } from 'ai';
import { z } from 'zod';
import search from "@modernized/arxiv-api";
import { tavily } from '@tavily/core';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(path.dirname(__dirname), '.env') });

const tvly = tavily({ apiKey: process.env["TAVILY_API_KEY"] || '' });

export const calculatorTool = tool({
  description: 'Perform basic mathematical calculations (add, subtract, multiply, divide, power)',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide', 'power'])
      .describe('The mathematical operation to perform'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  outputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide', 'power'])
      .describe('The mathematical operation to perform'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
    result: z.number().describe('Result'),
    formatted: z.string().describe('string formatted result')
  }),
  execute: async ({ operation, a, b }) => {
    console.log(`Calculating: ${a} ${operation} ${b}`);
    
    let result: number;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          throw new Error('Cannot divide by zero');
        }
        result = a / b;
        break;
      case 'power':
        result = Math.pow(a, b);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    return {
      operation,
      a,
      b,
      result,
      formatted: `${a} ${operation} ${b} = ${result}`
    };
  }
});

export const searchPapersTool = tool({
    description: "Search for papers on arXiv based on a topic.",
    inputSchema: z.object(
        {
            topic: z.string().describe("topic used to search for papers on arXiv"),
            maxResults: z.number().gt(0).describe("maximum number of results")
        }
    ),
    outputSchema: z.array(
        z.object({
            paperURL: z.string().nonempty(),
            title: z.string().nonempty(),
            summary: z.string().nonempty(),
            published: z.string().nonempty(),
            updated: z.string().nonempty()
        })
    ),
    execute: async ({ topic,  maxResults }) => {
        try {
            const papers = await search({
                searchQueryParams: [
                    {
                        include: [{name: topic}],
                    }
                ],
                start: 0,
                maxResults: maxResults
            });
            let results = [];
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
            return results
        } catch (error) {
            console.error("Error searching papers:", error);
            return [];
        }
    }
});

export const currentDateTimeTool = tool({
  description: 'Get the current date and time in various formats. Use this when the user asks about the current time, date, or wants to know what time it is now.',
  inputSchema: z.object({
    format: z.enum(['full', 'date', 'time', 'iso', 'timestamp', 'readable'])
      .default('full')
      .describe('The format to return the datetime in'),
    timezone: z.string()
      .default('UTC')
      .describe('Timezone (e.g., "UTC", "America/New_York", "Europe/London", "Asia/Tokyo")'),
  }),
  execute: async ({ format, timezone }) => {
    try {
      // Get current date
      const now = new Date();
      
      // Handle timezone
      let date: Date;
      if (timezone !== 'UTC') {
        // Create date in specified timezone
        const options = { timeZone: timezone };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        // We'll use the formatter for specific formats
        date = now;
      } else {
        date = now;
      }

      // Format the date based on requested format
      let result: any = {
        timestamp: now.toISOString(),
        timezone: timezone,
        unix: Math.floor(now.getTime() / 1000),
        milliseconds: now.getTime(),
      };

      // Format the date
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      });

      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      switch (format) {
        case 'full':
          result.formatted = formatter.format(now);
          break;
        case 'date':
          result.formatted = dateFormatter.format(now);
          break;
        case 'time':
          result.formatted = timeFormatter.format(now);
          break;
        case 'iso':
          result.formatted = now.toISOString();
          break;
        case 'timestamp':
          result.formatted = Math.floor(now.getTime() / 1000).toString();
          break;
        case 'readable':
          result.formatted = `${dateFormatter.format(now)} at ${timeFormatter.format(now)} (${timezone})`;
          break;
        default:
          result.formatted = formatter.format(now);
      }

      // Add additional useful information
      result.components = {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        milliseconds: now.getMilliseconds(),
        dayOfWeek: now.getDay(),
      };

      return result;
    } catch (error) {
      // Fallback if timezone is invalid
      const now = new Date();
      return {
        formatted: now.toLocaleString(),
        timestamp: now.toISOString(),
        timezone: 'UTC (fallback)',
        unix: Math.floor(now.getTime() / 1000),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
}
});

export const webSearchTool = tool({
  description: 'Search the web for current information',
  inputSchema: z.object({
    query: z.string().nonempty().describe('search query')
  }),
  execute: async ({ query }) => {
    try {
      const response = await tvly.search(query, {
        maxResults: 3,
        includeAnswer: true,
        searchDepth: 'basic'
      });
      
      return {
        process: 'success',
        results: response.results,
        answer: response.answer,
      };
    } catch (error) {
      console.error('Search error:', error);
      return {
        process: 'failed',
        error: `Failed to search: ${error}` 
      };
    }
  },
});

export const webExtractTool = tool({
  description: 'Extract and read content from a webpage',
  inputSchema: z.object({
    urls: z.array(z.string()).describe('URLs of the pages that need content extraction')
  }),
  execute: async ({ urls }) => {
    const response = await tvly.extract(
      urls,
    );
    
    const result = response.results?.[0];
    return {
      title: result?.title || 'No title',
      content: result?.rawContent ? result.rawContent.substring(0, 500) + '...' : 'No content',
    };
  },
});