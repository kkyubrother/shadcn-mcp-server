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

/**
 * Namespace registered for shadcn/studio in the public shadcn registry index
 * (https://ui.shadcn.com/r/registries.json). Legacy @ss-* namespaces are not registered
 * there, so `npx shadcn add @ss-blocks/...` fails with "Unknown registry".
 */
const REGISTRY_NAMESPACE = "@shadcn-studio";

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
  return trimmed.startsWith("@") ? trimmed : `${REGISTRY_NAMESPACE}/${trimmed}`;
}
