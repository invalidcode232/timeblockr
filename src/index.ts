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

const main = async () => {
    const userInput = await prompts({
        type: 'text',
        name: 'value',
        message: 'What do you want to do?',
    }).then((res) => res.value);

    // In the future, we will run this through an NLP model to get the intent
    // and the entities from the user input
    // The intent would determine which external API to call
    // For example, if the user wants to hike, we would call the weather API during the specific time
    // We would parse userInput to get the intent, entities, and time.
    //
    // e.g. if intent = hike and time = 9 PM on Tuesday, we would call the weather API, to get the specified weather
    // put into newEvent
    // newEvent will then be passed to AIPayload

    const sampleNewEvent: CalendarEvent = {
        summary: userInput,
    };

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

    const aiSummarizerPayload: AISummarizerPayload = {
        currentCondition: WeatherClient.getConditionFromId(weather.conditionId),
        currentTemperature: weather.temp.cur,
        events: events,
        currentDate: new Date().toISOString(),
    };

    const summarizerRes = await aiClient.getSummary(
        JSON.stringify(aiSummarizerPayload)
    );

    logger.info('retrieved summary data');
    logger.info(summarizerRes);

    const aiSchedulerPayload: AISchedulerPayload = {
        events: events,
        newEvent: sampleNewEvent,
        currentDate: new Date().toISOString(),
    };

    const schedulerRes = await aiClient.doScheduling(aiSchedulerPayload);

    if (!schedulerRes) {
        logger.error('failed to add new scheduling');
        return;
    }

    logger.info('successfully received response from llm');
    logger.info('response from llm: ' + JSON.stringify(schedulerRes, null, 4));

    logger.info('startTime: ', schedulerRes.startTime);
    logger.info('startTime: ', schedulerRes.endTime);
    const newEvent: CalendarEvent = {
        summary: userInput,
        startTime: schedulerRes.startTime?.toISOString(),
        endTime: schedulerRes.endTime?.toISOString(),
        // we would also add location here
    };

    const addRes = await gClient.addEvent(newEvent);
    logger.info('successfully added event: ', JSON.stringify(addRes, null, 4));
};

main();
