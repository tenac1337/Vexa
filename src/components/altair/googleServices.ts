import { GOOGLE_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_DISCOVERY_DOCS, GOOGLE_SCOPES } from './constants';
import { CalendarEventResponse } from './types';

export function initializeGoogleAPIs(
  setGapiReady: (ready: boolean) => void,
  setGisReady: (ready: boolean) => void,
  tokenClientRef: React.MutableRefObject<any>,
  setIsGoogleServicesAuthorized: (authorized: boolean) => void,
  setGoogleServicesAuthMessage: (message: string) => void
) {
  // Initialize GAPI
  if (window.gapi && typeof window.gapi.load === 'function') {
    window.gapi.load('client', () => {
      window.gapi.client.init({
        apiKey: GOOGLE_API_KEY,
        discoveryDocs: GOOGLE_DISCOVERY_DOCS,
      }).then(() => {
        console.log("GAPI client initialized");
        setGapiReady(true);
      }).catch((error: any) => {
        console.error("Error initializing GAPI client:", error);
      });
    });
  }

  // Initialize GIS
  if (window.google && window.google.accounts && window.google.accounts.oauth2) {
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          console.error("Auth error:", tokenResponse.error);
          setIsGoogleServicesAuthorized(false);
          setGoogleServicesAuthMessage("Authorization failed. Please try again.");
          return;
        }
        if (window.gapi && window.gapi.client) {
          window.gapi.client.setToken(tokenResponse);
          setIsGoogleServicesAuthorized(true);
          setGoogleServicesAuthMessage("Google Services Authorized! Ready to go!");
          console.log("Google Services authorized successfully");
        }
      },
    });
    setGisReady(true);
  }
}

export function handleGoogleServicesAuth(
  gapiReady: boolean,
  gisReady: boolean,
  tokenClientRef: React.MutableRefObject<any>,
  setGoogleServicesAuthMessage: (message: string) => void
) {
  console.log("🔄 Starting Google Services authentication...");
  console.log("API Status:", { gapiReady, gisReady });

  if (!gapiReady || !gisReady) {
    console.warn("❌ APIs not ready:", { gapiReady, gisReady });
    setGoogleServicesAuthMessage("Google APIs not quite ready yet. Please wait a moment and try again...");
    return;
  }

  if (!tokenClientRef.current) {
    console.error("❌ Token client not initialized");
    setGoogleServicesAuthMessage("Authorization client not ready. Please refresh the page and try again.");
    return;
  }

  console.log("🔧 Checking existing token...");
  const existingToken = window.gapi?.client?.getToken && window.gapi.client.getToken();
  console.log("Existing token:", existingToken ? "Found" : "None");

  console.log("🚀 Requesting access token...");
  setGoogleServicesAuthMessage("Opening authorization popup... Please check for a popup window.");
  
  try {
    if (!existingToken || existingToken === null) {
      console.log("🔓 Requesting new consent...");
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    } else {
      console.log("🔄 Requesting token refresh...");
      tokenClientRef.current.requestAccessToken({ prompt: '' });
    }
  } catch (error) {
    console.error("❌ Error requesting access token:", error);
    setGoogleServicesAuthMessage("Failed to open authorization popup. Please check if popups are blocked.");
  }
}

export function handleGoogleServicesSignout(
  gapiReady: boolean,
  gisReady: boolean,
  tokenClientRef: React.MutableRefObject<any>,
  setIsGoogleServicesAuthorized: (authorized: boolean) => void,
  setGoogleServicesAuthMessage: (message: string) => void
) {
  const token = window.gapi?.client?.getToken && window.gapi.client.getToken();
  if (token && tokenClientRef.current && gapiReady && gisReady) {
    window.google.accounts.oauth2.revoke(token.access_token, () => {
      window.gapi.client.setToken('');
      setIsGoogleServicesAuthorized(false);
      setGoogleServicesAuthMessage("Google Services signed out. Ready to re-authorize when you are!");
      console.log("Google Services Signed Out.");
    });
  } else {
    setGoogleServicesAuthMessage("Nothing to sign out from, or APIs not ready.");
  }
}

export async function addCalendarEvent(
  summary: string,
  startDatetime: string,
  endDatetime: string,
  description?: string,
  location?: string,
  timeZone?: string,
  attendees?: string[]
): Promise<CalendarEventResponse> {
  if (!(window as any).gapi.client.calendar) {
    return { 
      success: false, 
      error: "Internal error: Calendar API module not available." 
    };
  }

  const hasTimeZoneOffset = (dt?: string): boolean => dt ? /Z|[+-]\d{2}:?\d{2}$/.test(dt) : false;
  if (!hasTimeZoneOffset(startDatetime) && !timeZone) {
    return { 
      success: false, 
      error: "MISSING_TIMEZONE_INFO_START", 
      message: "Start time needs timezone." 
    };
  }
  if (!hasTimeZoneOffset(endDatetime) && !timeZone) {
    return { 
      success: false, 
      error: "MISSING_TIMEZONE_INFO_END", 
      message: "End time needs timezone." 
    };
  }

  const event = {
    summary,
    location,
    description,
    start: { 
      dateTime: startDatetime, 
      timeZone 
    },
    end: { 
      dateTime: endDatetime, 
      timeZone 
    },
    attendees: attendees ? attendees.map(email => ({ email })) : []
  };

  try {
    const request = (window as any).gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: event
    });
    const response = await request;
    return { 
      success: true, 
      message: `Event created: ${response.result.summary}. Link: ${response.result.htmlLink}`, 
      eventId: response.result.id 
    };
  } catch (err: any) {
    const errMsg = err.result?.error?.message || err.message || "Unknown error.";
    return { 
      success: false, 
      error: `Failed to create event: ${errMsg}` 
    };
  }
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees?: Array<{
    email: string;
    responseStatus?: string;
  }>;
  htmlLink: string;
}

export interface GetCalendarEventsResponse {
  success: boolean;
  events?: CalendarEvent[];
  error?: string;
  message?: string;
}

export async function getCalendarEvents(
  timeMin?: string,
  timeMax?: string,
  maxResults: number = 10,
  singleEvents: boolean = true,
  orderBy: 'startTime' | 'updated' = 'startTime'
): Promise<GetCalendarEventsResponse> {
  if (!(window as any).gapi.client.calendar) {
    return { 
      success: false, 
      error: "Internal error: Calendar API module not available." 
    };
  }

  try {
    // If no time range is provided, default to current day
    if (!timeMin) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      timeMin = now.toISOString();
    }
    if (!timeMax) {
      const endOfDay = new Date(timeMin);
      endOfDay.setHours(23, 59, 59, 999);
      timeMax = endOfDay.toISOString();
    }

    const request = (window as any).gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin,
      timeMax: timeMax,
      maxResults: maxResults,
      singleEvents: singleEvents,
      orderBy: orderBy
    });

    const response = await request;
    const events = response.result.items || [];

    return {
      success: true,
      events: events.map((event: any) => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        htmlLink: event.htmlLink
      })),
      message: `Found ${events.length} event(s) in the specified time range.`
    };
  } catch (err: any) {
    const errMsg = err.result?.error?.message || err.message || "Unknown error.";
    if (err.status === 401) {
      return { 
        success: false, 
        error: "NEEDS_AUTHORIZATION", 
        message: `Calendar auth error (${errMsg}). Please re-authorize.` 
      };
    }
    return { 
      success: false, 
      error: `Failed to fetch calendar events: ${errMsg}` 
    };
  }
} 