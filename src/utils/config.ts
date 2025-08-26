export interface Config {
    apiKey?: string;
    email?: string;
}

const parseArguments = (): Config => {
    const config: Config = {};

    // First, check environment variables
    if (process.env.API_KEY) {
        config.apiKey = process.env.API_KEY;
    }
    
    if (process.env.EMAIL) {
        config.email = process.env.EMAIL;
    }

    // Command line arguments override environment variables
    process.argv.forEach((arg) => {
        const keyValuePatterns = [
            /^([A-Z_]+)=(.+)$/, // API_KEY=value format
            /^--([A-Z_]+)=(.+)$/, // --API_KEY=value format
            /^\/([A-Z_]+):(.+)$/, // /API_KEY:value format (Windows style)
            /^-([A-Z_]+)[ =](.+)$/, // -API_KEY value or -API_KEY=value format
        ];

        // Email regex pattern
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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
                    // Check if the value matches the email regex pattern
                    if (emailRegex.test(cleanValue)) {
                        config.email = cleanValue;
                    } else {
                        console.error(`Invalid email format: ${cleanValue}`);
                    }
                    break;
                }
            }
        }
    });

    return config;
};

export const config = parseArguments();