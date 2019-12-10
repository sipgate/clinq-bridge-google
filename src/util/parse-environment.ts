import fs from "fs";

const SECRETS_FILE = "./dist/secrets.json";

export interface OAuth2Options {
	clientId: string;
	clientSecret: string;
	redirectUrl: string;
}

const {
	GOOGLE_CLIENT_ID: clientId,
	GOOGLE_CLIENT_SECRET: clientSecretFromEnv,
	GOOGLE_REDIRECT_URL: redirectUrl
} = process.env;

function readSecretFromFile(): string | null {
	try {
		const content = fs.readFileSync(SECRETS_FILE, { encoding: "utf8" });
		const { GOOGLE_CLIENT_SECRET } = JSON.parse(content);
		return GOOGLE_CLIENT_SECRET;
	} catch {
		return null;
	}
}

export default function parseEnvironment(): OAuth2Options {
	const clientSecretFromFile = readSecretFromFile();

	console.log(process.cwd());

	const clientSecret = clientSecretFromFile || clientSecretFromEnv;

	if (!clientId) {
		throw new Error("Missing client ID in environment.");
	}

	if (!clientSecret) {
		throw new Error("Missing client secret in environment.");
	}

	if (!redirectUrl) {
		throw new Error("Missing redirect URI in environment.");
	}

	return {
		clientId,
		clientSecret,
		redirectUrl
	};
}
