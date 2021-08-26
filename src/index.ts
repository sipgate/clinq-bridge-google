import {
  Adapter,
  Config,
  Contact,
  ContactTemplate,
  ContactUpdate,
  ServerError,
  start,
} from "@clinq/bridge";
import dotenv from "dotenv";
import { Request } from "express";
import {
  createGoogleContact,
  deleteGoogleContact,
  getAuthorizedOAuth2Client,
  getGoogleContacts,
  getOAuth2Client,
  getOAuth2RedirectUrl,
  updateGoogleContact,
} from "./util";
import { anonymizeKey } from "./util/anonymize-key";

dotenv.config();

class GoogleAdapter implements Adapter {
  public async getContacts({ apiKey }: Config): Promise<Contact[]> {
    try {
      const client = await getAuthorizedOAuth2Client(apiKey);
      return await getGoogleContacts(client);
    } catch (error) {
      console.error(
        `Could not get contacts for key "${anonymizeKey(apiKey)}"`,
        error.message
      );
      throw new ServerError(401, "Unauthorized");
    }
  }

  public async createContact(
    { apiKey }: Config,
    contact: ContactTemplate
  ): Promise<Contact> {
    const anonymizedKey = anonymizeKey(apiKey);
    try {
      console.log(`Authorizing client for key ${anonymizedKey}`);
      const client = await getAuthorizedOAuth2Client(apiKey);
      console.log(`Creating contact for key ${anonymizedKey}`);

      return await createGoogleContact(client, contact);
    } catch (error) {
      if (error.code && error.errors && error.errors.length > 0) {
        console.error(
          `Could not delete contact for key "${anonymizeKey(
            apiKey
          )}: ${JSON.stringify(error.errors)}"`
        );
        throw new ServerError(error.code, JSON.stringify(error.errors[0]));
      }
      console.error(
        `Could not create contact for key "${anonymizedKey}: ${error.message}"`
      );
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
          `Could not delete contact for key "${anonymizeKey(
            apiKey
          )}: ${JSON.stringify(error.errors)}"`
        );
        throw new ServerError(error.code, JSON.stringify(error.errors[0]));
      }
      console.error(
        `Could not update contact for key "${anonymizeKey(apiKey)}: ${
          error.message
        }"`
      );
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
          `Could not delete contact for key "${anonymizeKey(
            apiKey
          )}: ${JSON.stringify(error.errors)}"`
        );
        throw new ServerError(error.code, JSON.stringify(error.errors[0]));
      }
      console.error(
        `Could not delete contact for key "${anonymizeKey(apiKey)}: ${
          error.message
        }"`
      );
      throw new ServerError(401, "Could not delete contact");
    }
  }

  // public async getCalendarEvents(
  // 	{ apiKey }: Config,
  // 	options: CalendarFilterOptions
  // ): Promise<CalendarEvent[]> {
  // 	try {
  // 		const client = await getAuthorizedOAuth2Client(apiKey);
  // 		return getGoogleCalendarEvents(client, options);
  // 	} catch (error) {
  // 		console.error(
  // 			`Could not get calendar events for key "${anonymizeKey(apiKey)}"`,
  // 			error.message
  // 		);
  // 		throw new ServerError(401, "Unauthorized");
  // 	}
  // }

  // public async createCalendarEvent(
  // 	{ apiKey }: Config,
  // 	calendarEvent: CalendarEventTemplate
  // ): Promise<CalendarEvent> {
  // 	try {
  // 		const client = await getAuthorizedOAuth2Client(apiKey);
  // 		return createGoogleCalendarEvent(client, calendarEvent);
  // 	} catch (error) {
  // 		console.error(
  // 			`Could not create calendar event for key "${anonymizeKey(apiKey)}"`,
  // 			error.message
  // 		);
  // 		throw new ServerError(401, "Unauthorized");
  // 	}
  // }

  // public async updateCalendarEvent(
  // 	{ apiKey }: Config,
  // 	id: string,
  // 	calendarEvent: CalendarEventTemplate
  // ): Promise<CalendarEvent> {
  // 	try {
  // 		const client = await getAuthorizedOAuth2Client(apiKey);
  // 		return updateGoogleCalendarEvent(client, id, calendarEvent);
  // 	} catch (error) {
  // 		console.error(
  // 			`Could not update calendar event for key "${anonymizeKey(apiKey)}"`,
  // 			error.message
  // 		);
  // 		throw new ServerError(401, "Unauthorized");
  // 	}
  // }

  // public async deleteCalendarEvent({ apiKey }: Config, id: string): Promise<void> {
  // 	try {
  // 		const client = await getAuthorizedOAuth2Client(apiKey);
  // 		await deleteGoogleCalendarEvent(client, id);
  // 	} catch (error) {
  // 		console.error(
  // 			`Could not delete calendar event for key "${anonymizeKey(apiKey)}"`,
  // 			error.message
  // 		);
  // 		throw new ServerError(401, "Unauthorized");
  // 	}
  // }

  public async getOAuth2RedirectUrl(): Promise<string> {
    return getOAuth2RedirectUrl();
  }

  public async handleOAuth2Callback(
    req: Request
  ): Promise<{ apiKey: string; apiUrl: string }> {
    const { code } = req.query;
    const client = getOAuth2Client();
    const {
      tokens: { access_token, refresh_token },
    } = await client.getToken(code);

    return {
      apiKey: `${access_token}:${refresh_token}`,
      apiUrl: "",
    };
  }
}

start(new GoogleAdapter());
