import { FunctionDeclaration, Type,  } from "@google/genai";

export const getWeatherDeclaration: FunctionDeclaration = {
  name: "get_current_weather",
  description: "Gets current weather using Weatherstack.",
  parameters: { 
    type: Type.OBJECT, 
    properties: { 
      city: { 
        type: Type.STRING, 
        description: "City name, ZIP, or lat,lon." 
      }, 
      units: { 
        type: Type.STRING, 
        description: "Units: 'm' (Metric), 's' (Scientific), 'f' (Fahrenheit). Default 'm'.", 
        enum: ["m", "s", "f"]
      }
    }, 
    required: ["city"]
  },
};

export const addCalendarEventDeclaration: FunctionDeclaration = {
  name: "add_google_calendar_event",
  description: "Adds an event to the user's Google Calendar. Requires prior user authorization via a button click.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.STRING,
        description: "The title or summary of the event (e.g., 'Team Meeting').",
      },
      start_datetime: {
        type: Type.STRING,
        description: "The start date and time of the event in ISO 8601 format (e.g., '2024-07-20T10:00:00-07:00').",
      },
      end_datetime: {
        type: Type.STRING,
        description: "The end date and time of the event in ISO 8601 format (e.g., '2024-07-20T11:00:00-07:00').",
      },
      description: {
        type: Type.STRING,
        description: "An optional longer description for the event.",
      },
      location: {
        type: Type.STRING,
        description: "An optional location for the event (e.g., 'Conference Room A' or an address).",
      },
      timeZone: {
        type: Type.STRING,
        description: "Optional. The IANA Time Zone Database name (e.g., 'America/Los_Angeles', 'Europe/Berlin'). Important if start/end datetimes don't have an offset."
      },
      attendees: {
        type: Type.ARRAY,
        description: "Optional. A list of email addresses of attendees to invite.",
        items: {
          type: Type.STRING,
          description: "Email address of an attendee."
        }
      }
    },
    required: ["summary", "start_datetime", "end_datetime"],
  },
};

export const createNotionPageDeclaration: FunctionDeclaration = {
  name: "create_notion_page",
  description: "Creates a new page in Notion with auto-generated content using Gemini. Just provide the title/topic and content type, and comprehensive content will be automatically generated about that topic using AI.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "The title or topic for the new Notion page. Content will be automatically generated based on this title using Gemini 1.5 Pro.",
      },
      content_type: {
        type: Type.STRING,
        description: "The type of content to generate: 'notes' (for lecture notes), 'essay' (for essay writing), 'research' (for research content).",
        enum: ["notes", "essay", "research"]
      },
      parent_page_id: {
        type: Type.STRING,
        description: `Optional. The ID of the parent Notion page. If not provided, a default parent page will be used. The ID is a 32-character string (e.g., 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx').`,
      },
    },
    required: ["title", "content_type"],
  },
};

export const getNotionPageContentDeclaration: FunctionDeclaration = {
  name: "get_notion_page_content",
  description: "Retrieves the content (as text) from a specified Notion page.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      page_id: {
        type: Type.STRING,
        description: "The ID of the Notion page to retrieve content from. This is a 32-character string.",
      },
    },
    required: ["page_id"],
  },
};

export const readLatestEmailsDeclaration: FunctionDeclaration = {
  name: "read_latest_emails",
  description: "Reads a summary (subject, sender, date) of the latest few unread emails from Gmail. Requires prior user authorization.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      count: {
        type: Type.NUMBER,
        description: "Optional. Number of recent unread emails to fetch (e.g., 3 or 5). Defaults to 3 if not specified. Max 10.",
      },
    },
  },
};

export const getCalendarEventsDeclaration: FunctionDeclaration = {
  name: "get_calendar_events",
  description: "Retrieves events from Google Calendar for a specific day or week. Requires prior user authorization.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      timeMin: {
        type: Type.STRING,
        description: "The start time in ISO 8601 format (e.g., '2024-03-20T00:00:00Z'). If not provided, defaults to start of current day.",
      },
      timeMax: {
        type: Type.STRING,
        description: "The end time in ISO 8601 format (e.g., '2024-03-20T23:59:59Z'). If not provided, defaults to end of current day.",
      },
      maxResults: {
        type: Type.NUMBER,
        description: "Optional. Maximum number of events to return. Defaults to 10.",
      },
      singleEvents: {
        type: Type.BOOLEAN,
        description: "Optional. Whether to expand recurring events into individual instances. Defaults to true.",
      },
      orderBy: {
        type: Type.STRING,
        description: "Optional. The order of the events returned. Can be 'startTime' or 'updated'. Defaults to 'startTime'.",
        enum: ["startTime", "updated"]
      }
    },
    required: []
  },
};

// Tasks API functions
export const getTaskListsFunction: FunctionDeclaration = {
  name: "getTaskLists",
  description: "Get all task lists from Google Tasks",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: []
  }
};

export const getTasksFunction: FunctionDeclaration = {
  name: "getTasks",
  description: "Get all tasks from a specific task list",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskListId: {
        type: Type.STRING,
        description: "The ID of the task list to get tasks from"
      }
    },
    required: ["taskListId"]
  }
};

export const createTaskFunction: FunctionDeclaration = {
  name: "createTask",
  description: "Create a new task in a specific task list",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskListId: {
        type: Type.STRING,
        description: "The ID of the task list to create the task in"
      },
      title: {
        type: Type.STRING,
        description: "The title of the task"
      },
      notes: {
        type: Type.STRING,
        description: "Optional notes for the task"
      },
      due: {
        type: Type.STRING,
        description: "Optional due date for the task in RFC3339 format"
      },
      parent: {
        type: Type.STRING,
        description: "Optional ID of the parent task"
      },
      previous: {
        type: Type.STRING,
        description: "Optional ID of the task that should come before this task"
      }
    },
    required: ["taskListId", "title"]
  }
};

export const updateTaskFunction: FunctionDeclaration = {
  name: "updateTask",
  description: "Update an existing task",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskListId: {
        type: Type.STRING,
        description: "The ID of the task list containing the task"
      },
      taskId: {
        type: Type.STRING,
        description: "The ID of the task to update"
      },
      title: {
        type: Type.STRING,
        description: "New title for the task"
      },
      notes: {
        type: Type.STRING,
        description: "New notes for the task"
      },
      status: {
        type: Type.STRING,
        description: "New status for the task (needsAction or completed)"
      },
      due: {
        type: Type.STRING,
        description: "New due date for the task in RFC3339 format"
      },
      completed: {
        type: Type.STRING,
        description: "New completion date for the task in RFC3339 format"
      }
    },
    required: ["taskListId", "taskId"]
  }
};

export const deleteTaskFunction: FunctionDeclaration = {
  name: "deleteTask",
  description: "Delete a task",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskListId: {
        type: Type.STRING,
        description: "The ID of the task list containing the task"
      },
      taskId: {
        type: Type.STRING,
        description: "The ID of the task to delete"
      }
    },
    required: ["taskListId", "taskId"]
  }
};

export const deepResearchDeclaration: FunctionDeclaration = {
  name: "deep_research",
  description: "Conduct comprehensive deep research using Stanford STORM methodology (multi-perspective research with citations and sources). This provides thorough analysis with academic rigor and multiple source verification. Use when user specifically asks for 'deep research', 'comprehensive research', or 'research with sources'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { 
        type: Type.STRING, 
        description: "The research topic or question to explore in depth with comprehensive analysis and citations." 
      },
      notionParentId: {
        type: Type.STRING,
        description: "Optional. The Notion page ID where the research results should be added. If not provided, a default parent page will be used."
      }
    },
    required: ["query"]
  }
};

export const getAllContactsDeclaration: FunctionDeclaration = {
  name: "get_all_contacts",
  description: "Fetches all available contacts, including their names and email addresses. Use this to find a person's email before sending an email or calendar invite.",
};

export const getRagContentDeclaration: FunctionDeclaration = {
  name: "get_rag_content",
  description: "Retrieves context from internal memory or knowledge base. Use this to recall past conversations, user preferences, or project details you've previously discussed.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The specific topic or question to search for in the knowledge base."
      }
    },
    required: ["query"]
  }
};

export const getStoredContextDeclaration: FunctionDeclaration = {
    name: "get_stored_context",
    description: "Retrieves the most recently stored piece of information that the user dragged and dropped onto you. Use this for quick analysis or to answer immediate questions about that context.",
};

export const createDetailedReportDeclaration: FunctionDeclaration = {
    name: "create_detailed_report",
    description: "Creates a comprehensive detailed report using all stored context and generates a structured Notion page with multiple sections, analysis, and insights.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: {
                type: Type.STRING,
                description: "The title for the detailed report",
            },
        },
        required: ["title"],
    },
};

export const sendEnhancedEmailDeclaration: FunctionDeclaration = {
  name: "send_enhanced_email",
  description: "Sends an enhanced email using Gemini 1.5 Pro to generate comprehensive, well-structured content. Just provide the recipient and context, and AI will generate a professional email.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      to: { 
        type: Type.STRING, 
        description: "The recipient's email address." 
      },
      subject: { 
        type: Type.STRING, 
        description: "Optional subject line. If not provided, AI will generate an appropriate subject." 
      },
      purpose: { 
        type: Type.STRING, 
        description: "The purpose or goal of the email (e.g., 'follow up on meeting', 'introduce new product', 'request information')." 
      },
      tone: { 
        type: Type.STRING, 
        description: "The tone for the email: 'professional', 'friendly', 'formal', or 'casual'. Defaults to 'professional'.",
        enum: ["professional", "friendly", "formal", "casual"]
      },
      content: { 
        type: Type.STRING, 
        description: "Key points or content to include in the email. AI will expand this into a full email." 
      },
      additionalContext: { 
        type: Type.STRING, 
        description: "Any additional context or background information to help generate the email." 
      }
    },
    required: ["to", "purpose"]
  }
};

// Enhanced AI-powered update declarations
export const updateNotionPageWithAIDeclaration: FunctionDeclaration = {
  name: "update_notion_page_with_ai",
  description: "Updates an existing Notion page with AI-generated content using Gemini 1.5 Pro. Can either append new content or replace existing content entirely.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      page_id: {
        type: Type.STRING,
        description: "The ID of the Notion page to update.",
      },
      query: {
        type: Type.STRING,
        description: "What content to generate and add to the page. Describe what you want the AI to write about.",
      },
      content_type: {
        type: Type.STRING,
        enum: ["research", "notes", "essay", "summary", "analysis"],
        description: "Type of content to generate: research (comprehensive research), notes (lecture notes), essay (essay writing), summary (summarize content), analysis (detailed analysis).",
      },
      update_mode: {
        type: Type.STRING,
        enum: ["append", "replace"],
        description: "Whether to append new content to existing content or replace all existing content entirely.",
      },
    },
    required: ["page_id", "query"],
  },
};

export const appendNotionPageWithAIDeclaration: FunctionDeclaration = {
  name: "append_notion_page_with_ai",
  description: "Appends AI-generated content to an existing Notion page using Gemini 1.5 Pro. Perfect for adding new sections, expanding on existing content, or adding related information.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      page_id: {
        type: Type.STRING,
        description: "The ID of the Notion page to append content to.",
      },
      query: {
        type: Type.STRING,
        description: "What content to generate and append to the page. Describe what you want the AI to write about.",
      },
      content_type: {
        type: Type.STRING,
        enum: ["research", "notes", "essay", "summary", "analysis"],
        description: "Type of content to generate: research (comprehensive research), notes (lecture notes), essay (essay writing), summary (summarize content), analysis (detailed analysis).",
      },
    },
    required: ["page_id", "query"],
  },
};

export const replaceNotionPageWithAIDeclaration: FunctionDeclaration = {
  name: "replace_notion_page_with_ai",
  description: "Completely replaces all content in an existing Notion page with new AI-generated content using Gemini 1.5 Pro. Use when you want to rewrite the entire page with new content.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      page_id: {
        type: Type.STRING,
        description: "The ID of the Notion page to replace content in.",
      },
      query: {
        type: Type.STRING,
        description: "What content to generate for the entire page. Describe what you want the AI to write about.",
      },
      content_type: {
        type: Type.STRING,
        enum: ["research", "notes", "essay", "summary", "analysis"],
        description: "Type of content to generate: research (comprehensive research), notes (lecture notes), essay (essay writing), summary (summarize content), analysis (detailed analysis).",
      },
    },
    required: ["page_id", "query"],
  },
};

// NEW: System-wide typing tool
export const systemWideTypingDeclaration: FunctionDeclaration = {
  name: "system_wide_typing",
  description: "Types text directly at the current cursor position anywhere on the system. Automatically captures screen context (including OCR text extraction) and uses conversation history to generate contextually appropriate content. Perfect for writing emails, tweets, documents, or any text based on our conversation and what's currently visible on screen.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content_type: {
        type: Type.STRING,
        description: "Type of content to generate: 'tweet', 'email', 'formal_document', 'casual_message', 'code_comment', 'presentation_notes', 'creative_writing', 'technical_explanation', 'response', 'summary'",
        enum: ["tweet", "email", "formal_document", "casual_message", "code_comment", "presentation_notes", "creative_writing", "technical_explanation", "response", "summary"]
      },
      context_hint: {
        type: Type.STRING,
        description: "Additional context about what should be written (e.g., 'about Steve Jobs', 'responding to client email', 'summarizing our discussion')"
      },
      tone: {
        type: Type.STRING,
        description: "Tone for the content: 'professional', 'casual', 'friendly', 'formal', 'humorous', 'enthusiastic', 'empathetic'",
        enum: ["professional", "casual", "friendly", "formal", "humorous", "enthusiastic", "empathetic"]
      },
      length: {
        type: Type.STRING,
        description: "Desired length: 'short' (1-2 sentences), 'medium' (1-2 paragraphs), 'long' (multiple paragraphs)",
        enum: ["short", "medium", "long"]
      }
    },
    required: ["content_type"]
  }
};

// NEW: Store conversation turn for context
export const storeConversationTurnDeclaration: FunctionDeclaration = {
  name: "store_conversation_turn",
  description: "Automatically stores conversation turns for building session context. This is called internally to maintain conversation history.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      speaker: {
        type: Type.STRING,
        description: "Who spoke: 'user' or 'assistant'",
        enum: ["user", "assistant"]
      },
      content: {
        type: Type.STRING,
        description: "The content of what was said"
      },
      timestamp: {
        type: Type.STRING,
        description: "When this was said (ISO timestamp)"
      }
    },
    required: ["speaker", "content"]
  }
};

export const openToolDeclaration: FunctionDeclaration = {
  name: "open_tool",
  description: "Opens a specified tool (Gmail, Calendar, Notion) in a browser window for a specified duration.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      tool: {
        type: Type.STRING,
        description: "The tool to open.",
        enum: ["gmail", "calendar", "notion", "tasks"]
      },
      duration: {
        type: Type.NUMBER,
        description: "The duration in seconds to keep the tool open. Defaults to 60 seconds.",
      },
    },
    required: ["tool"],
  },
};

export const perplexitySearchDeclaration: FunctionDeclaration = {
  name: "perplexity_search",
  description: "Performs a web search using Perplexity for quick, summarized information.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The search query."
      }
    },
    required: ["query"]
  }
}; 