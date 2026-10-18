import { config, isPro } from "./config.js";
import { createApiError, createNetworkError, createValidationError } from "./errors.js";
import { validateCredentials } from "./validation.js";

export const BASE_URL = "https://shadcnstudio.com";

/**
 * Pick the server's own error message out of a failed response body
 */
function getErrorMessage(data: any, status: number): string {
    if (typeof data === "string") return data;
    if (!data || typeof data !== "object") return `HTTP ${status}`;

    // License verification structure: { success: false, error: "..." }
    if ("success" in data && "error" in data && !data.success) return data.error;

    // Nested error object (like license verification result)
    if (data.error && typeof data.error === "object") {
        return data.error.error ?? data.error.message ?? `HTTP ${status}`;
    }

    return data.message ?? data.error ?? data.detail ?? data.description ?? `HTTP ${status}`;
}

export async function apiGet(endpoint: string): Promise<{ status: number; data: unknown }> {
    try {
        if (isPro()) validateCredentials(config.apiKey, config.email);
        if (!endpoint.startsWith("/")) {
            throw createValidationError(`Invalid endpoint: ${endpoint}`);
        }

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (isPro()) {
            headers["x-license-key"] = config.apiKey!;
            headers["x-email"] = config.email!;
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, { method: "GET", headers });
        const data = response.headers.get("content-type")?.includes("application/json")
            ? await response.json()
            : await response.text();

        if (response.status >= 400) {
            throw createApiError(endpoint, response.status, getErrorMessage(data, response.status));
        }

        return { status: response.status, data };
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw createNetworkError(endpoint, error);
        }
        if (error instanceof Error && (error.name === 'ValidationError' || error.name === 'ApiError')) {
            throw error;
        }
        throw createApiError(endpoint, 0, `Network error: ${error instanceof Error ? error.message : String(error)}`);
    }
}
