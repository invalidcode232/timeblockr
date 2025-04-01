import GoogleClient from './libs/google';
import logger from './utils/logging';
import AIClient from './libs/openai';
import path from 'path';

const main = async () => {
    const credentialsFile = Bun.file(
        path.join(process.cwd(), 'credentials', 'credentials.json')
    );

    if (!credentialsFile.exists()) {
        logger.error(
            'credentials file not found. please provide a valid credentials.json from Google Developer Console'
        );

        return;
    }

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
