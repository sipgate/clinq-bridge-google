import { Adapter, Config, Contact, ServerError, start } from "@clinq/bridge";
import { ContactTemplate, ContactUpdate } from "@clinq/bridge/dist/models";
import { Request } from "express";
import { OAuth2Client } from "google-auth-library";
import { RedisCache } from "./cache";
import {
	createGoogleContact,
	deleteGoogleContact,
	getAuthorizedOAuth2Client,
	getGoogleContacts,
	getOAuth2Client,
	getOAuth2RedirectUrl,
	updateGoogleContact
} from "./util";
import { anonymizeKey } from "./util/anonymize-key";

const { REDIS_URL } = process.env;

class GoogleContactsAdapter implements Adapter {
	private cache: RedisCache;

	constructor() {
		if (!REDIS_URL) {
			throw new Error("Missing Redis URL in environment");
		}
		this.cache = new RedisCache(REDIS_URL);
	}

	public async getContacts({ apiKey }: Config): Promise<Contact[]> {
		try {
			const client = await getAuthorizedOAuth2Client(apiKey);
			this.populateCache(client, apiKey);
		} catch (error) {
			console.error(`Could not get contacts for key "${anonymizeKey(apiKey)}"`, error.message);
			throw new ServerError(401, "Unauthorized");
		}
		const cached = await this.cache.get(apiKey);
		if (cached) {
			console.log(`Returning ${cached.length} contacts for key "${anonymizeKey(apiKey)}".`);
			return cached;
		}
		return [];
	}

	public async createContact({ apiKey }: Config, contact: ContactTemplate): Promise<Contact> {
		try {
			const client = await getAuthorizedOAuth2Client(apiKey);
			const createdContact = await createGoogleContact(client, contact);

			const cached = await this.cache.get(apiKey);

			if (cached) {
				const updatedCache = [...cached, createdContact];
				await this.cache.set(apiKey, updatedCache);
			}

			return createdContact;
		} catch (error) {
			console.error(`Could not create contact for key "${anonymizeKey(apiKey)}: ${error.message}"`);
			throw new ServerError(400, "Could not create contact");
		}
	}

	public async updateContact({ apiKey }: Config, id: string, contact: ContactUpdate): Promise<Contact> {
		try {
			const client = await getAuthorizedOAuth2Client(apiKey);
			const createdContact = await updateGoogleContact(client, id, contact);

			const cached = await this.cache.get(apiKey);

			if (cached) {
				const updatedCache = cached.map(entry => entry.id === id ? createdContact : entry);
				await this.cache.set(apiKey, updatedCache);
			}

			return createdContact;
		} catch (error) {
			console.error(`Could not create contact for key "${anonymizeKey(apiKey)}: ${error.message}"`);
			throw new ServerError(400, "Could not create contact");
		}
	}

	public async deleteContact({ apiKey }: Config, id: string): Promise<void> {
		try {
			const client = await getAuthorizedOAuth2Client(apiKey);
			await deleteGoogleContact(client, id);

			const cached = await this.cache.get(apiKey);

			if (cached) {
				const updatedCache = cached.filter(entry => entry.id !== id);
				await this.cache.set(apiKey, updatedCache);
			}
		} catch (error) {
			console.error(`Could not create contact for key "${anonymizeKey(apiKey)}: ${error.message}"`);
			throw new ServerError(401, "Could not delete contact");
		}
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
		return config;
	}

	private async populateCache(client: OAuth2Client, apiKey: string): Promise<void> {
		try {
			const contacts = await getGoogleContacts(client);
			await this.cache.set(apiKey, contacts);
		} catch (error) {
			console.error(error.message);
		}
	}
}

start(new GoogleContactsAdapter());
