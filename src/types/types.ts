type CalendarEvent = {
    summary: string;
    startTime?: string | null;
    endTime?: string | null;
    // we would also add location and others
};

type ExternalData = { // storage to put weather, traffic time, etc.
    name: string;
    value: string;
}

type NewEvent = {
    summary: string;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    externalData?: ExternalData[];
};


interface AISummarizerPayload {
    currentCondition: string;
    currentTemperature: number;
    events: CalendarEvent[];
}

interface AISchedulerPayload {
    currentCondition?: string;
    currentTemperature?: number;
    events: CalendarEvent[];
    newEvent?: NewEvent;
}

export type { CalendarEvent, AISummarizerPayload, AISchedulerPayload };
