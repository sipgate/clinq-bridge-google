import { Contact } from "@clinq/bridge";
import { OAuth2Client } from "google-auth-library/build/src/auth/oauth2client";
import { google, people_v1 } from "googleapis";
import { connect } from "net";
import parseEnvironment from "./parse-environment";

const { people } = google.people("v1");

const GOOGLE_CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts.readonly";
const RELEVANT_PHONE_NUMBER_TYPES = ["home", "work", "mobile"];

const { clientId, clientSecret, redirectUrl } = parseEnvironment();

const resourceName = "people/me";
const personFields = ["metadata", "names", "emailAddresses", "organizations", "phoneNumbers"].join(
	","
);

interface PhoneNumber {
	label: string | null;
	phoneNumber: string;
}

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

export async function getGoogleContacts(client: OAuth2Client): Promise<Contact[]> {
	const response = await people.connections.list({
		auth: client,
		personFields,
		resourceName
	});

	const { connections } = response.data;

	if (!Array.isArray(connections)) {
		return [];
	}

	const contacts: Contact[] = [];

	for (const connection of connections) {
		const id = getGoogleContactId(connection);
		const name = getGoogleContactName(connection);
		const company = getGoogleContactCompany(connection);
		const email = getGoogleContactPrimraryEmailAddress(connection);
		const phoneNumbers = getGoogleContactPhoneNumbers(connection);

		if (id && name && phoneNumbers) {
			contacts.push({
				id,
				name,
				email,
				company,
				phoneNumbers
			});
		}
	}

	return contacts;
}

export function getGoogleContactId(connection: people_v1.Schema$Person): string | null {
	const { metadata } = connection;
	if (!metadata || !metadata.sources) {
		return null;
	}
	const contactMetadata = metadata.sources.find(entry => entry.type === "CONTACT");
	if (!contactMetadata || !contactMetadata.id) {
		return null;
	}
	return contactMetadata.id;
}

export function getGoogleContactName(connection: people_v1.Schema$Person): string | null {
	if (!connection.names) {
		return null;
	}
	const [name] = connection.names;
	if (!name) {
		return null;
	}
	return name.displayName || null;
}

export function getGoogleContactCompany(connection: people_v1.Schema$Person): string | null {
	if (!connection.organizations) {
		return null;
	}
	const [company] = connection.organizations;
	if (!company) {
		return null;
	}
	return company.name || null;
}

export function getGoogleContactPhoneNumbers(
	connection: people_v1.Schema$Person
): PhoneNumber[] | null {
	if (!connection.phoneNumbers) {
		return null;
	}
	const relevantPhoneNumbers = connection.phoneNumbers.filter(
		phoneNumber => phoneNumber.type && RELEVANT_PHONE_NUMBER_TYPES.indexOf(phoneNumber.type) >= 0
	);
	const phoneNumbers: PhoneNumber[] = [];
	for (const phoneNumber of relevantPhoneNumbers) {
		if (phoneNumber.value) {
			phoneNumbers.push({
				label: phoneNumber.formattedType || null,
				phoneNumber: phoneNumber.value
			});
		}
	}
	if (phoneNumbers.length < 1) {
		return null;
	}
	return phoneNumbers;
}

export function getGoogleContactPrimraryEmailAddress(
	connection: people_v1.Schema$Person
): string | null {
	const { emailAddresses } = connection;
	if (!emailAddresses) {
		return null;
	}
	const primaryEmailAddress = emailAddresses.find(entry =>
		Boolean(entry.metadata && entry.metadata.primary)
	);
	if (!primaryEmailAddress) {
		return null;
	}
	return primaryEmailAddress.value || null;
}
