import { OpenAI } from 'openai/index.mjs';
import path from 'path';
import logger from '../utils/logging';
import {
    // AISummarizerResultSchema,
    type IntentPayload,
    type IntentResult,
    type AddEventPayload,
    type UpdateEventPayload,
    type CancelEventPayload,
    type FeedbackPayload,
    AddEventPayloadSchema,
    AddEventResultSchema,
    Intent,
    type AISummarizerPayload,
    AISummarizerPayloadSchema
} from '../types/types';
import validatePayload from '../utils/validate';

class AIClient {
    private readonly client: OpenAI;
    private prompts: Map<string, string> = new Map();
    private readonly promptDir: string;

    constructor() {
        if (!process.env.OPENROUTER_API_KEY) {
            throw new Error('Missing required OpenRouter API key');
        }

        this.promptDir = path.join(process.cwd(), 'src', 'include');
        this.client = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
                'X-Title': process.env.SITE_NAME || 'TimeBlockr',
            },
        });

        this.initializePrompts().catch(err => {
            logger.error('Failed to initialize prompts:', err);
            throw err;
        });
    }

    private async initializePrompts(): Promise<void> {
        try {
            // Load all available prompt files
            const promptFiles = [
                { name: 'summarizer', file: 'prompt_summarizer.txt' },
                { name: 'add_schedule', file: 'prompt_add_schedule.txt' }
            ];

            for (const { name, file } of promptFiles) {
                const promptPath = path.join(this.promptDir, file);
                try {
                    const content = await Bun.file(promptPath).text();
                    this.prompts.set(name, content);
                    // logger.info(`Loaded prompt: ${name}`);
                } catch (err) {
                    logger.error(`Failed to load prompt file ${file}:`, err);
                    throw new Error(`Failed to load prompt file: ${file}`);
                }
            }
        } catch (err) {
            logger.error('Error loading prompt files:', err);
            throw new Error('Failed to initialize prompts');
        }
    }

    private async rawSend(payload: string, promptType: string): Promise<string> {
        const prompt = this.prompts.get(promptType);
        if (!prompt) {
            throw new Error(`No prompt found for type: ${promptType}`);
        }

        logger.debug('Sending payload to OpenAI:', { payload, promptType });

        try {
            const res = await this.client.chat.completions.create({
                model: 'anthropic/claude-3.7-sonnet',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: payload },
                ],
            });

            const msg = res.choices[0]?.message?.content;
            if (!msg) {
                throw new Error('Empty response from OpenAI');
            }

            logger.info('Received response from OpenAI:', { response: msg });

            // Clean up the response
            const cleanedStr = msg
                .replace(/^```json\s*/, '')  // Remove leading ```json
                .replace(/\s*```$/, '')      // Remove trailing ```
                .replace(/`/g, '\\`')        // Escape all backticks
                .replace(/\\`\\`\\`/g, '\\`') // Fix triple escaped backticks
                .trim();                     // Remove extra whitespace

            return cleanedStr;
        } catch (err) {
            logger.error('OpenAI API error:', err);
            throw new Error('Failed to get response from OpenAI');
        }
    }

    async getSummary(payload: AISummarizerPayload): Promise<string> {
        const validatedPayload = validatePayload(payload, AISummarizerPayloadSchema);
        const response = await this.rawSend(JSON.stringify(validatedPayload), 'summarizer');
        return response;
    }

    private async handleAddEvent(payload: AddEventPayload): Promise<IntentResult> {
        const validatedPayload = validatePayload(payload, AddEventPayloadSchema);
        const dataRes = await this.rawSend(JSON.stringify(validatedPayload), 'add_schedule');

        const validatedResult = validatePayload(JSON.parse(dataRes), AddEventResultSchema);
        return {
            type: Intent.ADD_EVENT,
            result: validatedResult
        };
    }

    private async handleUpdateEvent(payload: UpdateEventPayload): Promise<IntentResult> {
        throw new Error('Not implemented');
    }

    private async handleCancelEvent(payload: CancelEventPayload): Promise<IntentResult> {
        throw new Error('Not implemented');
    }

    private async handleFeedback(payload: FeedbackPayload): Promise<IntentResult> {
        throw new Error('Not implemented');
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
