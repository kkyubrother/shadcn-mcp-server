import { z } from "zod";
import { createValidationError } from "./errors.js";

export function validateCredentials(apiKey?: string, email?: string): void {
  const errors: string[] = [];
  if (!z.string().min(10).safeParse(apiKey).success) errors.push('Invalid API key');
  if (!z.string().email().safeParse(email).success) errors.push('Invalid email');

  if (errors.length > 0) {
    throw createValidationError(`Invalid credentials: ${errors.join(', ')}`);
  }
}

/**
 * Format theme name from user input to proper theme name
 * Examples: "Modern Minimal" -> "modern-minimal", "Dark Blue" -> "dark-blue"
 */
export function formatThemeName(themeName: string): string {
  return themeName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/[^a-z0-9-]/g, '') // Remove any characters that aren't alphanumeric or dashes
    .replace(/-+/g, '-') // Replace multiple consecutive dashes with single dash
    .replace(/^-|-$/g, ''); // Remove leading and trailing dashes
}
