import { authorize } from '../utils/auth';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { JSONClient } from 'google-auth-library/build/src/auth/googleauth';

class Client {
    client: OAuth2Client | JSONClient | null;

    constructor() {
        this.client = null;
    }

    auth = async () => {
        this.client = await authorize();
    };

    listEvents = async () => {
        if (!this.client) {
            this.auth();
        }

        const calendar = google.calendar({
            version: 'v3',
            auth: this.client as OAuth2Client,
        });

        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: new Date().toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = res.data.items;
        if (!events || events.length === 0) {
            console.log('No upcoming events found.');
            return;
        }

        console.log('Upcoming 10 events:');

        events.map((event, _) => {
            const start = event.start?.dateTime || event.start?.date;
            console.log(`${start} - ${event.summary}`);
        });
    };
}

export { Client };
