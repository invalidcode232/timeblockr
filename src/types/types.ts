import * as z from 'zod';

/*
 * "General" info of any event.
 * This is the payload that will be sent to Google's API,
 * as well as what we filter from when we retrieve the events from Google Calendar.
 */
/*
 * This is the payload that will be sent to the AI for scheduling any new event
 */
// Base schemas
const CalendarEventSchema = z.object({
    summary: z.string(),
    startTime: z.string().nullable().optional(),
    endTime: z.string().nullable().optional(),
    location: z.string().nullable().optional()
});

const ExternalDataSchema = z.object({
    name: z.string(),
    value: z.string()
});

// Zod schemas for payload validation
const AddEventPayloadSchema = z.object({
    events: z.array(CalendarEventSchema),
    newEvent: CalendarEventSchema,
    currentDate: z.string()
});

const UpdateEventPayloadSchema = z.object({
    events: z.array(CalendarEventSchema),
    eventId: z.string(),
    updates: CalendarEventSchema.partial(),
    currentDate: z.string()
});

const CancelEventPayloadSchema = z.object({
    events: z.array(CalendarEventSchema),
    eventId: z.string(),
    currentDate: z.string()
});

const FeedbackPayloadSchema = z.object({
    eventId: z.string(),
    feedback: z.string(),
    currentDate: z.string()
});

// Result schemas
const AddEventResultSchema = z.object({
    startTime: z.string(),
    endTime: z.string(),
    message: z.string()
});

const UpdateEventResultSchema = z.object({
    eventId: z.string(),
    updates: CalendarEventSchema.partial()
});

const CancelEventResultSchema = z.object({
    eventId: z.string(),
    success: z.boolean()
});

const FeedbackResultSchema = z.object({
    eventId: z.string(),
    processed: z.boolean()
});

const AISummarizerPayloadSchema = z.object({
    currentCondition: z.string(),
    currentTemperature: z.number(),
    events: z.array(CalendarEventSchema),
    currentDate: z.string()
});

const AISummarizerResultSchema = z.object({
    startTime: z.string(),
    endTime: z.string(),
    message: z.string()
});

// Weather data type
const WeatherDataSchema = z.object({
    temp: z.object({
        cur: z.number()
    }),
    conditionId: z.number()
});

// Intent enum
enum Intent {
    ADD_EVENT = 'add_event',
    UPDATE_EVENT = 'update_event',
    CANCEL_EVENT = 'cancel_event',
    FEEDBACK = 'feedback',
}

interface IntentResult {
    type: Intent;
    result: AddEventResult | UpdateEventResult | CancelEventResult | FeedbackResult;
}

// Export all schemas
export {
    AISummarizerResultSchema,
    AISummarizerPayloadSchema,
    AddEventPayloadSchema,
    UpdateEventPayloadSchema,
    CancelEventPayloadSchema,
    FeedbackPayloadSchema,
    AddEventResultSchema,
    UpdateEventResultSchema,
    CancelEventResultSchema,
    FeedbackResultSchema,
    WeatherDataSchema,
    Intent,
    type IntentResult
};


// Export all types derived from schemas
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type ExternalData = z.infer<typeof ExternalDataSchema>;
export type AddEventPayload = z.infer<typeof AddEventPayloadSchema>;
export type UpdateEventPayload = z.infer<typeof UpdateEventPayloadSchema>;
export type CancelEventPayload = z.infer<typeof CancelEventPayloadSchema>;
export type FeedbackPayload = z.infer<typeof FeedbackPayloadSchema>;
export type AddEventResult = z.infer<typeof AddEventResultSchema>;
export type UpdateEventResult = z.infer<typeof UpdateEventResultSchema>;
export type CancelEventResult = z.infer<typeof CancelEventResultSchema>;
export type FeedbackResult = z.infer<typeof FeedbackResultSchema>;
export type AISummarizerPayload = z.infer<typeof AISummarizerPayloadSchema>;
export type WeatherData = z.infer<typeof WeatherDataSchema>;
export type IntentPayload = AddEventPayload | UpdateEventPayload | CancelEventPayload | FeedbackPayload;
