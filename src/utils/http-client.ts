import { config } from "./config.js";

export const API_KEY = config.apiKey;
export const EMAIL = config.email;

export const BASE_URL = "https://shadcn-studio-internal-staging.vercel.app";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface HttpClient {
    get<T>(
        endpoint: string,
        options?: RequestInit
    ): Promise<{ status: number; data: T }>;
    post<T>(
        endpoint: string,
        data?: unknown,
        options?: RequestInit
    ): Promise<{ status: number; data: T }>;
    put<T>(
        endpoint: string,
        data?: unknown,
        options?: RequestInit
    ): Promise<{ status: number; data: T }>;
    delete<T>(
        endpoint: string,
        data?: unknown,
        options?: RequestInit
    ): Promise<{ status: number; data: T }>;
    patch<T>(
        endpoint: string,
        data?: unknown,
        options?: RequestInit
    ): Promise<{ status: number; data: T }>;
}

const createMethod = (method: HttpMethod) => {
    return async <T>(
        endpoint: string,
        data?: unknown,
        options: RequestInit = {}
    ) => {
        const headers: HeadersInit = {
            "Content-Type": "application/json",
            ...(API_KEY ? { "x-license-key": API_KEY } : {}),
            ...(EMAIL ? { "x-email": EMAIL } : {}),
            ...options.headers,
        };

        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            method,
            headers,
            ...(data ? { body: JSON.stringify(data) } : {}),
        });
        return { status: response.status, data: (await response.json()) as T };
    };
};

export const apiClient: HttpClient = {
    get: createMethod("GET"),
    post: createMethod("POST"),
    put: createMethod("PUT"),
    delete: createMethod("DELETE"),
    patch: createMethod("PATCH"),
};