import { z } from 'zod';

export const researcherOutput = z.array(
    z.object({
        summary: z.string().nonempty().min(10).describe("summary of the search result."),
        sourceURL: z.string().nonempty().describe("source URL of the search result.")
    })
);