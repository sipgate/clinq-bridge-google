import { Adapter, Config, Contact, start } from "@clinq/bridge";
import { Request } from "express";
import { OAuth2Client } from "google-auth-library";
import { getGoogleContacts, getOAuth2Client, getOAuth2RedirectUrl } from "./util";

const cache = new Map<string, Contact[]>();

async function populateCache(client: OAuth2Client, apiKey: string): Promise<void> {
	try {
		const contacts = await getGoogleContacts(client);
		cache.set(apiKey, contacts);
	} catch (error) {
		console.error(error.message);
	}
}

class GoogleContactsAdapter implements Adapter {
	public async getContacts(config: Config): Promise<Contact[]> {
		const [access_token, refresh_token] = config.apiKey.split(":");
		const client = getOAuth2Client();
		client.setCredentials({
			access_token,
			refresh_token
		});
		await client.refreshAccessToken();
		populateCache(client, config.apiKey);
		const contacts = cache.get(config.apiKey) || [];
		return contacts;
	}

	public async getOAuth2RedirectUrl(): Promise<string> {
		return getOAuth2RedirectUrl();
	}

	public async handleOAuth2Callback(req: Request): Promise<Config> {
		const { code } = req.query;
		const client = getOAuth2Client();
		const {
			tokens: { access_token, refresh_token }
		} = await client.getToken(code);
		const config: Config = {
			apiKey: `${access_token}:${refresh_token}`,
			apiUrl: ""
		};
		console.log("Saving config:", config);
		return config;
	}
}

start(new GoogleContactsAdapter());
