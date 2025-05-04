import GoogleClient from './libs/google';
import logger from './utils/logging';
import AIClient from './libs/openai';
import WeatherClient from './libs/weather';
import type { AISummarizerPayload, AISchedulerPayload, CalendarEvent } from './types/types';

const main = async () => {
    const userInput = "Do math homework"; // example user input

    // In the future, we will run this through an NLP model to get the intent
    // and the entities from the user input
    // The intent would determine which external API to call
    // For example, if the user wants to hike, we would call the weather API during the specific time
    // We would parse userInput to get the intent, entities, and time and pass them to payload.
    // 
    // e.g. if intent = hike and time = 9 PM on Tuesday, we would call the weather API, to get the specified weather

    const gClient = new GoogleClient();
    const aiClient = new AIClient();
    const weatherClient = new WeatherClient();

    await gClient.auth();

    logger.info('authentication successful');

    const events = await gClient.getEvents();
    if (!events) return;

    logger.info(
        'successfully received events - event count: ' +
        events.length.toString()
    );

    const weather = await weatherClient.getWeather();
    logger.info(
        'successfully received weather data - current weather: ' +
        weather.temp.cur.toString() +
        'c, conditionId: ' +
        weather.conditionId.toString()
    );

    const sampleNewEvent: CalendarEvent = {
        summary: userInput,
    }

    const aiPayload: AISchedulerPayload = {
        currentTemperature: weather.temp.cur,
        currentCondition: WeatherClient.getConditionFromId(weather.conditionId),
        events: events,
        newEvent: sampleNewEvent,
    };

    const schedulerRes = await aiClient.doScheduling(JSON.stringify(aiPayload));

    logger.info('successfully received response from llm');

    console.log(schedulerRes);
};

main();
