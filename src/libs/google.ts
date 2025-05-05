import { authorize } from '../utils/auth';
import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
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
            logger.info('no calendar events found');
            return null;
        }

        let events: CalendarEvent[] = [];

        googleEvents.map((event, _) => {
            if (event.summary) {
                events.push({
                    startTime: event.start?.dateTime,
                    endTime: event.end?.dateTime,
                    summary: event?.summary,
                    location: event?.location,
                });
            }
        });

        return events;
    };

    addEvent = async (event: CalendarEvent) => {
        if (!this.client) {
            this.auth();
        }

        const calendar = google.calendar({
            version: 'v3',
            auth: this.client as OAuth2Client,
        });

        let requestBody: calendar_v3.Schema$Event = {
            summary: event.summary,
            start: {
                dateTime: event.startTime,
            },
            end: {
                dateTime: event.endTime,
            },
        };

        if (event.location) {
            requestBody = {
                ...requestBody,
                location: event.location,
            };
        }

        // We would modify external data here if it's there

        const res = await calendar.events.insert({
            calendarId: 'primary',
            requestBody,
        });

        return res.data;
    };
}

export default GoogleClient;
