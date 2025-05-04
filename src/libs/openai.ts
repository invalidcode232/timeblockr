import { AzureOpenAI } from 'openai/index.mjs';
import path from 'path';
import type { ChatCompletion } from 'openai/resources/index.mjs';
import { logger } from '@azure/identity';

const SUMMARIZER_PROMPT_PATH = path.join(
    process.cwd(),
    '/src/include/prompt_summarizer.txt'
);

const SCHEDULER_PROMPT_PATH = path.join(
    process.cwd(),
    '/src/include/prompt_scheduler.txt'
);

const getFirstResponse = (res: ChatCompletion) => {
    return res.choices[0].message.content;
};

class AIClient {
    client: AzureOpenAI;

    constructor() {
        this.client = new AzureOpenAI({
            deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
            apiVersion: process.env.AZURE_OPENAI_API_VERSION,
            apiKey: process.env.AZURE_OPENAI_API_KEY,
        });
    }

    getSummary = async (schedule: string) => {
        const aiPrompt = await Bun.file(SUMMARIZER_PROMPT_PATH).text();

        const res = await this.client.chat.completions.create({
            model: '',
            messages: [
                { role: 'system', content: aiPrompt },
                { role: 'user', content: schedule },
            ],
        });

        const msg = getFirstResponse(res);
        if (!msg)
            return new Response(
                JSON.stringify({ error: 'Failed to get response from OpenAI.' })
            );

        return msg;
    };

    getScheduler = async (schedule: string) => {
        const aiPrompt = await Bun.file(SCHEDULER_PROMPT_PATH).text();

        const res = await this.client.chat.completions.create({
            model: '',
            messages: [
                { role: 'system', content: aiPrompt },
                { role: 'user', content: schedule },
            ],
        });

        const msg = getFirstResponse(res);
        if (!msg)
            return new Response(
                JSON.stringify({ error: 'Failed to get response from OpenAI.' })
            );

        return msg;
    };
}

export default AIClient;
