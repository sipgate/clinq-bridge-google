import axios from "axios";
import { Contact } from "clinq-crm-bridge";
import { OAuth2Client } from "google-auth-library/build/src/auth/oauth2client";
import { google } from "googleapis";
import queryString = require("querystring");
import parseEnvironment from "./parse-environment";

const GOOGLE_CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts.readonly";
const GOOGLE_PEOPLE_CONNECTIONS_API = "https://people.googleapis.com/v1/people/me/connections";
const RELEVANT_PHONE_NUMBER_TYPES = ["home", "work", "mobile"];

const { clientId, clientSecret, redirectUrl } = parseEnvironment();

export function getOAuth2Client(): OAuth2Client {
	return new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
}

export function getOAuth2RedirectUrl(): string {
	const client = getOAuth2Client();
	return client.generateAuthUrl({
		access_type: "offline",
		scope: GOOGLE_CONTACTS_SCOPE
	});
}

export async function getGoogleContacts(token: string): Promise<Contact[]> {
	const query = queryString.stringify({
		access_token: token,
		personFields: ["names", "phoneNumbers"]
	});
	const response = await axios(`${GOOGLE_PEOPLE_CONNECTIONS_API}?${query}`);
	const { connections } = response.data;
	return connections.map(convertGoogleConnection);
}

export function convertGoogleConnection(connection: any): Contact {
	const name = connection.names[0].displayName;
	const phoneNumbers = connection.phoneNumbers
		.filter(phoneNumber => RELEVANT_PHONE_NUMBER_TYPES.indexOf(phoneNumber.type) >= 0)
		.map(phoneNumber => ({
			label: phoneNumber.formattedType,
			phoneNumber: phoneNumber.value
		}));
	return {
		name,
		phoneNumbers
	};
}
