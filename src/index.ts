import GoogleClient from './libs/google';
import logger from './utils/logging';
import AIClient from './libs/openai';

const main = async () => {
    const gClient = new GoogleClient();
    const aiClient = new AIClient();

    await gClient.auth();

    logger.info('authentication successful');

    const events = await gClient.getEvents();
    if (!events) return;

    logger.info(
        'successfully received events - event count: ' +
            events.length.toString()
    );

    const res = await aiClient.getSummary(JSON.stringify(events));

    logger.info('successfully received response from llm');

    console.log(res);
};

main();
