import { runAgentTUI } from '@ai-sdk/tui';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { generateId } from 'ai';

import { mainAgent, runPersistentTurn, getChatHistory, getMessageText } from './multiAgent';

const runEphemeralTUI = async () => {
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

// Persistent CLI: history lives in SQLite via memory.ts.
// runAgentTUI keeps its message list only in memory, so resume requires
// this loop (load -> turn -> save) instead of runAgentTUI.
const runPersistentCLI = async (chatId: string) => {
    const history = getChatHistory(chatId);
    console.log(`[persist] chat=${chatId} resumed ${history.length} messages`);
    for (const m of history.slice(-6)) {
        const preview = getMessageText(m as any).slice(0, 120);
        if (preview) console.log(`  [history] ${m.role}: ${preview}`);
    }
    console.log("Type '/exit' to quit.\n");

    const rl = createInterface({ input, output });
    try {
        while (true) {
            const prompt = await rl.question('You: ');
            const text = prompt.trim();
            if (!text) continue;
            if (text === '/exit' || text === '/quit') break;
            try {
                process.stdout.write('Assistant: ');
                let lastLen = 0;
                const { text: finalText } = await runPersistentTurn(chatId, text, {
                    onTextDelta: (full) => {
                        // Incremental render: only write the new tail.
                        if (full.length > lastLen) {
                            process.stdout.write(full.slice(lastLen));
                            lastLen = full.length;
                        }
                    },
                });
                // onTextDelta already streamed the full text; just newline.
                // If streaming produced nothing visible, print the fallback.
                if (lastLen === 0 && finalText) process.stdout.write(finalText);
                process.stdout.write('\n');
            } catch (error) {
                console.error('\n[error]', error);
            }
        }
    } finally {
        rl.close();
    }
    console.log(`[persist] saved. Resume with: npx tsx src/day6/tui.ts --persist ${chatId}`);
};

const main = async () => {
    const args = process.argv.slice(2);
    if (args.includes('--persist') || args.includes('--resume')) {
        const chatId = args.find((a) => !a.startsWith('--')) ?? generateId();
        await runPersistentCLI(chatId);
        return;
    }
    // Back-compat: bare chatId arg also enters persistent mode.
    if (args.length === 1 && args[0] && !args[0].startsWith('-')) {
        await runPersistentCLI(args[0] as string);
        return;
    }
    await runEphemeralTUI();
};

main().catch((error) => {
  console.error('Error:', error);
});
