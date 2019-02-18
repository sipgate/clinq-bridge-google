import { Adapter, Config, Contact, ServerError, start } from "@clinq/bridge";
import { ContactTemplate, ContactUpdate } from "@clinq/bridge/dist/models";
import { Request } from "express";
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

class GoogleContactsAdapter implements Adapter {

	public async getContacts({ apiKey }: Config): Promise<Contact[]> {
		try {
			const client = await getAuthorizedOAuth2Client(apiKey);
			return await getGoogleContacts(client);
		} catch (error) {
			console.error(`Could not get contacts for key "${anonymizeKey(apiKey)}"`, error.message);
			throw new ServerError(401, "Unauthorized");
		}
	}

	public async createContact({ apiKey }: Config, contact: ContactTemplate): Promise<Contact> {
		const anonymizedKey = anonymizeKey(apiKey);
		try {
			console.log(`Authorizing client for key ${anonymizedKey}`);
			const client = await getAuthorizedOAuth2Client(apiKey);
			console.log(`Creating contact for key ${anonymizedKey}`);

			return await createGoogleContact(client, contact);
		} catch (error) {
			if (error.code && error.errors && error.errors.length > 0) {
				console.error(
					`Could not delete contact for key "${anonymizeKey(apiKey)}: ${JSON.stringify(
						error.errors
					)}"`
				);
				throw new ServerError(error.code, JSON.stringify(error.errors[0]));
			}
			console.error(`Could not create contact for key "${anonymizedKey}: ${error.message}"`);
			throw new ServerError(400, "Could not create contact");
		}
	}

	public async updateContact(
		{ apiKey }: Config,
		id: string,
		contact: ContactUpdate
	): Promise<Contact> {
		const anonymizedKey = anonymizeKey(apiKey);
		try {
			console.log(`Authorizing client for key ${anonymizedKey}`);
			const client = await getAuthorizedOAuth2Client(apiKey);
			console.log(`Updating contact for key ${anonymizedKey}`);

			return await updateGoogleContact(client, id, contact);
		} catch (error) {
			if (error.code && error.errors && error.errors.length > 0) {
				console.error(
					`Could not delete contact for key "${anonymizeKey(apiKey)}: ${JSON.stringify(
						error.errors
					)}"`
				);
				throw new ServerError(error.code, JSON.stringify(error.errors[0]));
			}
			console.error(`Could not update contact for key "${anonymizeKey(apiKey)}: ${error.message}"`);
			throw new ServerError(400, "Could not update contact");
		}
	}

	public async deleteContact({ apiKey }: Config, id: string): Promise<void> {
		try {
			const client = await getAuthorizedOAuth2Client(apiKey);
			await deleteGoogleContact(client, id);

		} catch (error) {
			if (error.code && error.errors && error.errors.length > 0) {
				console.error(
					`Could not delete contact for key "${anonymizeKey(apiKey)}: ${JSON.stringify(
						error.errors
					)}"`
				);
				throw new ServerError(error.code, JSON.stringify(error.errors[0]));
			}
			console.error(`Could not delete contact for key "${anonymizeKey(apiKey)}: ${error.message}"`);
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

}

start(new GoogleContactsAdapter());
