import { z } from "zod";
import { createValidationError } from "./errors.js";

/**
 * Essential validation schemas only
 */
export const ValidationSchemas = {
  apiEndpoint: z.string().min(1).regex(/^\//),
  email: z.string().email(),
  apiKey: z.string().min(10),
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


/**
 * Format theme name from user input to proper theme name
 * Examples: "Modern Minimal" -> "modern-minimal", "Dark Blue" -> "dark-blue"
 */
export function formatThemeName(themeName: string): string {
  // Convert to lowercase, replace spaces with dashes, remove extra characters
  return themeName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/[^a-z0-9-]/g, '') // Remove any characters that aren't alphanumeric or dashes
    .replace(/-+/g, '-') // Replace multiple consecutive dashes with single dash
    .replace(/^-|-$/g, ''); // Remove leading and trailing dashes
}

/**
 * Determine if theme name is a public theme or private user theme
 * Public themes: simple names like "modern-minimal", "dark-blue", etc.
 * Private themes: UUID format or complex naming patterns
 */
export function getThemeNamespace(themeName: string): string {
  const formattedName = formatThemeName(themeName);

  return `@ss-themes/${formattedName}`;
}