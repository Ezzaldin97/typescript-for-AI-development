import { runAgentTUI } from '@ai-sdk/tui';

import { mainAgent } from './multiAgent'

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