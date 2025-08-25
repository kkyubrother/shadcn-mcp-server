export interface Config {
    apiKey?: string;
    email?: string;
}

const parseArguments = (): Config => {
    const config: Config = {};

    // Command line arguments override environment variables
    process.argv.forEach((arg) => {
        const keyValuePatterns = [
            /^([A-Z_]+)=(.+)$/, // API_KEY=value format
            /^--([A-Z_]+)=(.+)$/, // --API_KEY=value format
            /^\/([A-Z_]+):(.+)$/, // /API_KEY:value format (Windows style)
            /^-([A-Z_]+)[ =](.+)$/, // -API_KEY value or -API_KEY=value format
        ];

        for (const pattern of keyValuePatterns) {
            const match = arg.match(pattern);
            if (match) {
                const [, key, value] = match;
                // Strip surrounding quotes from the value
                const cleanValue = value.replaceAll('"', "").replaceAll("'", "");
                
                if (key === "API_KEY") {
                    config.apiKey = cleanValue;
                    break;
                } else if (key === "EMAIL") {
                    config.email = cleanValue;
                    break;
                }
            }
        }
    });

    return config;
};

export const config = parseArguments();