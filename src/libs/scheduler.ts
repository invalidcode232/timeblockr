import AIClient from "./openai";
import WeatherClient from "./weather";
import GoogleClient from "./google";
import { 
    type AddEventPayload, 
    type AISummarizerPayload, 
    type CalendarEvent, 
    type IntentPayload, 
    type IntentResult, 
    type WeatherData, 
    type AddEventResult,
    type UpdateEventResult,
    type CancelEventResult,
    type FeedbackResult,
    AISummarizerPayloadSchema 
} from "../types/types";
import { Intent } from "../types/types";
import logger from "../utils/logging";
import path from 'path';

interface Cache {
    weather: WeatherData | null;
    weatherTimestamp: number;
    events: CalendarEvent[] | null;
    eventsTimestamp: number;
}

class Scheduler {
    private aiClient: AIClient;
    private weatherClient: WeatherClient;
    private googleClient: GoogleClient;
    private cache: Cache;
    private readonly cacheDuration: number;
    private readonly promptPath: string;

    constructor(
        aiClient: AIClient, 
        weatherClient: WeatherClient, 
        googleClient: GoogleClient,
        cacheDuration: number = 5 * 60 * 1000 // 5 minutes in milliseconds
    ) {
        this.aiClient = aiClient;
        this.weatherClient = weatherClient;
        this.googleClient = googleClient;
        this.cacheDuration = cacheDuration;
        this.promptPath = path.join(process.cwd(), 'src', 'include', 'prompt.txt');
        
        this.cache = {
            weather: null,
            weatherTimestamp: 0,
            events: null,
            eventsTimestamp: 0
        };
    }

    private async getWeather(): Promise<WeatherData> {
        const now = Date.now();
        if (this.cache.weather && now - this.cache.weatherTimestamp < this.cacheDuration) {
            logger.info('Using cached weather data');
            return this.cache.weather;
        }

        const weather = await this.weatherClient.getWeather();
        this.cache.weather = weather;
        this.cache.weatherTimestamp = now;
        return weather;
    }

    private async getEvents(): Promise<CalendarEvent[]> {
        const now = Date.now();
        if (this.cache.events && now - this.cache.eventsTimestamp < this.cacheDuration) {
            logger.info('Using cached calendar events');
            return this.cache.events;
        }

        const events = await this.googleClient.getEvents();
        if (!events) {
            throw new Error('Failed to fetch calendar events');
        }
        this.cache.events = events;
        this.cache.eventsTimestamp = now;
        return events;
    }

    async getSummary() {
        const events = await this.getEvents();
        const weather = await this.getWeather();

        const aiSummarizerPayload: AISummarizerPayload = {
            currentCondition: WeatherClient.getConditionFromId(weather.conditionId),
            currentTemperature: weather.temp.cur,
            events,
            currentDate: new Date().toISOString(),
        };

        const summary = await this.aiClient.getSummary(aiSummarizerPayload);
        return summary;
    }

    /**
     * Public method to handle user input and determine intent
     * Currently assumes ADD_EVENT intent, but will be expanded to handle other intents
     */
    async handleUserInput(userInput: string): Promise<IntentResult> {
        logger.debug(`Processing user input: ${userInput}`);
        
        // TODO: Implement intent determination logic
        // For now, we assume ADD_EVENT intent
        const intent = Intent.ADD_EVENT;
        logger.debug(`Determined intent: ${intent}`);

        switch (intent) {
            case Intent.ADD_EVENT:
                return this.addEvent(userInput);
            // @ts-ignore
            case Intent.UPDATE_EVENT:
                return this.updateEvent(userInput);
            // @ts-ignore
            case Intent.CANCEL_EVENT:
                return this.cancelEvent(userInput);
            // @ts-ignore
            case Intent.FEEDBACK:
                return this.handleFeedback(userInput);
            default:
                throw new Error('Invalid intent');
        }
    }

    private async addEvent(userInput: string): Promise<IntentResult & { type: Intent.ADD_EVENT; result: AddEventResult }> {
        const events = await this.getEvents();

        const intentPayload: AddEventPayload = {
            events,
            newEvent: { summary: userInput }, 
            currentDate: new Date().toISOString()
        };

        const intentResult = await this.aiClient.processIntent(Intent.ADD_EVENT, intentPayload);

        return intentResult as IntentResult & { type: Intent.ADD_EVENT; result: AddEventResult };
    }

    private async updateEvent(userInput: string): Promise<IntentResult & { type: Intent.UPDATE_EVENT; result: UpdateEventResult }> {
        const events = await this.getEvents();
        
        // TODO: Parse userInput to get eventId and updates
        const intentPayload = {
            events,
            eventId: "sample_event_id", // This should be parsed from userInput
            updates: { summary: userInput },
            currentDate: new Date().toISOString()
        };

        const intentResult = await this.aiClient.processIntent(Intent.UPDATE_EVENT, intentPayload);
        return intentResult as IntentResult & { type: Intent.UPDATE_EVENT; result: UpdateEventResult };
    }

    private async cancelEvent(userInput: string): Promise<IntentResult & { type: Intent.CANCEL_EVENT; result: CancelEventResult }> {
        const events = await this.getEvents();
        
        // TODO: Parse userInput to get eventId
        const intentPayload = {
            events,
            eventId: "sample_event_id", // This should be parsed from userInput
            currentDate: new Date().toISOString()
        };

        const intentResult = await this.aiClient.processIntent(Intent.CANCEL_EVENT, intentPayload);
        return intentResult as IntentResult & { type: Intent.CANCEL_EVENT; result: CancelEventResult };
    }

    private async handleFeedback(userInput: string): Promise<IntentResult & { type: Intent.FEEDBACK; result: FeedbackResult }> {
        // TODO: Parse userInput to get eventId and feedback
        const intentPayload = {
            eventId: "sample_event_id", // This should be parsed from userInput
            feedback: userInput,
            currentDate: new Date().toISOString()
        };

        const intentResult = await this.aiClient.processIntent(Intent.FEEDBACK, intentPayload);
        return intentResult as IntentResult & { type: Intent.FEEDBACK; result: FeedbackResult };
    }

    // Method to force refresh cache
    async refreshCache() {
        this.cache.weather = null;
        this.cache.events = null;
        this.cache.weatherTimestamp = 0;
        this.cache.eventsTimestamp = 0;
        
        // Pre-fetch data
        await Promise.all([
            this.getWeather(),
            this.getEvents()
        ]);
    }
}

export default Scheduler;