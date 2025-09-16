import { z } from "zod";
import { createValidationError } from "./errors.js";

/**
 * Essential validation schemas only
 */
export const ValidationSchemas = {
  apiEndpoint: z.string().min(1).regex(/^\//),
  email: z.string().email(),
  apiKey: z.string().min(10),
  httpStatus: z.number().int().min(100).max(599),
};

/**
 * Optimized validator class
 */
export class Validator {
  static validateCredentials(apiKey?: string, email?: string): { apiKey: string; email: string } {
    const errors: string[] = [];

    try { ValidationSchemas.apiKey.parse(apiKey); }
    catch { errors.push('Invalid API key'); }

    try { ValidationSchemas.email.parse(email); }
    catch { errors.push('Invalid email'); }

    if (errors.length > 0) {
      throw createValidationError(`Invalid credentials: ${errors.join(', ')}`);
    }

    return { apiKey: apiKey!, email: email! };
  }

  static validateHttpResponse(status: number, endpoint: string): void {
    if (status >= 400) {
      const message = status >= 500 ? 'Server Error' :
        status === 404 ? 'Not Found' :
          status === 401 ? 'Unauthorized' :
            'Bad Request';

      throw createValidationError(`${message} (${status}) for endpoint: ${endpoint}`);
    }
  }
}