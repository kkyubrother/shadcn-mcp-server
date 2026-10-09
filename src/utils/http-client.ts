import { config, isPro } from "./config.js";
import { createApiError, createNetworkError } from "./errors.js";
import { Validator, ValidationSchemas } from "./validation.js";

export const API_KEY = config.apiKey;
export const EMAIL = config.email;

export const BASE_URL = "https://shadcnstudio.com";

interface HttpClient {
    get<T>(endpoint: string, options?: RequestInit): Promise<{ status: number; data: T }>;
}

/**
 * Optimized credential validation for pro users
 */
function validateCredentialsForProUsers() {
    if (isPro()) {
        Validator.validateCredentials(API_KEY!, EMAIL!);
    }
}

const get = async <T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<{ status: number; data: T }> => {
        try {
            validateCredentialsForProUsers();
            ValidationSchemas.apiEndpoint.parse(endpoint);

            const headers: Record<string, string> = { "Content-Type": "application/json" };

            if (isPro()) {
                headers["x-license-key"] = API_KEY!;
                headers["x-email"] = EMAIL!;
            }

            const requestInit: RequestInit = {
                ...options,
                method: "GET",
                signal: options.signal
                    ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
                    : AbortSignal.timeout(30000),
                headers: { ...headers, ...options.headers as Record<string, string> },
            };

            const response = await fetch(`${BASE_URL}${endpoint}`, requestInit);

            const contentType = response.headers.get('content-type');
            const responseData = contentType?.includes('application/json')
                ? await response.json()
                : await response.text();

            // If request failed, throw error with server's actual error message
            if (response.status >= 400) {
                let errorMessage = `HTTP ${response.status}`;

                // Extract actual error message from server response
                if (typeof responseData === 'object' && responseData) {
                    // Look for nested error structures like license verification
                    if ('error' in responseData && typeof responseData.error === 'object' && responseData.error) {
                        // Handle nested error object (like license verification result)
                        const nestedError = responseData.error as any;
                        if ('error' in nestedError) {
                            errorMessage = nestedError.error as string;
                        } else if ('message' in nestedError) {
                            errorMessage = nestedError.message as string;
                        }
                    } else if ('message' in responseData) {
                        errorMessage = responseData.message as string;
                    } else if ('error' in responseData) {
                        errorMessage = responseData.error as string;
                    } else if ('detail' in responseData) {
                        errorMessage = responseData.detail as string;
                    } else if ('description' in responseData) {
                        errorMessage = responseData.description as string;
                    }

                    // Check for license verification structure specifically
                    if ('success' in responseData && 'error' in responseData && !responseData.success) {
                        errorMessage = responseData.error as string;
                    }
                } else if (typeof responseData === 'string') {
                    errorMessage = responseData;
                }
                throw createApiError(endpoint, response.status, errorMessage);
            }

            return { status: response.status, data: responseData as T };
        } catch (error) {
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw createNetworkError(endpoint, error);
            }
            if (error instanceof Error && (error.name === 'ValidationError' || error.name === 'ApiError')) {
                throw error;
            }
            throw createApiError(endpoint, 0, `Network error: ${error instanceof Error ? error.message : String(error)}`);
        }
};

export const apiClient: HttpClient = { get };
