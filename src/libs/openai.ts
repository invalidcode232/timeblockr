import { AzureOpenAI } from 'openai/index.mjs';
import path from 'path';
import type { ChatCompletion } from 'openai/resources/index.mjs';
import logger from '../utils/logging';
import {
    AISummarizerResultSchema,
    type IntentPayload,
    type IntentResult,
    type AddEventPayload,
    type UpdateEventPayload,
    type CancelEventPayload,
    type FeedbackPayload,
    AddEventPayloadSchema,
    UpdateEventPayloadSchema,
    CancelEventPayloadSchema,
    FeedbackPayloadSchema,
    AddEventResultSchema,
    // UpdateEventResultSchema,
    // CancelEventResultSchema,
    // FeedbackResultSchema,
    Intent,
    type AISummarizerPayload,
    AISummarizerPayloadSchema
} from '../types/types';
import validatePayload from '../utils/validate';

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
        Bun.file(SUMMARIZER_PROMPT_PATH)
            .text()
            .then((data) => {
                this.summarizerPrompt = data;
            })
            .catch((err) => {
                logger.error('Error reading summarizer prompt file:', err);
            });

        Bun.file(SCHEDULER_PROMPT_PATH)
            .text()
            .then((data) => {
                this.schedulerPrompt = data;
            })
            .catch((err) => {
                logger.error('Error reading scheduler prompt file:', err);
            });
    }

    rawSend = async (prompt: string, payload: string) => {
        logger.debug(`Sending payload to OpenAI: ${payload}`);

        const res = await this.client.chat.completions.create({
            model: '',
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: payload },
            ],
        });


        const msg = getFirstResponse(res);
        if (!msg) {
            logger.error('No response from OpenAI.');
            return;
        }

        logger.debug(`Received response from OpenAI: ${msg}`);

        return msg;
    };

    getSummary = async (payload: AISummarizerPayload) => {
        if (!this.summarizerPrompt) {
            logger.error('Summarizer prompt is not loaded.');
            return new Response(
                JSON.stringify({ error: 'Summarizer prompt is not loaded.' })
            );
        }

        const validatedPayload = validatePayload(payload, AISummarizerPayloadSchema);
        
        const res = this.rawSend(this.summarizerPrompt, JSON.stringify(validatedPayload));

        return res;
    };

    private async handleAddEvent(payload: AddEventPayload): Promise<IntentResult> {
        const validatedPayload = validatePayload(payload, AddEventPayloadSchema);
        
        if (!this.schedulerPrompt) {
            logger.error('Scheduler prompt is not loaded.');
            throw new Error('Scheduler prompt is not loaded');
        }

        const payloadString = JSON.stringify(validatedPayload);

        const dataRes = await this.rawSend(this.schedulerPrompt, payloadString);
        if (!dataRes) {
            logger.error('No response from OpenAI.');
            throw new Error('No response from OpenAI');
        }

        const validatedResult = validatePayload(JSON.parse(dataRes), AddEventResultSchema);

        const result: IntentResult = {
            type: Intent.ADD_EVENT,
            result: validatedResult
        };

        return result;
    }

    private async handleUpdateEvent(payload: UpdateEventPayload): Promise<IntentResult> {
        const validatedPayload = validatePayload(payload, UpdateEventPayloadSchema);
        // TODO: Implement update event logic
        throw new Error('Update event not implemented yet');
    }

    private async handleCancelEvent(payload: CancelEventPayload): Promise<IntentResult> {
        const validatedPayload = validatePayload(payload, CancelEventPayloadSchema);
        // TODO: Implement cancel event logic
        throw new Error('Cancel event not implemented yet');
    }

    private async handleFeedback(payload: FeedbackPayload): Promise<IntentResult> {
        const validatedPayload = validatePayload(payload, FeedbackPayloadSchema);
        // TODO: Implement feedback logic
        throw new Error('Feedback not implemented yet');
    }

    async processIntent(intent: Intent, payload: IntentPayload): Promise<IntentResult> {
        logger.debug(`Processing intent: ${intent}`);
        switch (intent) {
            case Intent.ADD_EVENT:
                return this.handleAddEvent(payload as AddEventPayload);
            case Intent.UPDATE_EVENT:
                return this.handleUpdateEvent(payload as UpdateEventPayload);
            case Intent.CANCEL_EVENT:
                return this.handleCancelEvent(payload as CancelEventPayload);
            case Intent.FEEDBACK:
                return this.handleFeedback(payload as FeedbackPayload);
            // case Intent.SUMMARY: TODO: Finish this
            //     return this.handleSummary(payload as AISummarizerPayload);
            default:
                throw new Error('Invalid intent');
        }
    }
}

export default AIClient;
