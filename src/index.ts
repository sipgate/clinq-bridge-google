import axios from "axios";
import { Contact, CrmAdapter, CrmConfig, start } from "clinq-crm-bridge";
import { Request } from "express";
import { getGoogleContacts, getOAuth2Client, getOAuth2RedirectUrl } from "./util";

class GoogleContactsAdapter implements CrmAdapter {
	public async getContacts(config: CrmConfig): Promise<Contact[]> {
		const [access_token, refresh_token] = config.apiKey.split(":");
		const client = getOAuth2Client();
		client.setCredentials({
			access_token,
			refresh_token
		});
		const { credentials } = await client.refreshAccessToken();
		const contacts = await getGoogleContacts(credentials.access_token);
		return contacts;
	}

	public async getOAuth2RedirectUrl(): Promise<string> {
		return getOAuth2RedirectUrl();
	}

	public async handleOAuth2Callback(req: Request): Promise<CrmConfig> {
		const { code } = req.query;
		const client = getOAuth2Client();
		const { tokens: { access_token, refresh_token } } = await client.getToken(code);
		return {
			apiKey: `${access_token}:${refresh_token}`,
			apiUrl: ""
		};
	}
}

start(new GoogleContactsAdapter());
