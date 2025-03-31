import { Client } from './libs/google';

const client = new Client();

await client.auth();
await client.listEvents();
