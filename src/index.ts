import GoogleClient from './libs/google';
import logger from './utils/logging';
import AIClient from './libs/openai';
import WeatherClient from './libs/weather';
import type { AIPayload } from './types/types';

const main = async () => {
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

    const aiPayload: AIPayload = {
        currentTemperature: weather.temp.cur,
        currentCondition: WeatherClient.getConditionFromId(weather.conditionId),
        events: events,
    };

    const res = await aiClient.getSummary(JSON.stringify(aiPayload));

    logger.info('successfully received response from llm');

    console.log(res);
};

main();
