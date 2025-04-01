import { authorize } from '../utils/auth';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { JSONClient } from 'google-auth-library/build/src/auth/googleauth';
import type { CalendarEvent } from '../types/types';
import logger from '../utils/logging';

class GoogleClient {
    client: OAuth2Client | JSONClient | null;

    constructor() {
        this.client = null;
    }

    auth = async () => {
        this.client = await authorize();
    };

    getEvents = async () => {
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

        const googleEvents = res.data.items;
        if (!googleEvents || googleEvents.length === 0) {
            console.log('no calendar events found');
            return null;
        }

        let events: CalendarEvent[] = [];

        googleEvents.map((event, _) => {
            if (event.summary) {
                events.push({
                    startTime: event.start?.dateTime,
                    endTime: event.end?.dateTime,
                    summary: event?.summary,
                });
            }
        });

        return events;
    };
}

export default GoogleClient;
