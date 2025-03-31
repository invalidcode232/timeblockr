import { AzureOpenAI } from 'openai/index.mjs';
import path from 'path';
import type { ChatCompletion } from 'openai/resources/index.mjs';
import { logger } from '@azure/identity';

const getFirstResponse = (res: ChatCompletion) => {
    return res.choices[0].message.content;
};

class AIClient {
    client: AzureOpenAI;
    aiPrompt: string | null;

    constructor() {
        this.client = new AzureOpenAI({
            deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
            apiVersion: process.env.AZURE_OPENAI_API_VERSION,
            apiKey: process.env.AZURE_OPENAI_API_KEY,
            baseURL: process.env.AZURE_OPENAI_BASE_URL,
        });

        this.aiPrompt = null;
    }

    getSummary = async (schedule: string) => {
        if (!this.aiPrompt) {
            const promptPath = path.join(
                process.cwd(),
                '/src/include/prompt.txt'
            );

            this.aiPrompt = await Bun.file(promptPath).text();

            logger.info('read AI prompt from ' + promptPath);
        }

        const res = await this.client.chat.completions.create({
            model: '',
            messages: [
                { role: 'system', content: this.aiPrompt },
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
