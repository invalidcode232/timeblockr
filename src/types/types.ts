type CalendarEvent = {
    summary: string;
    startTime?: string | null;
    endTime?: string | null;
};

interface AIPayload {
    currentCondition: string;
    currentTemperature: number;
    events: CalendarEvent[];
}

export type { CalendarEvent, AIPayload };
