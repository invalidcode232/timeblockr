type CalendarEvent = {
    summary: string;
    startTime?: string | null;
    endTime?: string | null;
};

type NewEvent = {
    summary: string;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
};

interface AISummarizerPayload {
    currentCondition: string;
    currentTemperature: number;
    events: CalendarEvent[];
}

interface AISchedulerPayload {
    currentCondition: string;
    currentTemperature: number;
    events: CalendarEvent[];
    newEvent?: NewEvent;
}

export type { CalendarEvent, AISummarizerPayload, AISchedulerPayload };
