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

  return toRegistryItem(formattedName);
}

/**
 * Namespace registered for shadcn/studio in the public shadcn registry index
 * (https://ui.shadcn.com/r/registries.json). Legacy @ss-* namespaces are not registered
 * there, so `npx shadcn add @ss-blocks/...` fails with "Unknown registry".
 */
export const REGISTRY_NAMESPACE = "@shadcn-studio";

/**
 * Registry style used when fetching items directly (/r/{style}/{name}.json)
 */
export const REGISTRY_STYLE = "new-york-v4";

const LEGACY_NAMESPACE_PATTERN = /^@ss-(blocks|components|themes)\//;

/**
 * Convert an item name to an installable registry item
 * Examples: "hero-section-01" -> "@shadcn-studio/hero-section-01",
 *           "@ss-blocks/hero-section-01" -> "@shadcn-studio/hero-section-01"
 */
export function toRegistryItem(name: string): string {
  const trimmed = name.trim();

  if (LEGACY_NAMESPACE_PATTERN.test(trimmed)) {
    return trimmed.replace(LEGACY_NAMESPACE_PATTERN, `${REGISTRY_NAMESPACE}/`);
  }

  if (trimmed.startsWith("@")) {
    return trimmed;
  }

  return `${REGISTRY_NAMESPACE}/${trimmed}`;
}