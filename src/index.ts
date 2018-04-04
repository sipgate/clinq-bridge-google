import axios from "axios";
import { Contact, CrmAdapter, CrmConfig, start } from "clinq-crm-bridge";
import { resolve } from "dns";
import { Request } from "express";
import { google } from "googleapis";
import queryString = require("querystring");

const OAuth2 = google.auth.OAuth2;

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL } = process.env;

const getOAuth2Client = () =>
	new OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL);

const GOOGLE_CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts.readonly";
const GOOGLE_PEOPLE_CONNECTIONS_API = "https://people.googleapis.com/v1/people/me/connections";
const RELEVANT_GOOGLE_PHONE_NUMBER_TYPES = ["home", "work", "mobile"];

class GoogleContactsAdapter implements CrmAdapter {
	public async getContacts(config: CrmConfig): Promise<Contact[]> {
		const [access_token, refresh_token] = config.apiKey.split(":");
		const client = getOAuth2Client();
		client.setCredentials({
			access_token,
			refresh_token
		});
		const refreshedTokens: any = await new Promise((resolve, reject) =>
			client.refreshAccessToken((err, tokens) => {
				if (err) {
					reject(err);
				}
				resolve(tokens);
			})
		);
		const query = queryString.stringify({
			access_token: refreshedTokens.access_token,
			personFields: ["names", "phoneNumbers"]
		});
		return axios(`${GOOGLE_PEOPLE_CONNECTIONS_API}?${query}`).then(res => {
			console.log(JSON.stringify(res.data.connections, null, 2)); // tslint:disable-line
			const contacts = res.data.connections.map(connection => ({
				name: connection.names[0].displayName,
				phoneNumbers: connection.phoneNumbers
					.filter(phoneNumber => RELEVANT_GOOGLE_PHONE_NUMBER_TYPES.indexOf(phoneNumber.type) >= 0)
					.map(phoneNumber => ({
						label: phoneNumber.formattedType,
						phoneNumber: phoneNumber.value
					}))
			}));
			return contacts;
		});
	}

	public async getOAuth2RedirectUrl(): Promise<string> {
		return getOAuth2Client().generateAuthUrl({
			access_type: "offline",
			scope: GOOGLE_CONTACTS_SCOPE
		});
	}

	public handleOAuth2Callback(req: Request): Promise<CrmConfig> {
		const { code } = req.query;
		return new Promise<CrmConfig>((resolve, reject) => {
			getOAuth2Client().getToken(code, (err, tokens) => {
				if (err) {
					reject(err);
				}
				const { access_token, refresh_token } = tokens;
				console.log(`${access_token}:${refresh_token}`); // tslint:disable-line
				resolve({
					apiKey: `${access_token}:${refresh_token}`,
					apiUrl: ""
				});
			});
		});
	}
}

start(new GoogleContactsAdapter());
