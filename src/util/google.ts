import { Contact, ContactTemplate, PhoneNumber } from "@clinq/bridge";
import { OAuth2Client } from "google-auth-library";
import { google, people_v1 } from "googleapis";
import { ContactName } from "./contact-name.model";
import parseEnvironment from "./parse-environment";

const { people } = google.people("v1");

const GOOGLE_CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts";
const RESOURCE_NAME = "people/me";
const PERSON_FIELDS = "metadata,names,emailAddresses,organizations,phoneNumbers,photos";
const PAGE_SIZE = 100;

const { clientId, clientSecret, redirectUrl } = parseEnvironment();

export function getOAuth2Client(): OAuth2Client {
	return new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
}

export async function getAuthorizedOAuth2Client(apiKey: string): Promise<OAuth2Client> {
	if (typeof apiKey !== "string") {
		throw new Error("Invalid API key.");
	}
	const [access_token, refresh_token] = apiKey.split(":");
	const client = getOAuth2Client();
	client.setCredentials({
		access_token,
		refresh_token
	});
	const response = await client.getAccessToken();
	if (!response.token) {
		throw new Error("Unauthorized");
	}
	return client;
}

export function getOAuth2RedirectUrl(): string {
	const client = getOAuth2Client();
	return client.generateAuthUrl({
		access_type: "offline",
		scope: GOOGLE_CONTACTS_SCOPE,
		prompt: "consent"
	});
}

function convertGoogleContact(connection: people_v1.Schema$Person): Contact | null {
	const id = getGoogleContactId(connection);
	const contactName = getGoogleContactName(connection);
	const company = getGoogleContactCompany(connection);
	const contactUrl = id ? `https://www.google.com/contacts/u/0/#contact/${id}` : null;
	const email = getGoogleContactPrimaryEmailAddress(connection);
	const phoneNumbers = getGoogleContactPhoneNumbers(connection);
	const avatarUrl = getGoogleContactPhoto(connection);

	if (id && phoneNumbers && phoneNumbers.length > 0) {
		return {
			id,
			name: null,
			firstName: contactName ? contactName.firstName : null,
			lastName: contactName ? contactName.lastName : null,
			email,
			company,
			contactUrl,
			avatarUrl,
			phoneNumbers
		};
	}
	return null;
}

export async function deleteGoogleContact(client: OAuth2Client, id: string): Promise<void> {
	const params: people_v1.Params$Resource$People$Deletecontact = {
		auth: client,
		resourceName: `people/${id}`
	};

	await people.deleteContact(params);
}

export async function createGoogleContact(
	client: OAuth2Client,
	contact: ContactTemplate
): Promise<Contact> {
	const person: people_v1.Schema$Person = {};

	const name: people_v1.Schema$Name = {};
	if (contact.firstName) {
		name.givenName = contact.firstName;
	}
	if (contact.lastName) {
		name.familyName = contact.lastName;
	}
	person.names = [name];

	if (contact.email) {
		person.emailAddresses = [{ value: contact.email }];
	}

	person.phoneNumbers = contact.phoneNumbers.map(
		(entry): people_v1.Schema$PhoneNumber => {
			const phoneNumber: people_v1.Schema$PhoneNumber = {
				value: entry.phoneNumber
			};
			if (entry.label) {
				phoneNumber.type = entry.label;
			}
			return phoneNumber;
		}
	);

	const params: people_v1.Params$Resource$People$Createcontact = {
		auth: client,
		requestBody: person
	};

	const response = await people.createContact(params);

	const parsedContact = convertGoogleContact(response.data);
	if (!parsedContact) {
		throw new Error("Could not parse contact.");
	}
	return parsedContact;
}

export async function getGoogleContacts(
	client: OAuth2Client,
	retrievedItems: number = 0,
	token?: string,
	previousContacts?: Contact[]
): Promise<Contact[]> {
	const params: people_v1.Params$Resource$People$Connections$List = {
		auth: client,
		pageToken: token,
		personFields: PERSON_FIELDS,
		resourceName: RESOURCE_NAME,
		pageSize: PAGE_SIZE
	};

	const response = await people.connections.list(params);

	const { connections, nextPageToken, totalItems } = response.data;

	if (!Array.isArray(connections)) {
		return [];
	}

	retrievedItems = retrievedItems + connections.length;

	const contacts: Contact[] = previousContacts || [];

	for (const connection of connections) {
		const contact = convertGoogleContact(connection);

		if (contact) {
			contacts.push(contact);
		}
	}

	if (nextPageToken && totalItems && retrievedItems < totalItems) {
		return getGoogleContacts(client, retrievedItems, nextPageToken, contacts);
	}

	return contacts;
}

export function getGoogleContactId(connection: people_v1.Schema$Person): string | null {
	const { resourceName } = connection;
	if (!resourceName) {
		return null;
	}
	const parts = resourceName.split("/");
	const id = parts[1];
	if (!id) {
		return null;
	}

	return id;
}

export function getGoogleContactName(connection: people_v1.Schema$Person): ContactName | null {
	if (!connection.names) {
		return null;
	}
	const [name] = connection.names;
	if (!name) {
		return null;
	}
	return {
		firstName: name.givenName || null,
		lastName: name.familyName || null
	};
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
	const phoneNumbers: PhoneNumber[] = [];
	for (const phoneNumber of connection.phoneNumbers) {
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

export function getGoogleContactPrimaryEmailAddress(
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

export function getGoogleContactPhoto(connection: people_v1.Schema$Person): string | null {
	const { photos } = connection;
	if (!photos) {
		return null;
	}

	const photo = photos.find(entry => Boolean(entry.metadata && entry.metadata.primary));
	if (!photo) {
		return null;
	}

	return photo.url || null;
}
