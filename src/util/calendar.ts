import { CalendarEvent } from "@clinq/bridge/dist/models";
import { calendar_v3 as Calendar } from "googleapis";

export function convertGoogleCalendarEntry(event: Calendar.Schema$Event): CalendarEvent {
	return {
		id: event.id || "",
		title: event.summary || null,
		description: event.description || null,
		eventUrl: event.htmlLink || null,
		start: event.start && event.start.dateTime ? new Date(event.start.dateTime).getTime() : null,
		end: event.end && event.end.dateTime ? new Date(event.end.dateTime).getTime() : null
	};
}
