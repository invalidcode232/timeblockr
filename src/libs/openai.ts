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

const PROMPT_PATHS = {
    summarizer: path.join(process.cwd(), '/src/include/prompt_summarizer.txt'),
    scheduler: path.join(process.cwd(), '/src/include/prompt_scheduler.txt')
} as const;

class AIClient {
    private readonly client: AzureOpenAI;
    private prompts: {
        summarizer?: string;
        scheduler?: string;
    } = {};

    constructor() {
        if (!process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 
            !process.env.AZURE_OPENAI_API_VERSION || 
            !process.env.AZURE_OPENAI_API_KEY) {
            throw new Error('Missing required Azure OpenAI environment variables');
        }

        this.client = new AzureOpenAI({
            deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
            apiVersion: process.env.AZURE_OPENAI_API_VERSION,
            apiKey: process.env.AZURE_OPENAI_API_KEY,
            endpoint: process.env.AZURE_OPENAI_ENDPOINT
        });

        this.initializePrompts().catch(err => {
            logger.error('Failed to initialize prompts:', err);
            throw err;
        });
    }

    private async initializePrompts(): Promise<void> {
        try {
            const [summarizerPrompt, schedulerPrompt] = await Promise.all([
                Bun.file(PROMPT_PATHS.summarizer).text(),
                Bun.file(PROMPT_PATHS.scheduler).text()
            ]);

            this.prompts = {
                summarizer: summarizerPrompt,
                scheduler: schedulerPrompt
            };
        } catch (err) {
            logger.error('Error loading prompt files:', err);
            throw new Error('Failed to initialize prompts');
        }
    }

    private async rawSend(prompt: string, payload: string): Promise<string> {
        if (!prompt) {
            throw new Error('Prompt is required');
        }

        logger.debug('Sending payload to OpenAI:', { payload });

        try {
            const res = await this.client.chat.completions.create({
                model: '',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: payload },
                ],
            });

            const msg = res.choices[0]?.message?.content;
            if (!msg) {
                throw new Error('Empty response from OpenAI');
            }

            logger.debug('Received response from OpenAI:', { response: msg });
            return msg;
        } catch (err) {
            logger.error('OpenAI API error:', err);
            throw new Error('Failed to get response from OpenAI');
        }
    }

    async getSummary(payload: AISummarizerPayload): Promise<string> {
        if (!this.prompts.summarizer) {
            throw new Error('Summarizer prompt not initialized');
        }

        const validatedPayload = validatePayload(payload, AISummarizerPayloadSchema);
        return this.rawSend(this.prompts.summarizer, JSON.stringify(validatedPayload));
    }

    private async handleAddEvent(payload: AddEventPayload): Promise<IntentResult> {
        if (!this.prompts.scheduler) {
            throw new Error('Scheduler prompt not initialized');
        }

        const validatedPayload = validatePayload(payload, AddEventPayloadSchema);
        const dataRes = await this.rawSend(this.prompts.scheduler, JSON.stringify(validatedPayload));
        
        const validatedResult = validatePayload(JSON.parse(dataRes), AddEventResultSchema);
        return {
            type: Intent.ADD_EVENT,
            result: validatedResult
        };
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
        logger.debug('Processing intent:', { intent, payload });

        try {
            switch (intent) {
                case Intent.ADD_EVENT:
                    return this.handleAddEvent(payload as AddEventPayload);
                case Intent.UPDATE_EVENT:
                    return this.handleUpdateEvent(payload as UpdateEventPayload);
                case Intent.CANCEL_EVENT:
                    return this.handleCancelEvent(payload as CancelEventPayload);
                case Intent.FEEDBACK:
                    return this.handleFeedback(payload as FeedbackPayload);
                default:
                    throw new Error(`Invalid intent: ${intent}`);
            }
        } catch (err) {
            logger.error('Error processing intent:', { intent, error: err });
            throw err;
        }
    }
}

export default AIClient;
