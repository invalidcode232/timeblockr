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
    AISummarizerPayloadSchema 
} from "../types/types";
import { Intent } from "../types/types";
import logger from "../utils/logging";
import validatePayload from "../utils/validate";

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

    async addEvent(userInput: string): Promise<IntentResult & { type: Intent.ADD_EVENT; result: AddEventResult }> {
        const events = await this.getEvents();

        // TODO: parse userInput to get summary, startTime, endTime, etc.
        // Determine activity type, get data based on activity type

        const intentPayload: AddEventPayload = {
            events,
            newEvent: { summary: userInput }, 
            currentDate: new Date().toISOString()
        };

        const intentResult = await this.aiClient.processIntent(Intent.ADD_EVENT, intentPayload);

        return intentResult as IntentResult & { type: Intent.ADD_EVENT; result: AddEventResult };
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