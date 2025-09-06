// Google API Constants
export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'your_google_client_id_here';
export const GOOGLE_API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || 'your_google_api_key_here';

// Scopes: Calendar, Gmail Send, Gmail Readonly, Tasks
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/tasks'
].join(' ');

// Discovery Docs: Calendar, Gmail, and Tasks
export const GOOGLE_DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
  'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest',
  'https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest'
];

// Weatherstack API Constants
export const WEATHERSTACK_ACCESS_KEY = process.env.REACT_APP_WEATHERSTACK_ACCESS_KEY || "your_weatherstack_key_here";
export const WEATHERSTACK_API_BASE_URL = "http://api.weatherstack.com";

// Notion API Constants
export const NOTION_API_KEY = process.env.REACT_APP_NOTION_API_KEY || "your_notion_api_key_here";
export const NOTION_API_VERSION = "2022-06-28";
export const DEFAULT_NOTION_PARENT_PAGE_ID = process.env.REACT_APP_DEFAULT_NOTION_PARENT_PAGE_ID || "your_notion_page_id_here"; 