import { FunctionDeclaration, LiveServerToolCall, Modality, Type, FunctionResponse } from "@google/genai";

export interface WeatherData {
  success: boolean;
  location?: string;
  temperature?: string;
  weather_descriptions?: string[];
  wind_speed?: string;
  wind_dir?: string;
  pressure?: number;
  precip?: number;
  humidity?: string;
  cloudcover?: string;
  feelslike?: string;
  visibility?: number;
  uv_index?: number;
  api_response_current?: any;
  summary?: string;
  error?: string;
  details?: string;
  code?: string;
  type?: string;
}

export interface NotionPageResponse {
  success: boolean;
  message?: string;
  page_id?: string;
  url?: string;
  error?: string;
  content?: string;
  metadata?: {
    updateMode?: string;
    blocksAdded?: number;
    contentType?: string;
    wordCount?: number;
    model?: string;
  };
}

export interface EmailResponse {
  success: boolean;
  message?: string;
  messageId?: string;
  error?: string;
  emails?: EmailDetail[];
}

export interface EmailDetail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export interface CalendarEventResponse {
  success: boolean;
  message?: string;
  eventId?: string;
  error?: string;
}

export interface ToolCallResponse {
  response: {
    output: any;
  };
  id: string;
  name: string;
}

export interface TaskList {
  id: string;
  title: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status?: string;
  due?: string;
  completed?: string;
  position?: string;
  parent?: string;
}

export interface Contact {
  name: string;
  email: string;
  relationship: string;
}

// Re-export types from @google/genai
export type { FunctionDeclaration, LiveServerToolCall, Modality, Type, FunctionResponse }; 