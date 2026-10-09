/**
 * Simplified function-based error handling for Shadcn Studio MCP Server
 */

/**
 * Simple error interface for MCP responses
 */
export interface McpErrorResponse {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
}

/**
 * Create API request failed error - shows server message as-is
 */
export function createApiError(endpoint: string, statusCode: number, serverMessage?: string): Error {
  const message = serverMessage || `Request failed for ${endpoint} (HTTP ${statusCode})`;
  const error = new Error(message);
  error.name = 'ApiError';
  return error;
}

/**
 * Create network error
 */
export function createNetworkError(endpoint: string, originalError: Error): Error {
  const error = new Error(`Network error while connecting to ${endpoint}: ${originalError.message}`);
  error.name = 'NetworkError';
  return error;
}

/**
 * Create validation error from Zod
 */
export function createValidationError(zodError: any): Error {
  const errors = zodError.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`);
  const error = new Error(`Validation failed: ${errors.join(', ')}`);
  error.name = 'ValidationError';
  return error;
}

/**
 * Handle any error and format for MCP response - shows raw server messages
 */
export function handleMcpError(error: unknown): McpErrorResponse {
  const message = error instanceof Error ? error.message : String(error);

  return {
    content: [{ type: "text", text: message }], // Just the raw message, no JSON wrapping
    isError: true,
  };
}