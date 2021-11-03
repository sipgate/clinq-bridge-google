import {
  CalendarEvent,
  CalendarEventTemplate,
  CalendarFilterOptions,
  ClinqBetaEnvironment,
  Contact,
  ContactTemplate,
  ContactUpdate,
  OAuthURLConfig,
  ServerError,
} from "@clinq/bridge";
import { OAuth2Client } from "google-auth-library";
import { google, people_v1 as People } from "googleapis";
import { convertCalendarEvent, convertGoogleCalendarEvent } from "./calendar";
import {
  convertContactToGooglePerson,
  convertGooglePersonToContact,
} from "./contact";
import parseEnvironment from "./parse-environment";
import { GenerateAuthUrlOpts } from "google-auth-library/build/src/auth/oauth2client";

const { people: PeopleAPI } = google.people("v1");
const { events } = google.calendar("v3");

const GOOGLE_CONTACTS_SCOPES = [
  "https://www.googleapis.com/auth/contacts",
  // Needs to be verified, before it can be added:
  // "https://www.googleapis.com/auth/calendar"
];

const RESOURCE_NAME = "people/me";
const PERSON_FIELDS_GET =
  "metadata,names,emailAddresses,organizations,phoneNumbers,photos";
const PERSON_FIELDS_UPDATE = "names,emailAddresses,organizations,phoneNumbers";
const PAGE_SIZE = 100;

export function getOAuth2Client(
  clinqEnvironment?: ClinqBetaEnvironment
): OAuth2Client {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL } =
    parseEnvironment();
  let redirectUrl = GOOGLE_REDIRECT_URL;

  if (clinqEnvironment) {
    redirectUrl += `/clinq-environment/${clinqEnvironment}`;
  }

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirectUrl
  );
}

export async function getAuthorizedOAuth2Client(
  apiKey: string
): Promise<OAuth2Client> {
  if (typeof apiKey !== "string") {
    throw new Error("Invalid API key.");
  }
  const [access_token, refresh_token] = apiKey.split(":");
  const client = getOAuth2Client();
  client.setCredentials({
    access_token,
    refresh_token,
  });
  const response = await client.getAccessToken();
  if (!response.token) {
    throw new Error("Unauthorized");
  }
  return client;
}

export function getOAuth2RedirectUrl(
  urlConfig?: OAuthURLConfig | undefined
): string {
  const clinqEnvironment = urlConfig && urlConfig.clinqEnvironment;

  const client = getOAuth2Client(clinqEnvironment);
  const { GOOGLE_REDIRECT_URL } = process.env;
  const opts: GenerateAuthUrlOpts = {
    access_type: "offline",
    scope: GOOGLE_CONTACTS_SCOPES,
    prompt: "consent",
  };
  if (clinqEnvironment) {
    opts.redirect_uri = `${GOOGLE_REDIRECT_URL}/clinq-environment/${clinqEnvironment}`;
  }
  return client.generateAuthUrl(opts);
}

export async function deleteGoogleContact(
  client: OAuth2Client,
  id: string
): Promise<void> {
  const params: People.Params$Resource$People$Deletecontact = {
    auth: client,
    resourceName: `people/${id}`,
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
    resourceName: `people/${id}`,
  };

  const person = convertContactToGooglePerson(contact);

  const personResource = await PeopleAPI.get({
    ...params,
    personFields: PERSON_FIELDS_UPDATE,
  });

  if (!personResource) {
    throw new ServerError(404, "Contact not found");
  }

  let response = null;
  try {
    response = await PeopleAPI.updateContact({
      ...params,
      requestBody: { ...person, etag: personResource.data.etag },
      updatePersonFields: PERSON_FIELDS_UPDATE,
    });
  } catch (error) {
    console.log(
      `Update failed. Retrying to update contact ${id}: ${error.message}`
    );
    response = await PeopleAPI.updateContact({
      ...params,
      requestBody: { ...person, etag: personResource.data.etag },
      updatePersonFields: PERSON_FIELDS_UPDATE,
    });
  }

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
    requestBody: person,
  };

  let response = null;
  try {
    response = await PeopleAPI.createContact(params);
  } catch (error) {
    console.log(`Creating contact failed: ${error.message}`);
    response = await PeopleAPI.createContact(params);
  }

  const parsedContact = convertGooglePersonToContact(response.data);
  if (!parsedContact) {
    throw new Error("Could not parse contact.");
  }
  return parsedContact;
}

export async function getGoogleContacts(
  client: OAuth2Client,
  retrievedItems = 0,
  token?: string,
  previousContacts?: Contact[]
): Promise<Contact[]> {
  const params: People.Params$Resource$People$Connections$List = {
    auth: client,
    pageToken: token,
    personFields: PERSON_FIELDS_GET,
    resourceName: RESOURCE_NAME,
    pageSize: PAGE_SIZE,
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

export async function getGoogleCalendarEvents(
  auth: OAuth2Client,
  { start, end }: CalendarFilterOptions
): Promise<CalendarEvent[]> {
  const {
    data: { items },
  } = await events.list({
    auth,
    calendarId: "primary",
    timeMin: start ? new Date(start).toISOString() : undefined,
    timeMax: end ? new Date(end).toISOString() : undefined,
    singleEvents: true,
    orderBy: "startTime",
  });

  if (!items) {
    return [];
  }

  return items.map(convertGoogleCalendarEvent);
}

export async function createGoogleCalendarEvent(
  auth: OAuth2Client,
  calendarEvent: CalendarEventTemplate
): Promise<CalendarEvent> {
  const { data } = await events.insert({
    auth,
    calendarId: "primary",
    requestBody: convertCalendarEvent(calendarEvent),
  });

  return convertGoogleCalendarEvent(data);
}

export async function updateGoogleCalendarEvent(
  auth: OAuth2Client,
  id: string,
  calendarEvent: CalendarEventTemplate
): Promise<CalendarEvent> {
  const { data } = await events.update({
    auth,
    eventId: id,
    calendarId: "primary",
    requestBody: convertCalendarEvent(calendarEvent),
  });

  return convertGoogleCalendarEvent(data);
}

export async function deleteGoogleCalendarEvent(
  auth: OAuth2Client,
  id: string
): Promise<void> {
  await events.delete({
    auth,
    calendarId: "primary",
    eventId: id,
  });
}
