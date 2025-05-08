import { OpenAI } from 'openai/index.mjs';
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
    UpdateEventResultSchema,
    CancelEventResultSchema,
    FeedbackResultSchema,
    Intent,
    type AISummarizerPayload,
    AISummarizerPayloadSchema
} from '../types/types';
import validatePayload from '../utils/validate';

class AIClient {
    private readonly client: OpenAI;
    private prompt: string = '';

    constructor() {
        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error('Missing required OpenRouter API key');
        }

        this.client = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
                'X-Title': process.env.SITE_NAME || 'TimeBlockr',
            },
        });

        this.initializePrompt().catch(err => {
            logger.error('Failed to initialize prompt:', err);
            throw err;
        });
    }

    private async initializePrompt(): Promise<void> {
        try {
            const promptPath = path.join(process.cwd(), 'src', 'include', 'prompt.txt');
            this.prompt = await Bun.file(promptPath).text();
        } catch (err) {
            logger.error('Error loading prompt file:', err);
            throw new Error('Failed to initialize prompt');
        }
    }

    private async rawSend(payload: string): Promise<string> {
        if (!this.prompt) {
            throw new Error('Prompt is not initialized');
        }

        logger.debug('Sending payload to OpenAI:', { payload });

        try {
            const res = await this.client.chat.completions.create({
                // model: 'anthropic/claude-3-opus-20240229', // Using Claude 3 Opus as the default model
                // model: 'openai/gpt-4o-mini',
                model: 'meta-llama/llama-4-maverick',
                messages: [
                    { role: 'system', content: this.prompt },
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
        const validatedPayload = validatePayload(payload, AISummarizerPayloadSchema);
        const response = await this.rawSend(JSON.stringify(validatedPayload));
        return response;
    }

    private async handleAddEvent(payload: AddEventPayload): Promise<IntentResult> {
        const validatedPayload = validatePayload(payload, AddEventPayloadSchema);
        const dataRes = await this.rawSend(JSON.stringify(validatedPayload));
        
        const validatedResult = validatePayload(JSON.parse(dataRes), AddEventResultSchema);
        return {
            type: Intent.ADD_EVENT,
            result: validatedResult
        };
    }

    private async handleUpdateEvent(payload: UpdateEventPayload): Promise<IntentResult> {
        const validatedPayload = validatePayload(payload, UpdateEventPayloadSchema);
        const dataRes = await this.rawSend(JSON.stringify(validatedPayload));
        
        const validatedResult = validatePayload(JSON.parse(dataRes), UpdateEventResultSchema);
        return {
            type: Intent.UPDATE_EVENT,
            result: validatedResult
        };
    }

    private async handleCancelEvent(payload: CancelEventPayload): Promise<IntentResult> {
        const validatedPayload = validatePayload(payload, CancelEventPayloadSchema);
        const dataRes = await this.rawSend(JSON.stringify(validatedPayload));
        
        const validatedResult = validatePayload(JSON.parse(dataRes), CancelEventResultSchema);
        return {
            type: Intent.CANCEL_EVENT,
            result: validatedResult
        };
    }

    private async handleFeedback(payload: FeedbackPayload): Promise<IntentResult> {
        const validatedPayload = validatePayload(payload, FeedbackPayloadSchema);
        const dataRes = await this.rawSend(JSON.stringify(validatedPayload));
        
        const validatedResult = validatePayload(JSON.parse(dataRes), FeedbackResultSchema);
        return {
            type: Intent.FEEDBACK,
            result: validatedResult
        };
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
