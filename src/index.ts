import GoogleClient from './libs/google';
import logger from './utils/logging';
import AIClient from './libs/openai';
import WeatherClient from './libs/weather';
import type {
    AISummarizerPayload,
    AISchedulerPayload,
    CalendarEvent,
} from './types/types';
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

// Process AI scheduling
const processAIScheduling = async (
    aiClient: AIClient,
    events: CalendarEvent[],
    userInput: string
) => {
    const aiSchedulerPayload: AISchedulerPayload = {
        events,
        newEvent: { summary: userInput },
        currentDate: new Date().toISOString(),
    };

    const schedulerRes = await aiClient.doScheduling(aiSchedulerPayload);
    if (!schedulerRes) {
        throw new Error('Failed to process AI scheduling');
    }

    console.log(schedulerRes);

    return {
        summary: userInput,
        startTime: schedulerRes.startTime?.toISOString(),
        endTime: schedulerRes.endTime?.toISOString(),
    };
};

const main = async () => {
    try {
        // Initialize clients
        const gClient = new GoogleClient();
        const aiClient = new AIClient();
        const weatherClient = new WeatherClient();

        // Authenticate with Google
        await gClient.auth();
        logger.info('Authentication successful');

        // Get user input
        const { value: userInput } = await prompts({
            type: 'text',
            name: 'value',
            message: 'What do you want to do?',
        });

        if (!validateUserInput(userInput)) {
            return;
        }

        // Fetch data with caching
        const [events, weather] = await Promise.all([
            getCalendarEvents(gClient),
            getWeatherData(weatherClient),
        ]);

        logger.info(`Successfully received ${events.length} events`);
        logger.info(
            `Current weather: ${weather.temp.cur}°C, condition: ${WeatherClient.getConditionFromId(
                weather.conditionId
            )}`
        );

        // Get AI summary
        const aiSummarizerPayload: AISummarizerPayload = {
            currentCondition: WeatherClient.getConditionFromId(weather.conditionId),
            currentTemperature: weather.temp.cur,
            events,
            currentDate: new Date().toISOString(),
        };

        const summarizerRes = await aiClient.getSummary(
            JSON.stringify(aiSummarizerPayload)
        );

        logger.info(`Retrieved summary: ${JSON.stringify(summarizerRes, null, 2)}`);

        // Process scheduling
        const newEvent = await processAIScheduling(aiClient, events, userInput);

        // Add event to calendar
        const addRes = await gClient.addEvent(newEvent);
        logger.info(`Successfully added event: ${JSON.stringify(addRes, null, 2)}`);

    } catch (error) {
        logger.error('An error occurred:', error);
        process.exit(1);
    }
};

// Run the application
main().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
});
