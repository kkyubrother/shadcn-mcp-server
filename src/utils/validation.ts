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

// Sections whose block names don't start with the section slug (e.g. charts-component -> chart-component-01)
const SECTION_BLOCK_PREFIXES: Record<string, string> = {
  "charts-component": "chart-component",
  "widgets-component": "widget-component",
};

/**
 * Convert a Figma component instance name to a registry block name.
 * Block names are "{section}-{NN}", so the section slug is taken from the path
 * instead of the instance title, which often differs ("Feature 01" vs "features-section-01").
 * Examples: "Pro Blocks / Marketing-ui / features-section / Feature 01" -> "features-section-01",
 *           "Free Blocks / Marketing-ui / hero-section / Hero 3" -> "hero-section-03"
 */
export function figmaToBlockName(componentName: string): string {
  const parts = componentName.split('/').map((part) => part.trim());
  const title = parts[parts.length - 1];
  const section = parts.length > 2 ? formatThemeName(parts[parts.length - 2]) : "";
  const number = title.match(/(\d+)$/)?.[1];

  if (!section || !number) {
    return formatThemeName(title);
  }

  const prefix = SECTION_BLOCK_PREFIXES[section] ?? section;
  return `${prefix}-${number.padStart(2, '0')}`;
}
