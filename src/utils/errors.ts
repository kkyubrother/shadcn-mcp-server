function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

/**
 * Create API request failed error - shows server message as-is
 */
export function createApiError(endpoint: string, statusCode: number, serverMessage?: string): Error {
  return namedError('ApiError', serverMessage || `Request failed for ${endpoint} (HTTP ${statusCode})`);
}

export function createNetworkError(endpoint: string, originalError: Error): Error {
  return namedError('NetworkError', `Network error while connecting to ${endpoint}: ${originalError.message}`);
}

export function createValidationError(message: string): Error {
  return namedError('ValidationError', `Validation failed: ${message}`);
}

/**
 * Format any error as an MCP error response - shows raw server messages
 */
export function handleMcpError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
