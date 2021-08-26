import {
  CalendarEvent,
  CalendarEventTemplate,
} from "@clinq/bridge/dist/models";
import { calendar_v3 as Calendar } from "googleapis";

export function convertGoogleCalendarEvent(
  event: Calendar.Schema$Event
): CalendarEvent {
  return {
    id: event.id || "",
    title: event.summary || null,
    description: event.description || null,
    eventUrl: event.htmlLink || null,
    start:
      event.start && event.start.dateTime
        ? new Date(event.start.dateTime).getTime()
        : null,
    end:
      event.end && event.end.dateTime
        ? new Date(event.end.dateTime).getTime()
        : null,
  };
}

export function convertCalendarEvent(
  calendarEvent: CalendarEventTemplate
): Calendar.Schema$Event {
  return {
    summary: calendarEvent.title || undefined,
    description: calendarEvent.description || undefined,
    start: {
      dateTime: new Date(calendarEvent.start || Date.now()).toISOString(),
    },
    end: {
      dateTime: new Date(calendarEvent.end || Date.now()).toISOString(),
    },
  };
}
