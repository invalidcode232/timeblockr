import { z } from "zod";

const validatePayload = (payload: any, schema: z.ZodSchema<any>) => {
    const result = schema.safeParse(payload);
    if (!result.success) {
        throw new Error(result.error.message);
    }
    return result.data;
};

export default validatePayload;