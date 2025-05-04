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
    summarizerPrompt: string | undefined = undefined;
    schedulerPrompt: string | undefined = undefined;

    constructor() {
        this.client = new AzureOpenAI({
            deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
            apiVersion: process.env.AZURE_OPENAI_API_VERSION,
            apiKey: process.env.AZURE_OPENAI_API_KEY,
        });

        // read the prompt files, do error handling and close it
        Bun.file(SUMMARIZER_PROMPT_PATH).text()
            .then((data) => {
                this.summarizerPrompt = data;
            }
            ).catch((err) => {
                logger.error('Error reading summarizer prompt file:', err);
            }
            );

        Bun.file(SCHEDULER_PROMPT_PATH).text()
            .then((data) => {
                this.schedulerPrompt = data;
            }
            ).catch((err) => {
                logger.error('Error reading scheduler prompt file:', err);
            }
            );
    }

    rawSend = async (prompt: string, payload: string) => {
        const res = await this.client.chat.completions.create({
            model: '',
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: payload },
            ],
        });

        const msg = getFirstResponse(res);
        if (!msg)
            return new Response(
                JSON.stringify({ error: 'Failed to get response from OpenAI.' })
            );

        return msg;
    }

    getSummary = async (schedule: string) => {
        if (!this.summarizerPrompt) {
            logger.error('Summarizer prompt is not loaded.');
            return new Response(
                JSON.stringify({ error: 'Summarizer prompt is not loaded.' })
            );
        }

        const res = this.rawSend(this.summarizerPrompt, schedule);

        return res;
    };

    doScheduling = async (schedule: string) => {
        if (!this.schedulerPrompt) {
            logger.error('Scheduler prompt is not loaded.');
            return new Response(
                JSON.stringify({ error: 'Scheduler prompt is not loaded.' })
            );
        }

        const res = this.rawSend(this.schedulerPrompt, schedule);

        // Here, we would actually parse and get the start time, end time, and others to actually create the event,
        // but for now, we will just return the response as is.

        return res;
    };
}

export default AIClient;
