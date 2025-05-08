import GoogleClient from './libs/google';
import logger from './utils/logging';
import AIClient from './libs/openai';
import WeatherClient from './libs/weather';
import Scheduler from './libs/scheduler';
import type {
    CalendarEvent,
    AddEventResult,
} from './types/types';
import { Intent } from './types/types';
import prompts from 'prompts';

// Configuration interface
interface Config {
    maxRetries: number;
    cacheDuration: number;
}

// Default configuration
const config: Config = {
    maxRetries: 3,
    cacheDuration: 5 * 60 * 1000, // 5 minutes in milliseconds
};

// Cache for weather and calendar data
interface WeatherData {
    temp: {
        cur: number;
    };
    conditionId: number;
}

const cache = {
    weather: null as WeatherData | null,
    weatherTimestamp: 0,
    events: null as CalendarEvent[] | null,
    eventsTimestamp: 0,
};

// Validate user input
const validateUserInput = (input: string): boolean => {
    if (!input || input.trim().length === 0) {
        logger.error('Invalid user input: empty or whitespace only');
        return false;
    }
    return true;
};

// Get weather data with caching
const getWeatherData = async (weatherClient: WeatherClient) => {
    const now = Date.now();
    if (cache.weather && now - cache.weatherTimestamp < config.cacheDuration) {
        logger.info('Using cached weather data');
        return cache.weather;
    }

    const weather = await weatherClient.getWeather();
    cache.weather = weather;
    cache.weatherTimestamp = now;
    return weather;
};

// Get calendar events with caching
const getCalendarEvents = async (gClient: GoogleClient) => {
    const now = Date.now();
    if (cache.events && now - cache.eventsTimestamp < config.cacheDuration) {
        logger.info('Using cached calendar events');
        return cache.events;
    }

    const events = await gClient.getEvents();
    if (!events) {
        throw new Error('Failed to fetch calendar events');
    }
    cache.events = events;
    cache.eventsTimestamp = now;
    return events;
};

const main = async () => {
    // #region Initialize clients
    const gClient = new GoogleClient();
    const aiClient = new AIClient();
    const weatherClient = new WeatherClient();
    const scheduler = new Scheduler(aiClient, weatherClient, gClient);

    await gClient.auth();
    logger.info('Google authentication successful');
    // #endregion

    // #region Get user input
    const { value: userInput } = await prompts({
        type: 'text',
        name: 'value',
        message: 'What do you want to do?',
    });

    if (!validateUserInput(userInput)) {
        logger.error('Invalid user input');
        return;
    }
    // #endregion

    // #region Summarizer
    const summary = await scheduler.getSummary();
    logger.info(`Retrieved summary: ${JSON.stringify(summary, null, 4)}`);
    // #endregion

    // #region Scheduler
    const intentResult = await scheduler.handleUserInput(userInput);
    logger.debug(`intentResult:\n${JSON.stringify(intentResult, null, 4)}`);

    if (intentResult.type === Intent.ADD_EVENT) {
        const addEventResult = intentResult.result as AddEventResult;
        const newEvent: CalendarEvent = {
            summary: userInput,
            startTime: addEventResult.startTime,
            endTime: addEventResult.endTime,
        };

        // Add event to calendar
        const addRes = await gClient.addEvent(newEvent);
        logger.debug(`addRes:\n${JSON.stringify(addRes, null, 4)}`);

        logger.info(`Added event to calendar. Justification: ${addEventResult.message}`);
    }
    // #endregion
};

// Run the application
main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
