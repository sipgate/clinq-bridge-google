import { Contact, ContactTemplate, ContactUpdate, PhoneNumber, ServerError } from "@clinq/bridge";
import { OAuth2Client } from "google-auth-library";
import { google, people_v1 as People } from "googleapis";
import { convertContactToGooglePerson, convertGooglePersonToContact } from "./contact";
import parseEnvironment from "./parse-environment";

const { people: PeopleAPI } = google.people("v1");

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

export async function deleteGoogleContact(client: OAuth2Client, id: string): Promise<void> {
	const params: People.Params$Resource$People$Deletecontact = {
		auth: client,
		resourceName: `people/${id}`
	};

	await PeopleAPI.deleteContact(params);
}

export async function updateGoogleContact(
	client: OAuth2Client,
	id: string,
	contact: ContactUpdate
): Promise<Contact> {
	const params = {
		auth: client,
		resourceName: `people/${id}`
	};

	const person = convertContactToGooglePerson(contact);

	const personResource = await PeopleAPI.get({ ...params, personFields: PERSON_FIELDS });

	if (!personResource) {
		throw new ServerError(404, "Contact not found");
	}

	const response = await PeopleAPI.updateContact({
		...params,
		requestBody: { ...person, etag: personResource.data.etag },
		updatePersonFields: PERSON_FIELDS
	});

	const parsedContact = convertGooglePersonToContact(response.data);
	if (!parsedContact) {
		throw new Error("Could not parse contact.");
	}
	return parsedContact;
}

export async function createGoogleContact(
	client: OAuth2Client,
	contact: ContactTemplate
): Promise<Contact> {
	const person = convertContactToGooglePerson(contact);

	const params: People.Params$Resource$People$Createcontact = {
		auth: client,
		requestBody: person
	};

	const response = await PeopleAPI.createContact(params);

	const parsedContact = convertGooglePersonToContact(response.data);
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
	const params: People.Params$Resource$People$Connections$List = {
		auth: client,
		pageToken: token,
		personFields: PERSON_FIELDS,
		resourceName: RESOURCE_NAME,
		pageSize: PAGE_SIZE
	};

	const response = await PeopleAPI.connections.list(params);

	const { connections, nextPageToken, totalItems } = response.data;

	if (!Array.isArray(connections)) {
		return [];
	}

	retrievedItems = retrievedItems + connections.length;

	const contacts: Contact[] = previousContacts || [];

	for (const person of connections) {
		const contact = convertGooglePersonToContact(person);

		if (contact) {
			contacts.push(contact);
		}
	}

	if (nextPageToken && totalItems && retrievedItems < totalItems) {
		return getGoogleContacts(client, retrievedItems, nextPageToken, contacts);
	}

	return contacts;
}
