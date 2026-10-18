export interface Config {
    apiKey?: string;
    email?: string;
}

const keyValuePatterns = [
    /^([A-Z_]+)=(.+)$/, // API_KEY=value format
    /^--([A-Z_]+)=(.+)$/, // --API_KEY=value format
    /^\/([A-Z_]+):(.+)$/, // /API_KEY:value format (Windows style)
    /^-([A-Z_]+)[ =](.+)$/, // -API_KEY value or -API_KEY=value format
];

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const parseArguments = (): Config => {
    // Environment variables first; command line arguments override them
    const config: Config = { apiKey: process.env.API_KEY, email: process.env.EMAIL };

    for (const arg of process.argv) {
        const match = keyValuePatterns.map((pattern) => arg.match(pattern)).find(Boolean);
        if (!match) continue;

        const [, key, value] = match;
        // Strip surrounding quotes from the value
        const cleanValue = value.replaceAll('"', "").replaceAll("'", "");

        if (key === "API_KEY") {
            config.apiKey = cleanValue;
        } else if (key === "EMAIL") {
            if (emailRegex.test(cleanValue)) {
                config.email = cleanValue;
            } else {
                console.error(`Invalid email format: ${cleanValue}`);
            }
        }
    }

    return config;
};

export const config = parseArguments();

/**
 * Check if user has pro credentials (both API_KEY and EMAIL provided)
 */
export const isPro = (): boolean => !!(config.apiKey && config.email);
