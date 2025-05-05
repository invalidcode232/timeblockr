import * as z from 'zod';

/*
 * "General" info of any event.
 * This is the payload that will be sent to Google's API,
 * as well as what we filter from when we retrieve the events from Google Calendar.
 */
type CalendarEvent = {
    summary: string;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
};

type ExternalData = {
    // storage to put weather, traffic time, etc.
    name: string;
    value: string;
};

/*
 * This is the payload that will be sent to the AI for summarizing the current schedule
 */
interface AISummarizerPayload {
    currentCondition: string;
    currentTemperature: number;
    events: CalendarEvent[];
    currentDate: string;
}

/*
 * This is the payload that will be sent to the AI for scheduling any new event
 */
interface AISchedulerPayload {
    events: CalendarEvent[];
    newEvent: CalendarEvent;
    externalData?: ExternalData[];
    currentDate: string;
}

const AISummarizerResultSchema = z.object({
    startTime: z.string(),
    endTime: z.string(),
    message: z.string(),
});

export type { CalendarEvent, AISummarizerPayload, AISchedulerPayload };

export { AISummarizerResultSchema };
