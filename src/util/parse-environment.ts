export interface OAuth2Options {
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	GOOGLE_REDIRECT_URL: string;
}

export default function parseEnvironment(): OAuth2Options {
	const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL } = process.env;

	if (!GOOGLE_CLIENT_ID) {
		throw new Error("Missing client ID in environment.");
	}

	if (!GOOGLE_CLIENT_SECRET) {
		throw new Error("Missing client secret in environment.");
	}

	if (!GOOGLE_REDIRECT_URL) {
		throw new Error("Missing redirect URI in environment.");
	}

	return {
		GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET,
		GOOGLE_REDIRECT_URL
	};
}
