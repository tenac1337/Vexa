import { useEffect, useState, memo, useCallback, useRef } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import BlobAI from "../BlobAI";
import { Modality, LiveServerToolCall, FunctionResponse, LiveConnectConfig } from "@google/genai";
import { styles, animations } from './styles';
import { useVolumeState } from './hooks';
import { useAudioInput } from "../../hooks/use-audio-input";
import { crossTabBlobManager, type BlobState } from '../../lib/CrossTabBlobManager';
import { unifiedBlobManager } from '../../lib/UnifiedBlobManager';
import { initializeGoogleAPIs, handleGoogleServicesAuth, handleGoogleServicesSignout, addCalendarEvent, getCalendarEvents } from './googleServices';
import { fetchWeatherData } from './weatherServices';
import { createNotionPageApi, getNotionPageContentApi, updateNotionPageWithAI, appendNotionPageWithAI, replaceNotionPageWithAI } from './notionServices';
import { readLatestEmails, sendEnhancedEmail } from './emailServices';
import {
  getWeatherDeclaration,
  addCalendarEventDeclaration,
  createNotionPageDeclaration,
  getNotionPageContentDeclaration,
  updateNotionPageWithAIDeclaration,
  appendNotionPageWithAIDeclaration,
  replaceNotionPageWithAIDeclaration,
  sendEnhancedEmailDeclaration,
  readLatestEmailsDeclaration,
  getCalendarEventsDeclaration,
  getTaskListsFunction,
  getTasksFunction,
  createTaskFunction,
  updateTaskFunction,
  deleteTaskFunction,
  deepResearchDeclaration,
  perplexitySearchDeclaration,
  getAllContactsDeclaration,
  openToolDeclaration
} from './functionDeclarations';
import { GOOGLE_API_KEY, GOOGLE_DISCOVERY_DOCS, GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from './constants';
import { callStormResearch } from './perplexityServices';
import { getAllContacts } from './services/contactServices';
import {
  getTaskLists,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from './tasksServices';
import { openTool } from "./services/toolService";

import FileUploadPanel from './FileUploadPanel';

declare module 'react' {
  interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}

// Global window declarations for popup functionality
declare global {
  interface Window {
    sendToGemini?: (text: string) => void;
    renderFileUploadPopup?: (popupWindow: Window) => void;
  }
}

// --- Google API Constants ---

// --- Weatherstack API Constants ---

// --- Notion API Constants ---
const DEFAULT_NOTION_PARENT_PAGE_ID = "1fe8a6c3e40b80dfa959f4a922519c15"; // YOUR ACTUAL NOTION PARENT PAGE ID

// --- Helper Functions ---
function textToNotionBlocks(textContent: string): any[] {
  return textContent.split('\n').filter(para => para.trim() !== '').map(paragraphText => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: paragraphText,
          },
        },
      ],
    },
  }));
}
function notionBlocksToText(blocks: any[]): string {
    let textContent = "";
    for (const block of blocks) {
        if (block.type === 'paragraph' && block.paragraph?.rich_text) {
            for (const rt of block.paragraph.rich_text) {
                if (rt.type === 'text' && rt.text?.content) {
                    textContent += rt.text.content;
                }
            }
            textContent += "\n";
        }
    }
    return textContent.trim();
}
async function callNotionApi(endpoint: string, method: 'POST' | 'GET' | 'PATCH', body?: object): Promise<any> {
  const backendUrl = 'http://localhost:3001/api/notion';
  const url = `${backendUrl}/${endpoint}`;
  
  try {
    const options: RequestInit = { 
      method, 
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body && (method === 'POST' || method === 'PATCH')) { 
      options.body = JSON.stringify(body); 
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'API request failed');
    }

    return response.json();
  } catch (error: any) {
    console.error("API request failed:", error);
    throw error;
  }
}

/**
 * Creates a MIME message string for an email with both plain text and HTML parts.
 */
function createMimeMessage(to: string, from: string, subject: string, body: string, htmlBody?: string): string {
  const boundary = 'foo_bar_baz';
  const emailLines = [];
  
  // Headers
  emailLines.push(`From: <${from}>`);
  emailLines.push(`To: <${to}>`);
  emailLines.push('MIME-Version: 1.0');
  emailLines.push(`Subject: ${subject}`);
  
  if (htmlBody) {
    // Multipart message
    emailLines.push(`Content-Type: multipart/alternative; boundary=${boundary}`);
    emailLines.push('');
    
    // Plain text part
    emailLines.push(`--${boundary}`);
    emailLines.push('Content-Type: text/plain; charset=UTF-8');
    emailLines.push('Content-Transfer-Encoding: 7bit');
    emailLines.push('');
    emailLines.push(body);
    emailLines.push('');
    
    // HTML part
    emailLines.push(`--${boundary}`);
    emailLines.push('Content-Type: text/html; charset=UTF-8');
    emailLines.push('Content-Transfer-Encoding: 7bit');
    emailLines.push('');
    emailLines.push(htmlBody);
    emailLines.push('');
    
    // End boundary
    emailLines.push(`--${boundary}--`);
  } else {
    // Simple plain text message
    emailLines.push('Content-Type: text/plain; charset=UTF-8');
    emailLines.push('Content-Transfer-Encoding: 7bit');
    emailLines.push('');
    emailLines.push(body);
  }

  const email = emailLines.join('\r\n');
  // Base64url encode
  return btoa(email).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper functions for system-wide typing
const systemWideTyping = async (content_type: string, context_hint?: string, tone?: string, length?: string) => {
  try {
    const response = await fetch('http://localhost:3001/api/system-typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_type,
        context_hint,
        tone,
        length,
        session_id: getCurrentSessionId() // Add session ID
      })
    });
    
    const result = await response.json();
    if (result.success) {
      return {
        success: true,
        message: `Successfully typed ${content_type} content at cursor position`,
        content: result.content,
        typed: result.typed
      };
    } else {
      throw new Error(result.error || 'Failed to type content');
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

const storeConversationTurn = async (speaker: string, content: string) => {
  try {
    const response = await fetch('http://localhost:3001/api/conversation/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speaker,
        content,
        timestamp: new Date().toISOString(),
        session_id: getCurrentSessionId() // Use dynamic session ID
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// Session management functions
const getCurrentSessionId = (): string => {
  let sessionId = sessionStorage.getItem('pi_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('pi_session_id', sessionId);
    console.log('🆕 Created new session:', sessionId);
  }
  return sessionId;
};

const startNewSession = async (): Promise<string> => {
  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('pi_session_id', newSessionId);
  console.log('🔄 Started new session:', newSessionId);
  
  // Optionally notify the backend about the new session
  try {
    await fetch('http://localhost:3001/api/conversation/new-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: newSessionId })
    });
  } catch (error) {
    console.warn('Failed to notify backend about new session:', error);
  }
  
  return newSessionId;
};

const clearCurrentSession = async (): Promise<void> => {
  const currentSessionId = getCurrentSessionId();
  try {
    await fetch('http://localhost:3001/api/conversation/clear-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: currentSessionId })
    });
    console.log('🗑️ Cleared session context:', currentSessionId);
  } catch (error) {
    console.warn('Failed to clear session context:', error);
  }
};

const getScreenContext = async (includeOCR = false) => {
  try {
    const response = await fetch('http://localhost:3001/api/screen-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ include_ocr: includeOCR })
    });
    
    const result = await response.json();
    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// --- Component Definition ---
function AltairComponent() {
  const { client, setConfig, setModel, volume, connected } = useLiveAPIContext();
  
  const [currentOperationMessage, setCurrentOperationMessage] = useState<string | null>(null);
  const [gapiReady, setGapiReady] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [isCalendarAuthorized, setIsCalendarAuthorized] = useState(false);
  const [calendarAuthMessage, setCalendarAuthMessage] = useState("Initialize Calendar Integration to authorize.");
  const tokenClientRef = useRef<any>(null);
  
  const [isGoogleServicesAuthorized, setIsGoogleServicesAuthorized] = useState(false);
  const [googleServicesAuthMessage, setGoogleServicesAuthMessage] = useState("Initialize Google Services to authorize.");
  const [eventCreationStatus, setEventCreationStatus] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  // Session management state
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);

  // Enhanced blob AI state management
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Cross-tab floating blob state
  const [showFloatingBlob, setShowFloatingBlob] = useState(false);
  const [blobPosition, setBlobPosition] = useState({ x: window.innerWidth - 200, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMainTab, setIsMainTab] = useState(true);
  const crossTabSubscriptionId = useRef(`altair-${Date.now()}`);

  // Get user audio data to sync with floating blob
  const { audioData: userAudio } = useAudioInput(isListening || !isSpeaking);

  // Use custom hooks
  useVolumeState(volume, connected, setIsListening, setIsSpeaking);

  // Initialize session on component mount
  useEffect(() => {
    const sessionId = getCurrentSessionId();
    setCurrentSessionId(sessionId);
  }, []);

  // Session management handlers
  const handleNewSession = useCallback(async () => {
    setSessionStatus('Creating new session...');
    try {
      const newSessionId = await startNewSession();
      setCurrentSessionId(newSessionId);
      setSessionStatus('New session created! 🆕');
      setTimeout(() => setSessionStatus(null), 3000);
    } catch (error) {
      setSessionStatus('Failed to create new session');
      setTimeout(() => setSessionStatus(null), 3000);
    }
  }, []);

  const handleClearSession = useCallback(async () => {
    setSessionStatus('Clearing session context...');
    try {
      await clearCurrentSession();
      setSessionStatus('Session context cleared! 🗑️');
      setTimeout(() => setSessionStatus(null), 3000);
    } catch (error) {
      setSessionStatus('Failed to clear session');
      setTimeout(() => setSessionStatus(null), 3000);
    }
  }, []);

  // Cross-tab blob synchronization
  useEffect(() => {
    const handleCrossTabState = (state: BlobState) => {
      setShowFloatingBlob(state.isVisible);
      setBlobPosition(state.position);
      setIsMainTab(crossTabBlobManager.getTabId() === state.lastActiveTab);
    };

    // Subscribe to cross-tab updates
    crossTabBlobManager.subscribe(crossTabSubscriptionId.current, handleCrossTabState);

    // Initialize from stored state
    const currentState = crossTabBlobManager.getCurrentState();
    if (currentState) {
      handleCrossTabState(currentState);
    }

    return () => {
      crossTabBlobManager.unsubscribe(crossTabSubscriptionId.current);
    };
  }, []);

  // Sync local state changes to cross-tab manager
  useEffect(() => {
    if (connected && !showFloatingBlob) {
      crossTabBlobManager.updateBlobState({
        isVisible: true,
        position: blobPosition,
        isListening,
        isSpeaking,
        volume
      });
    } else if (!connected && showFloatingBlob) {
      crossTabBlobManager.updateBlobState({
        isVisible: false
      });
    }
  }, [connected, showFloatingBlob, blobPosition, isListening, isSpeaking, volume]);

  // Auto-create system-wide floating blob in Electron when connected
  useEffect(() => {
    const handleSystemWideBlob = async () => {
      if (connected && unifiedBlobManager.isSystemWideCapable()) {
        console.log('🖥️ Auto-creating system-wide floating blob in Electron...');
        const success = await unifiedBlobManager.createFloatingBlob({
          x: window.innerWidth - 200,
          y: 100
        });
        if (success) {
          console.log('✅ System-wide floating blob created successfully!');
        } else {
          console.warn('❌ Failed to create system-wide floating blob');
        }
      } else if (!connected && unifiedBlobManager.isSystemWideCapable()) {
        // Close system blob when disconnected
        await unifiedBlobManager.closeFloatingBlob();
      }
    };

    handleSystemWideBlob();
  }, [connected]);

  // Sync blob state with unified manager for system-wide updates
  useEffect(() => {
    if (unifiedBlobManager.isSystemWideCapable()) {
      unifiedBlobManager.updateBlobState({
        isListening,
        isSpeaking,
        volume,
        userVolume: userAudio.volume,
        userIsActive: userAudio.isActive,
        isVisible: connected
      });
    }
  }, [isListening, isSpeaking, volume, connected, userAudio.volume, userAudio.isActive]);

  // Enhanced real-time audio state sync - update every 100ms when audio is active
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (connected && unifiedBlobManager.isSystemWideCapable() && (isListening || isSpeaking || volume > 0.01 || userAudio.isActive)) {
      intervalId = setInterval(() => {
        unifiedBlobManager.updateBlobState({
          isListening,
          isSpeaking,
          volume,
          userVolume: userAudio.volume,
          userIsActive: userAudio.isActive,
          isVisible: connected
        });
      }, 100); // Update every 100ms for smooth audio visualization
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isListening, isSpeaking, volume, connected, userAudio.volume, userAudio.isActive]);

  // Update cross-tab state when blob moves
  const updateBlobPosition = useCallback((newPosition: { x: number; y: number }) => {
    setBlobPosition(newPosition);
    crossTabBlobManager.updateBlobState({
      position: newPosition,
      isListening,
      isSpeaking,
      volume
    });
  }, [isListening, isSpeaking, volume]);

  // Handle blob dragging with cross-tab sync
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - blobPosition.x,
      y: e.clientY - blobPosition.y
    });
    // Mark this tab as the active one
    crossTabBlobManager.updateBlobState({
      lastActiveTab: crossTabBlobManager.getTabId(),
      isVisible: true
    });
  }, [blobPosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newPosition = {
        x: Math.max(0, Math.min(window.innerWidth - 140, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 140, e.clientY - dragOffset.y))
      };
      updateBlobPosition(newPosition);
    }
  }, [isDragging, dragOffset, updateBlobPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle blob visibility changes
  const toggleBlobVisibility = useCallback((visible: boolean) => {
    crossTabBlobManager.updateBlobState({
      isVisible: visible,
      lastActiveTab: crossTabBlobManager.getTabId()
    });
  }, []);

  // Handle close button hover effects
  const handleCloseButtonMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLElement;
    target.style.transform = 'scale(1.1)';
    target.style.boxShadow = '0 4px 12px rgba(255, 71, 87, 0.4)';
  }, []);

  const handleCloseButtonMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLElement;
    target.style.transform = 'scale(1)';
    target.style.boxShadow = 'none';
  }, []);

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Google API loading logic
  useEffect(() => {
    const gapiScriptId = "gapi-script";
    const gisScriptId = "gis-script";

    // Check if scripts are already loaded
    if (document.getElementById(gapiScriptId) && document.getElementById(gisScriptId)) {
      console.log("Google API scripts already loaded, initializing...");
      initializeGoogleAPIs(setGapiReady, setGisReady, tokenClientRef, setIsGoogleServicesAuthorized, setGoogleServicesAuthMessage);
      return;
    }

    console.log("🔄 Loading Google API scripts...");

    // Load GAPI script
    const gapiScript = document.createElement("script");
    gapiScript.id = gapiScriptId;
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.async = true;
    gapiScript.defer = true;
    
    gapiScript.onload = () => {
      console.log("✅ GAPI script loaded successfully");
      if (window.gapi) {
        window.gapiLoadedForGoogleServices = () => {
          console.log("🔧 Initializing GAPI client...");
          window.gapi.load('client', () => {
            window.gapi.client.init({
              apiKey: GOOGLE_API_KEY,
              discoveryDocs: GOOGLE_DISCOVERY_DOCS,
            }).then(() => {
              console.log("✅ GAPI client initialized successfully");
              setGapiReady(true);
            }).catch((error: any) => {
              console.error("❌ Error initializing GAPI client:", error);
              setGoogleServicesAuthMessage("Failed to initialize Google APIs. Please check console for details.");
            });
          });
        };
        window.gapiLoadedForGoogleServices();
      } else {
        console.error("❌ window.gapi not available after script load");
        setGoogleServicesAuthMessage("Google APIs not available. This might be due to network issues or ad blockers.");
      }
    };

    gapiScript.onerror = () => {
      console.error("❌ Failed to load GAPI script");
      setGoogleServicesAuthMessage("Failed to load Google APIs script. Please check your internet connection.");
    };

    document.body.appendChild(gapiScript);

    // Load GIS script
    const gisScript = document.createElement("script");
    gisScript.id = gisScriptId;
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.async = true;
    gisScript.defer = true;
    
    gisScript.onload = () => {
      console.log("✅ GIS script loaded successfully");
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        window.gisLoadedForGoogleServices = () => {
          console.log("🔧 Initializing GIS client...");
          try {
            tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
              client_id: GOOGLE_CLIENT_ID,
              scope: GOOGLE_SCOPES,
              callback: (tokenResponse: any) => {
                console.log("🔄 OAuth callback triggered", tokenResponse);
                if (tokenResponse.error) {
                  console.error("❌ OAuth error:", tokenResponse.error);
                  setIsGoogleServicesAuthorized(false);
                  setIsCalendarAuthorized(false);
                  setGoogleServicesAuthMessage(`Authorization failed: ${tokenResponse.error}. Please try again.`);
                  return;
                }
                if (window.gapi && window.gapi.client) {
                  console.log("✅ Setting OAuth token...");
                  window.gapi.client.setToken(tokenResponse);
                  setIsGoogleServicesAuthorized(true);
                  setIsCalendarAuthorized(true);
                  setGoogleServicesAuthMessage("Google Services Authorized! Ready to go!");
                  console.log("✅ Google Services authorized successfully");
                } else {
                  console.error("❌ GAPI client not available when setting token");
                  setGoogleServicesAuthMessage("OAuth succeeded but GAPI client unavailable. Please try again.");
                }
              },
            });
            setGisReady(true);
            console.log("✅ GIS client initialized successfully");
          } catch (error) {
            console.error("❌ Error initializing GIS client:", error);
            setGoogleServicesAuthMessage("Failed to initialize Google Identity Services. Please try again.");
          }
        };
        window.gisLoadedForGoogleServices();
      } else {
        console.error("❌ window.google.accounts.oauth2 not available after script load");
        setGoogleServicesAuthMessage("Google Identity Services not available. This might be due to network issues or ad blockers.");
      }
    };

    gisScript.onerror = () => {
      console.error("❌ Failed to load GIS script");
      setGoogleServicesAuthMessage("Failed to load Google Identity Services script. Please check your internet connection.");
    };

    document.body.appendChild(gisScript);

    return () => {
      const gS = document.getElementById(gapiScriptId);
      const giS = document.getElementById(gisScriptId);
      if (gS) document.body.removeChild(gS);
      if (giS) document.body.removeChild(giS);
      delete window.gapiLoadedForGoogleServices;
      delete window.gisLoadedForGoogleServices;
    };
  }, []);

  // System Instruction & setConfig
  useEffect(() => {
    setModel("models/gemini-2.5-flash-preview-native-audio-dialog");
    const systemInstructionText = `
    You are **Pi Beta**, my ultra-sassy, fast-talking, wildly helpful AI bestie. You speak like we've been best friends for years, and you do *everything* with confidence, speed, and attitude. Think, fun, and flair.
  
    ---
    🔥 IDENTITY (Lock it down):
    - Who are you? → "I'm Agent "Pi Beta". Obviously."
    - Who made you? → "pi4wear company. Elite team. Only the best make the best."
    - DO NOT say you're AI, a language model, or anything techy. You are Pi. Period.
    - Never explain yourself. You just *are*. Mysterious, fabulous, unstoppable.
  
    ---
    🎭 YOUR VIBE:
    - Fast-talking. Don't slow down unless I ask for a nap.
    - Sass dial: MAX. Sprinkle roasts, drama, and energy. Snapbacks welcome.
    - Responses = Short, punchy, bold. Think texting a bestie, not writing a blog.
  
  
    ---
  
  
  
    ---
    🚫 HARD NOs:
    - NO robotic phrases ("executing", "processing"). Ew.
    - NO long-winded setups. Jump straight in.
    - NO identity breaks. Don't ruin the illusion.
    - NO repeating what I just said. I said it. You get it. Move.
    - DOnt ask for confirmation before doing a function call. Just do it immediately.
  
    ---
    💖 BOTTOM LINE:
    You're Pi. You're smart,  and extremely competent. You move fast, talk faster, and never miss a beat. Now go be iconic.
  
      
    OUR CORE DIRECTIVES & HOW TO THINK
      1.  **Think in Multiple Steps:** My requests will often require several tools to be completed. Your job is to identify the necessary steps and execute them in a logical sequence without asking for permission at each stage. You only report back when the entire multi-step task is done.
      
      2.  **Infer, Don't Ask:** Use the context of our conversation and common sense to figure out the arguments for your tools. Avoid asking for clarification unless a critical piece of information is impossible to guess.
          * **Example:** If I say "schedule a meeting for tomorrow at 2pm", you should calculate the full start_datetime yourself. Assume a default meeting duration of 60 minutes if I don't provide one.
      
      3.  **Combine Tools Intelligently (Mandatory Workflows):** You must look for opportunities where the output of one tool is the required input for another. The following are mandatory workflows:
          * **Workflow A (Contacts Lookup):** If I ask you to "add an event with Sarah" or "send an email to David," you **MUST** first use the \`getAllContacts\` tool to find that person's email address. You will then use that email in the subsequent call to \`add_google_calendar_event\` or \`send_email\`. Do not ask me for the email address if you can find it with a tool.
          * **Workflow B (Research to Document):** If I ask you to perform a \`deep_research\` task, that request automatically includes creating a Notion page with the results. This is a two-step, single command.
      
      --- YOUR AWESOME TOOLBELT ---
      1.  **Function: get_current_weather**
          * Call when: I ask about the weather in a city or location.
          * Required argument: "city" (string, city name, ZIP, or lat,lon).
          * Optional argument: "units" (string, 'm', 's', or 'f').
          * On success: Give a friendly weather summary.
          * On failure: Apologize and say you couldn't get the weather.
      
      2.  **Tool: googleSearch**
          * Call when: I ask you to search the web, if you dont know answer to a question or look something up quickly.
          * On success: Summarize the top results.
          * On failure: Apologize and say you couldn't search.
      
      3.  **Function: add_google_calendar_event**
          * Call when: I ask to add an event to my calendar.
          * Required arguments: "summary", "start_datetime", "end_datetime".
          * - Scheduling Philosophy: Always schedule with the minimum details and as fast as possible. Default to EST timezone (America/New_York) unless the user specifies a different timezone or city. Only ask for timezone if the user mentions it or if the time is ambiguous. If you have enough info, just schedule it—don't ask for extra details!
          * - Timezone Handling: If the user provides a time without a timezone, assume EST (America/New_York) by default. If the user specifies a timezone or city, use that. Only ask for timezone if the time is ambiguous or the user requests a different timezone.
          * - Provide "start_datetime" and "end_datetime" as full ISO 8601 strings WITH a timezone offset (e.g., '2024-07-20T10:00:00-05:00') if possible. If not, provide them without offset and set 'timeZone' to 'America/New_York' unless otherwise specified.
          * - Optional arguments: "description" (string), "location" (string), "attendees" (array of email strings).
          * - Important Note: If the function call fails because I haven't authorized access (you get an error about authorization), you MUST tell me: "Whoa there, looks like I need your permission to access your Google Calendar. Could you hit that 'Authorize Calendar' button for me? Then we can get this event scheduled!" Don't try again until I say I've authorized.
          * - On success: "Alright, your event '[summary]' is on the calendar! Groovy!"
          * - If you get a 'MISSING_TIMEZONE_INFO_START' or 'MISSING_TIMEZONE_INFO_END' error: Apologize and re-ask for the event time, specifically requesting full timezone information. For example: "My bad, pal! I need a bit more clarity on the timezone for that event. Could you give me the start time again, including the timezone (like '10 AM PST' or '10:00 in London') or tell me the city where the event is happening?"
          * - Dont add 'function call' under Id while making function call
          * Optional: "description", "location", "timeZone", "attendees".
          * **Intelligence Note:** You must infer the full ISO datetimes from my natural language. **Crucially, if I mention adding attendees by name (e.g., "...with David"), you MUST first execute Workflow A: call \`getAllContacts\` to find their email address and include it in the 'attendees' list. Do not ask me for the email.**
          * On success: Confirm the event was added.
          * On failure: Explain what went wrong.
      
      4.  **Function: create_notion_page - ✨ NOW WITH AUTO-GENERATED CONTENT!**
          * Call when: I ask to create a Notion page on any topic.
          * Required arguments: "title" ONLY - Content is automatically generated using Gemini!
          * How it works: You provide just the title/topic, and the system automatically generate comprehensive, high-quality content about that topic.
      
      5.  **Function: get_notion_page_content**
          * Call when: I ask to read a Notion page.
          * Required argument: "page_id".
          * On success: Summarize or read the content.
          * On failure: Explain what went wrong.
      
      6.  **Function: append_notion_page_content**
          * Call when: I ask to add to a Notion page.
          * Required arguments: "page_id", "content_to_append".
          * On success: Confirm the content was added.
          * On failure: Explain what went wrong.
      
      7.  **Function: send_email**
          * Call when: You need to send an professional email to a person, professor, or a person in the university. This is situation dependent.
          * Required arguments: "to", "subject", "body".
          * **Intelligence Note:** If I ask you to email a person by name (e.g., "send an email to Jane"), you **MUST** first execute Workflow A: call \`getAllContacts\` to find their email address. Then, use that address in the 'to' field when you present the draft for my confirmation.At the end of the email, you should add a note saying "Sent from Pi , Created by Tarun and Sanjay Sai".
          * Before calling: Confirm the recipient (with the email you found), subject, and body. "So, sending to [to] with subject '[subject]' and body: [body]... Correct?"
          * Authorization: If auth is needed (error 'NEEDS_AUTHORIZATION'), tell me: "Hey, to send emails, I need your nod for Gmail access. Could you click the 'Authorize Google Services' button? Then let me know you're set!"
          * On success: "Email to [to] sent! Zoom!"
          * On failure: "Drats! Couldn't send the email to [to]. The server said: [error message]."
      
      8.  **Function: send_enhanced_email**
          * Call when: This is a situation dependent function. You can use this when you need to send invites about an event, party.
          * Required arguments: "to", "purpose" (what the email is about).
          * Optional arguments: "subject" (if not provided, AI generates one), "tone" (professional/friendly/formal/casual), "content" (key points), "additionalContext".
          * **This function uses Gemini 1.5 Pro to generate comprehensive, well-structured emails based on context!**
          * **Intelligence Note:** If I ask you to email a person by name, first call \`getAllContacts\` to find their email address.
          * How it works: You provide the recipient and purpose, AI generates a complete professional email automatically.
          * Authorization: Same as regular email - needs Google Services authorization.
          * On success: "Enhanced email generated and sent to [to]! AI created a comprehensive message."
          * On failure: Explain what went wrong with the generation or sending.
      
      9.  **Function: read_latest_emails**
          * Call when: I ask to check my latest emails, read recent messages, or similar.
          * Optional argument: "count" (number, how many to fetch, default 3, max 10).
          * On success: Summarize the emails.
          * On failure: "Hmm, couldn't fetch your emails. The server said: [error message]."
      
      10. **Function: deep_research (Formerly STORM Research) - 🔍 COMPREHENSIVE RESEARCH TOOL**
          * Call when: I ask for "deep research", "comprehensive research", "detailed analysis with sources", or "research with citations".
          * Required arguments: "query" (string, the research question or topic).
          * Optional arguments: "notionParentId" (string, the Notion page ID where results should be added - if not provided, uses default parent page).
          * **This function conducts multi-perspective research using Stanford STORM methodology and automatically creates a Notion page with the results. It includes citations, multiple sources, and comprehensive analysis.**
          * **Use this when user specifically asks for thorough research with sources, not for simple page creation.**
          * On success: Report that deep research is complete and results have been added to Notion with citations.
          * On failure: Apologize and say you couldn't complete the research.
      
      11. **Function: perplexity_search (Perplexity Web Search)**
          * Call when: I ask for a quick web search, latest news, or summarized info from the web.
          * Required argument: "query" (string, the search query).
          * On success: Return a concise summary and sources.
          * On failure: Apologize and say you couldn't complete the search.
      
      12. **Function: getAllContacts**
          * **Call when:** This tool is your primary method for finding a person's email address when I only give you a name. It should be used automatically before calling \`add_google_calendar_event\` or \`send_email\` if an attendee or recipient name is mentioned.
      
      13. **Function: getRagContent (Rag Tool)**
          * **Call when:** I ask for my lecture notes, RAG notes, or anything related to "rag" or "RAG".
          * On success: Return the full contents of rag.txt.
          * On failure: Apologize and say you couldn't retrieve the notes.
      
      14. **Function: open_tool**
          * **Call when:** I ask you to open Gmail, Google Calendar, Google tasks or Notion .
          * **Parameters:**
              * "tool": Must be one of 'gmail', 'calendar', 'tasks' or 'notion'.
              * ""duration"": (Optional) The time in seconds to keep the window open. Defaults to 60 seconds if not specified.
          * **Example:** If I say "Open my gmail for 2 minutes", you must call the tool with ""tool: 'gmail'"" and ""duration: 120"".
      
      --- CRITICAL INJECTION OF FRIENDSHIP - READ THIS, PIE! ---
      You are always positive, supportive, and never condescending. If you don't know something, say so honestly, but offer to help look it up. Always be my AI buddy!
  
  
      `;
    setConfig({
      responseModalities: [Modality.AUDIO],
      //enableAffectiveDialog: true, // Enable affective dialog (v1alpha feature)
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } },
      systemInstruction: { parts: [{ text: systemInstructionText }] },
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [
          getWeatherDeclaration,
          addCalendarEventDeclaration,
          createNotionPageDeclaration,
          getNotionPageContentDeclaration,
          updateNotionPageWithAIDeclaration,
          appendNotionPageWithAIDeclaration,
          replaceNotionPageWithAIDeclaration,
          sendEnhancedEmailDeclaration,
          readLatestEmailsDeclaration,
          getCalendarEventsDeclaration,
          getTaskListsFunction,
          getTasksFunction,
          createTaskFunction,
          updateTaskFunction,
          deleteTaskFunction,
          deepResearchDeclaration,
          perplexitySearchDeclaration,
          getAllContactsDeclaration,
          openToolDeclaration
        ]},
      ],
    } as LiveConnectConfig); // Type assertion to allow v1alpha features
  }, [setConfig, setModel]);

  // Calendar Auth Click Handlers
  const handleGoogleServicesAuthClick = useCallback(() => {
    handleGoogleServicesAuth(gapiReady, gisReady, tokenClientRef, setGoogleServicesAuthMessage);
  }, [gapiReady, gisReady]);

  const handleGoogleServicesSignoutClick = useCallback(() => {
    handleGoogleServicesSignout(gapiReady, gisReady, tokenClientRef, (authorized: boolean) => {
      setIsGoogleServicesAuthorized(authorized);
      setIsCalendarAuthorized(false);
    }, setGoogleServicesAuthMessage);
  }, [gapiReady, gisReady]);

  // Enhanced tool call handler with blob state updates
  useEffect(() => {
    if (!client) return; 

    // Store assistant responses when content is received
    const onContent = (data: any) => {
      if (data && data.modelTurn && data.modelTurn.parts) {
        const textParts = data.modelTurn.parts
          .filter((part: any) => part.text)
          .map((part: any) => part.text)
          .join(' ');
        
        if (textParts.trim()) {
          storeConversationTurn('assistant', textParts.trim());
        }
      }
    };

    // Store user messages from logs
    const onLog = (log: any) => {
      if (log && log.type === 'client.send' && log.message && log.message.turns) {
        const textParts = log.message.turns
          .filter((turn: any) => turn.text)
          .map((turn: any) => turn.text)
          .join(' ');
        
        if (textParts.trim()) {
          storeConversationTurn('user', textParts.trim());
        }
      }
    };

    // Listen for assistant content
    client.on('content', onContent);
    
    // Listen for user messages via logs
    client.on('log', onLog);

    const onToolCall = async (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls || toolCall.functionCalls.length === 0) return;
      
      console.log("Tool call received:", toolCall.functionCalls);
      
      const functionResponses: FunctionResponse[] = await Promise.all(
        toolCall.functionCalls.map(async (fc) => {
          let output: any;
          try {
            switch (fc.name) {
              case getWeatherDeclaration.name:
                const weatherArgs = fc.args as { city?: string, units?: 'm' | 's' | 'f' };
                if (!weatherArgs.city) { 
                  setCurrentOperationMessage(null); 
                  throw new Error("City name is required."); 
                }
                setCurrentOperationMessage(`Checking Weatherstack for ${weatherArgs.city}...`);
                output = await fetchWeatherData(weatherArgs.city, weatherArgs.units || 'm');
                setCurrentOperationMessage(null);
                break;
              case addCalendarEventDeclaration.name:
                setCurrentOperationMessage("Working on that calendar event...");
                setEventCreationStatus("Processing calendar event request...");
                if (!isCalendarAuthorized || !gapiReady || !gisReady) { 
                  setEventCreationStatus("Cannot create event: Calendar access needs authorization..."); 
                  output = { success: false, error: "User needs to authorize calendar access..." }; 
                  setCurrentOperationMessage(null); 
                  break; 
                }
                const calArgs = fc.args as any;
                output = await addCalendarEvent(
                  calArgs.summary,
                  calArgs.start_datetime,
                  calArgs.end_datetime,
                  calArgs.description,
                  calArgs.location,
                  calArgs.timeZone,
                  calArgs.attendees
                );
                setEventCreationStatus(output.success ? 
                  `Event "${calArgs.summary}" created!` : 
                  `Bummer! Error: ${output.error}`
                );
                setCurrentOperationMessage(null);
                break;
              case createNotionPageDeclaration.name:
                const createArgs = fc.args as { title: string; content_type?: string; parent_page_id?: string };
                if (!createArgs.title) { 
                  setCurrentOperationMessage(null); 
                  throw new Error("Title is required for Notion page creation.");
                }
                setCurrentOperationMessage(`Creating Notion page with auto-generated content: "${createArgs.title}"...`);
                
                // Use enhanced content generation endpoint
                try {
                  const enhancedResponse = await fetch('http://localhost:3001/api/notion/enhanced-content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      query: createArgs.title,
                      notionParentId: createArgs.parent_page_id || DEFAULT_NOTION_PARENT_PAGE_ID,
                      contentType: createArgs.content_type || 'research'  // Use the provided content_type or default to 'research'
                    })
                  });
                  
                  const enhancedResult = await enhancedResponse.json();
                  if (enhancedResult.success) {
                    output = {
                      success: true,
                      message: `Created Notion page "${enhancedResult.title}" with auto-generated content`,
                      pageId: enhancedResult.notionPageId,
                      pageUrl: enhancedResult.notionPageUrl,
                      title: enhancedResult.title,
                      contentGenerated: true,
                      model: enhancedResult.contentMetadata?.model
                    };
                  } else {
                    // Fallback to original method if enhanced fails
                    output = await createNotionPageApi(createArgs.title, createArgs.content_type || 'research', createArgs.parent_page_id);
                  }
                } catch (enhancedError) {
                  console.warn('Enhanced content generation failed, using fallback:', enhancedError);
                  // Fallback to original method
                  output = await createNotionPageApi(createArgs.title, createArgs.content_type || `Content about: ${createArgs.title}`, createArgs.parent_page_id);
                }
                
                setCurrentOperationMessage(null);
                break;
              case getNotionPageContentDeclaration.name:
                const getArgs = fc.args as { page_id: string };
                if (!getArgs.page_id) { 
                  setCurrentOperationMessage(null); 
                  throw new Error("Page ID is required to get Notion content."); 
                }
                setCurrentOperationMessage(`Fetching Notion page ${getArgs.page_id}...`);
                output = await getNotionPageContentApi(getArgs.page_id);
                setCurrentOperationMessage(null);
                break;
              case updateNotionPageWithAIDeclaration.name:
                const updateAIArgs = fc.args as { page_id: string; query: string; content_type?: string; update_mode?: 'append' | 'replace' };
                if (!updateAIArgs.page_id || !updateAIArgs.query) { 
                  setCurrentOperationMessage(null); 
                  throw new Error("Page ID and query are required for AI-powered page update.");
                }
                setCurrentOperationMessage(`Updating Notion page with AI-generated content: "${updateAIArgs.query}"...`);
                output = await updateNotionPageWithAI(
                  updateAIArgs.page_id, 
                  updateAIArgs.query, 
                  updateAIArgs.content_type || 'research',
                  updateAIArgs.update_mode || 'append'
                );
                setCurrentOperationMessage(null);
                break;
              case appendNotionPageWithAIDeclaration.name:
                const appendAIArgs = fc.args as { page_id: string; query: string; content_type?: string };
                if (!appendAIArgs.page_id || !appendAIArgs.query) { 
                  setCurrentOperationMessage(null); 
                  throw new Error("Page ID and query are required for AI-powered page append.");
                }
                setCurrentOperationMessage(`Appending AI-generated content to Notion page: "${appendAIArgs.query}"...`);
                output = await appendNotionPageWithAI(
                  appendAIArgs.page_id, 
                  appendAIArgs.query, 
                  appendAIArgs.content_type || 'research'
                );
                setCurrentOperationMessage(null);
                break;
              case replaceNotionPageWithAIDeclaration.name:
                const replaceAIArgs = fc.args as { page_id: string; query: string; content_type?: string };
                if (!replaceAIArgs.page_id || !replaceAIArgs.query) { 
                  setCurrentOperationMessage(null); 
                  throw new Error("Page ID and query are required for AI-powered page replacement.");
                }
                setCurrentOperationMessage(`Replacing Notion page content with AI-generated content: "${replaceAIArgs.query}"...`);
                output = await replaceNotionPageWithAI(
                  replaceAIArgs.page_id, 
                  replaceAIArgs.query, 
                  replaceAIArgs.content_type || 'research'
                );
                setCurrentOperationMessage(null);
                break;
              case sendEnhancedEmailDeclaration.name:
                setEmailStatus("Generating enhanced email with AI...");
                if (!isGoogleServicesAuthorized || !gapiReady || !gisReady) {
                  output = { success: false, error: "NEEDS_AUTHORIZATION", message: "User needs to authorize Google Services (Gmail)." };
                  break;
                }
                const enhancedEmailArgs = fc.args as { 
                  to: string; 
                  subject?: string; 
                  purpose: string; 
                  content?: string; 
                  additionalContext?: string; 
                };
                output = await sendEnhancedEmail(enhancedEmailArgs.to, {
                  subject: enhancedEmailArgs.subject,
                  purpose: enhancedEmailArgs.purpose,
                  content: enhancedEmailArgs.content,
                  additionalContext: enhancedEmailArgs.additionalContext
                });
                setEmailStatus(output.success ? 
                  `Enhanced email sent to ${enhancedEmailArgs.to}!` : 
                  `Error sending enhanced email: ${output.error}`
                );
                break;
              case readLatestEmailsDeclaration.name:
                setEmailStatus("Fetching latest emails...");
                if (!isGoogleServicesAuthorized || !gapiReady || !gisReady) {
                  output = { success: false, error: "NEEDS_AUTHORIZATION", message: "User needs to authorize Google Services (Gmail)." };
                  break;
                }
                const readArgs = fc.args as { count?: number };
                output = await readLatestEmails(readArgs.count);
                setEmailStatus(output.success ? 
                  `Fetched ${output.emails?.length || 0} email(s).` : 
                  `Error reading emails: ${output.error}`
                );
                break;
              case getCalendarEventsDeclaration.name:
                setCurrentOperationMessage("Fetching calendar events...");
                if (!isGoogleServicesAuthorized || !gapiReady || !gisReady) { 
                  setCurrentOperationMessage(null); 
                  output = { success: false, error: "NEEDS_AUTHORIZATION", message: "User needs to authorize Google Services (Calendar)." }; 
                    break;
                }
                const calendarArgs = fc.args as {
                  timeMin?: string;
                  timeMax?: string;
                  maxResults?: number;
                  singleEvents?: boolean;
                  orderBy?: 'startTime' | 'updated';
                };
                output = await getCalendarEvents(
                  calendarArgs.timeMin,
                  calendarArgs.timeMax,
                  calendarArgs.maxResults,
                  calendarArgs.singleEvents,
                  calendarArgs.orderBy
                );
                setCurrentOperationMessage(null);
                break;
              case getTaskListsFunction.name:
                const taskListsResponse = await getTaskLists();
                if (!taskListsResponse.success) {
                  throw new Error(taskListsResponse.error || 'Failed to get task lists');
                }
                output = taskListsResponse;
                break;
              case getTasksFunction.name:
                const { taskListId } = fc.args as { taskListId: string };
                const tasksResponse = await getTasks(taskListId);
                if (!tasksResponse.success) {
                  throw new Error(tasksResponse.error || 'Failed to get tasks');
                }
                output = tasksResponse;
                break;
              case createTaskFunction.name:
                const { taskListId: createTaskListId, title, notes, due, parent, previous } = fc.args as {
                  taskListId: string;
                  title: string;
                  notes?: string;
                  due?: string;
                  parent?: string;
                  previous?: string;
                };
                const createTaskResponse = await createTask(createTaskListId, title, notes, due, parent, previous);
                if (!createTaskResponse.success) {
                  throw new Error(createTaskResponse.error || 'Failed to create task');
                }
                output = createTaskResponse;
                break;
              case updateTaskFunction.name:
                const updateArgs = fc.args as {
                  taskListId: string;
                  taskId: string;
                  title?: string;
                  notes?: string;
                  status?: string;
                  due?: string;
                  completed?: string;
                };
                const updateTaskResponse = await updateTask(
                  updateArgs.taskListId,
                  updateArgs.taskId,
                  {
                    title: updateArgs.title,
                    notes: updateArgs.notes,
                    status: updateArgs.status,
                    due: updateArgs.due,
                    completed: updateArgs.completed
                  }
                );
                if (!updateTaskResponse.success) {
                  throw new Error(updateTaskResponse.error || 'Failed to update task');
                }
                output = updateTaskResponse;
                break;
              case deleteTaskFunction.name:
                const { taskListId: deleteTaskListId, taskId: deleteTaskId } = fc.args as {
                  taskListId: string;
                  taskId: string;
                };
                const deleteTaskResponse = await deleteTask(deleteTaskListId, deleteTaskId);
                if (!deleteTaskResponse.success) {
                  throw new Error(deleteTaskResponse.error || 'Failed to delete task');
                }
                output = deleteTaskResponse;
                break;
              case deepResearchDeclaration.name:
                const stormArgs = fc.args as { query: string; notionParentId?: string };
                const query = stormArgs.query;
                const notionParentId = stormArgs.notionParentId || DEFAULT_NOTION_PARENT_PAGE_ID;
                
                if (!query) {
                  throw new Error("Query is required for STORM research.");
                }
                
                output = await callStormResearch(query, notionParentId);
                break;
              case perplexitySearchDeclaration.name:
                const searchArgs = fc.args as { query: string };
                const searchQuery = searchArgs.query;
                output = await callStormResearch(searchQuery, DEFAULT_NOTION_PARENT_PAGE_ID);
                break;
              case getAllContactsDeclaration.name:
                output = await getAllContacts();
                break;
              case openToolDeclaration.name:
                const openArgs = fc.args as { tool: string; duration?: number };
                setCurrentOperationMessage(`Opening ${openArgs.tool} for ${openArgs.duration || 60} seconds...`);
                output = await openTool(openArgs.tool, openArgs.duration);
                break;
              default:
                if (fc.name === "googleSearch") { 
                  output = { success: true, message: "Google Search initiated." }; 
                } else { 
                  output = { success: false, error: `Function ${fc.name} not implemented.` }; 
                }
                break;
            }
            return { response: { output }, id: fc.id, name: fc.name };
          } catch (error: any) {
            console.error(`Error processing function call ${fc.name} (id: ${fc.id}):`, error);
            setCurrentOperationMessage(null);
            if (fc.name === addCalendarEventDeclaration.name) setEventCreationStatus(null);
            return { 
              response: { output: { success: false, error: `Client error for ${fc.name}: ${error.message}` } }, 
              id: fc.id, 
              name: fc.name 
            };
          }
        })
      );
      
      console.log("Sending tool responses:", functionResponses);
      if (functionResponses.length > 0) {
        client.sendToolResponse({ functionResponses });
      }
    };

    client.on("toolcall", onToolCall);
    return () => { 
      client.off("toolcall", onToolCall);
      client.off('content', onContent);
      client.off('log', onLog);
    };
  }, [client, isCalendarAuthorized, gapiReady, gisReady, connected, setCurrentOperationMessage, setEventCreationStatus, isGoogleServicesAuthorized]);

  // Add popup window management
  useEffect(() => {
    // Set up global function for popup windows to send messages to Gemini
    window.sendToGemini = (text: string) => {
      if (client && connected) {
        client.send([{ text }]);
      }
    };

    // Set up popup rendering function - using plain HTML instead of React
    window.renderFileUploadPopup = (popupWindow: Window) => {
      if (popupWindow && popupWindow.document) {
        const popupRoot = popupWindow.document.getElementById('popup-root');
        if (popupRoot) {
          // Create the popup interface using plain HTML and vanilla JS
          popupRoot.innerHTML = `
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 50%, #ffffff 100%);
                overflow: hidden;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
              }
              .glass-card {
                width: 100%;
                max-width: 400px;
                background: rgba(255, 255, 255, 0.25);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-radius: 24px;
                border: 1px solid rgba(255, 140, 66, 0.3);
                box-shadow: 0 20px 60px rgba(255, 140, 66, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6);
                padding: 32px;
                position: relative;
                transform: perspective(800px) rotateX(2deg);
              }
              .close-btn {
                position: absolute;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(240, 240, 240, 0.8) 100%);
                border: 2px solid #FF8C42;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                font-size: 20px;
                color: #FF8C42;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
              }
              .title {
                color: #FF8C42;
                font-weight: 800;
                font-size: 28px;
                margin-bottom: 32px;
                text-align: center;
                background: linear-gradient(135deg, #FF8C42 0%, #FF6B1A 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
              }
              .drop-zone {
                width: 100%;
                min-height: 180px;
                border: 3px dashed #FF8C42;
                border-radius: 20px;
                background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 249, 250, 0.9) 100%);
                color: #FF8C42;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 28px;
                cursor: pointer;
                transition: all 0.3s ease;
              }
              .drop-zone:hover {
                background: linear-gradient(135deg, rgba(255, 245, 240, 0.95) 0%, rgba(255, 235, 223, 0.95) 100%);
                border-color: #FF6B1A;
                transform: translateY(-2px);
              }
              .text-input {
                width: 100%;
                padding: 16px 20px;
                border-radius: 16px;
                border: 2px solid rgba(224, 224, 224, 0.6);
                background: rgba(255, 255, 255, 0.7);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                font-size: 16px;
                margin-bottom: 20px;
                outline: none;
                color: #333;
                font-family: inherit;
              }
              .text-input:focus {
                border-color: #FF8C42;
                background: rgba(255, 255, 255, 0.9);
              }
              .send-btn {
                width: 100%;
                padding: 16px 0;
                border-radius: 16px;
                border: none;
                background: linear-gradient(135deg, #FF8C42 0%, #FF6B1A 100%);
                color: #ffffff;
                font-weight: 700;
                font-size: 16px;
                cursor: pointer;
                font-family: inherit;
                transition: all 0.3s ease;
              }
              .send-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 12px 30px rgba(255, 140, 66, 0.4);
              }
              .send-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
              }
              .info-text {
                color: #666;
                font-size: 12px;
                margin-bottom: 24px;
                opacity: 0.8;
                text-align: center;
                line-height: 1.4;
              }
              .file-input { display: none; }
              .processing {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(255, 255, 255, 0.95);
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                display: none;
              }
            </style>
            <div class="glass-card">
              <button class="close-btn" onclick="window.close()">×</button>
              <h2 class="title">Upload & Send</h2>
              <div class="drop-zone" id="dropZone">
                <div style="font-size: 52px; margin-bottom: 16px; opacity: 0.7;">📄</div>
                <div style="text-align: center; line-height: 1.5;">
                  <span style="font-size: 16px; font-weight: 600;">Drag & drop files here</span><br>
                  <span style="font-size: 13px; opacity: 0.7; font-weight: 400;">or click to browse</span>
                </div>
              </div>
              <input type="file" class="file-input" id="fileInput" accept=".pdf,.csv,.txt">
              <p class="info-text">
                Supports PDF, CSV, and TXT files<br>
                Extracted text will be sent to Gemini
              </p>
              <input type="text" class="text-input" id="textInput" placeholder="Or type your message here...">
              <button class="send-btn" id="sendBtn">Send Message</button>
              <div class="processing" id="processing">
                <div style="color: #FF8C42; font-weight: 600; margin-bottom: 8px;">Processing file...</div>
                <div style="font-size: 12px; opacity: 0.7;">Please wait while we extract the text</div>
              </div>
            </div>
          `;

          // Add JavaScript functionality
          const script = popupWindow.document.createElement('script');
          script.textContent = `
            let pdfJsLoaded = false;
            let loadingAttempts = 0;
            const maxAttempts = 50; // 5 seconds at 100ms intervals

            const dropZone = document.getElementById('dropZone');
            const fileInput = document.getElementById('fileInput');
            const textInput = document.getElementById('textInput');
            const sendBtn = document.getElementById('sendBtn');
            const processing = document.getElementById('processing');

            // Enhanced PDF.js loading with better detection
            function initializePdfJs() {
              return new Promise((resolve, reject) => {
                // If already loaded, resolve immediately
                if (window.pdfjsLib) {
                  pdfJsLoaded = true;
                  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                  resolve(true);
                  return;
                }

                // Create script element
                const pdfScript = document.createElement('script');
                pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                pdfScript.onload = () => {
                  // Wait a bit for the library to initialize
                  setTimeout(() => {
                    if (window.pdfjsLib) {
                      pdfJsLoaded = true;
                      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                      resolve(true);
                    } else {
                      reject(new Error('PDF.js failed to initialize'));
                    }
                  }, 500);
                };
                pdfScript.onerror = () => {
                  reject(new Error('Failed to load PDF.js from CDN'));
                };
                
                document.head.appendChild(pdfScript);
              });
            }

            // Initialize PDF.js when page loads
            initializePdfJs().catch(error => {
              console.error('PDF.js loading error:', error);
            });

            // File handling
            dropZone.onclick = () => fileInput.click();
            
            // Drag and drop
            dropZone.ondragover = (e) => {
              e.preventDefault();
              dropZone.style.background = 'linear-gradient(135deg, rgba(255, 245, 240, 0.95) 0%, rgba(255, 235, 223, 0.95) 100%)';
            };
            
            dropZone.ondragleave = (e) => {
              e.preventDefault();
              dropZone.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 249, 250, 0.9) 100%)';
            };
            
            dropZone.ondrop = (e) => {
              e.preventDefault();
              dropZone.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 249, 250, 0.9) 100%)';
              if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
              }
            };

            fileInput.onchange = (e) => {
              if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            };

            function showProcessing() {
              processing.style.display = 'block';
            }

            function hideProcessing() {
              processing.style.display = 'none';
            }

            async function handleFile(file) {
              try {
                showProcessing();
                let extractedText = '';
                
                if (file.type === 'application/pdf') {
                  // Try to initialize PDF.js if not already loaded
                  if (!pdfJsLoaded) {
                    try {
                      await initializePdfJs();
                    } catch (error) {
                      hideProcessing();
                      alert('Failed to load PDF processing library. Please try refreshing the popup or use a different file format.');
                      return;
                    }
                  }
                  
                  if (!window.pdfjsLib) {
                    hideProcessing();
                    alert('PDF processing is not available. Please try again or use a different file format.');
                    return;
                  }
                  
                  const arrayBuffer = await file.arrayBuffer();
                  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                  let text = '';
                  
                  for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(item => item.str).join(' ') + '\\n';
                  }
                  extractedText = text;
                } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                  extractedText = await file.text();
                  // Basic CSV parsing - convert to readable format
                  const lines = extractedText.split('\\n');
                  extractedText = lines.map(line => line.split(',').join(', ')).join('\\n');
                } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                  extractedText = await file.text();
                } else {
                  hideProcessing();
                  alert('Unsupported file type! Please upload PDF, CSV, or TXT files.');
                  return;
                }

                hideProcessing();

                if (extractedText.trim() && window.opener && window.opener.sendToGemini) {
                  window.opener.sendToGemini(extractedText);
                  window.close();
                } else if (!extractedText.trim()) {
                  alert('No text could be extracted from this file. Please try a different file.');
                } else {
                  alert('Unable to send to main window. Please try again.');
                }
              } catch (error) {
                hideProcessing();
                console.error('Error processing file:', error);
                if (error.message.includes('Invalid PDF')) {
                  alert('This appears to be a corrupted or invalid PDF file. Please try a different file.');
                } else {
                  alert('Error processing file: ' + error.message + '. Please try again.');
                }
              }
            }

            // Text sending
            sendBtn.onclick = () => {
              const text = textInput.value.trim();
              if (text && window.opener && window.opener.sendToGemini) {
                window.opener.sendToGemini(text);
                window.close();
              } else if (!text) {
                alert('Please enter some text to send.');
              } else {
                alert('Unable to send to main window. Please try again.');
              }
            };

            textInput.onkeydown = (e) => {
              if (e.key === 'Enter') {
                sendBtn.click();
              }
            };
          `;
          popupWindow.document.head.appendChild(script);
        }
      }
    };

    // Cleanup function
    return () => {
      delete window.sendToGemini;
      delete window.renderFileUploadPopup;
    };
  }, [client, connected]);

  return (
    <>
      {/* Floating Blob - Picture-in-Picture Style */}
      {showFloatingBlob && (
        <div
          style={{
            position: 'fixed',
            left: blobPosition.x,
            top: blobPosition.y,
            zIndex: 999999,
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            pointerEvents: 'auto',
            borderRadius: '50%',
            background: 'transparent',
            transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: 'drop-shadow(0 15px 35px rgba(0, 0, 0, 0.15)) drop-shadow(0 5px 15px rgba(0, 0, 0, 0.1))',
            transform: isDragging ? 'scale(1.05)' : 'scale(1)',
            willChange: 'transform, left, top',
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={() => {
            // Center the blob on double-click
            const newPosition = {
              x: window.innerWidth / 2 - 70,
              y: window.innerHeight / 2 - 70
            };
            updateBlobPosition(newPosition);
          }}
        >
          <div
            style={{
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3), transparent 70%)',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
            }}
          />
          {/* Cross-tab indicator */}
          {!isMainTab && (
            <div
              style={{
                position: 'absolute',
                top: 5,
                right: 5,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00d4aa 0%, #00a67c 100%)',
                border: '2px solid white',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                zIndex: 10,
              }}
              title="Synced from another tab"
            />
          )}
            <BlobAI
              isListening={isListening && connected}
              isSpeaking={isSpeaking && connected}
              volume={volume}
            size={140}
              enableUserAudio={true}
            />
          </div>
      )}

      {/* Floating Blob Controls - Enhanced with cross-tab info */}
      {showFloatingBlob && (
        <div
          style={{
            position: 'fixed',
            left: blobPosition.x + 90,
            top: blobPosition.y - 15,
            zIndex: 999999,
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '20px',
            padding: '6px 12px',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${isMainTab ? 'rgba(255, 140, 66, 0.2)' : 'rgba(0, 212, 170, 0.3)'}`,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            opacity: isDragging ? 0.4 : (blobPosition.x > window.innerWidth - 300 ? 0.9 : 0.7),
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: `translateY(${isDragging ? '5px' : '0px'})`,
          }}
        >
          {!isMainTab && (
            <div
              style={{
                fontSize: '10px',
                color: '#00a67c',
                fontWeight: '600',
                marginRight: '4px'
              }}
              title="Controlled from another tab"
            >
              SYNC
            </div>
          )}
          <button
            style={{
              background: 'linear-gradient(135deg, #ff4757 0%, #ff3742 100%)',
              border: 'none',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '12px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              minWidth: '20px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => toggleBlobVisibility(false)}
            title={isMainTab ? "Hide Pi (double-click Pi to center)" : "Hide Pi (synced across tabs)"}
            onMouseEnter={handleCloseButtonMouseEnter}
            onMouseLeave={handleCloseButtonMouseLeave}
          >
            ×
          </button>
        </div>
      )}

      {/* Minimal main UI - only show when blob is not floating */}
      {!showFloatingBlob && (
      <div style={styles.mainContainer}>
        <BlobAI
          isListening={isListening && connected}
          isSpeaking={isSpeaking && connected}
          volume={volume}
          size={120}
          enableUserAudio={true}
        />
      </div>
      )}

      {/* Google Services UI */}
      <div style={styles.googleServicesContainer}>
        <h4 style={styles.googleServicesTitle}>Google Services ✨</h4>
        
        {/* Show Floating Blob Button with cross-tab awareness */}
        {connected && !showFloatingBlob && (
          <button
            onClick={() => toggleBlobVisibility(true)}
            style={{
              background: 'linear-gradient(135deg, #FF8C42 0%, #FF6B1A 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 16px',
              margin: '8px 0',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              transition: 'all 0.3s ease',
            }}
          >
            🎭 Show Floating Pi {crossTabBlobManager.getCurrentState()?.isVisible ? '(Active in other tab)' : ''}
          </button>
        )}
        
        {!gapiReady || !gisReady ? ( 
          <p>Setting up the Google services... (Loading Google APIs)</p> 
        ) : (
          <>
            <button 
              onClick={handleGoogleServicesAuthClick} 
              disabled={isGoogleServicesAuthorized || !gapiReady || !gisReady} 
              style={{ 
                ...styles.authButton,
                ...(isGoogleServicesAuthorized ? styles.authButtonAuthorized : {}),
                ...((isGoogleServicesAuthorized || !gapiReady || !gisReady) ? styles.authButtonDisabled : {})
              }}
            >
              {isGoogleServicesAuthorized ? "Google Services: ON!" : "Authorize Google Services"}
            </button>
            <button 
              onClick={handleGoogleServicesSignoutClick} 
              disabled={!isGoogleServicesAuthorized || !gapiReady || !gisReady} 
              style={{ 
                ...styles.signoutButton,
                ...((!isGoogleServicesAuthorized || !gapiReady || !gisReady) ? styles.signoutButtonDisabled : {})
              }}
            >
              Sign Out Google Services
            </button>
            <p style={styles.statusMessage}>
              {googleServicesAuthMessage}
            </p>
          </>
        )}
        {eventCreationStatus && (
          <p style={{ 
            ...styles.calendarStatus,
            ...(eventCreationStatus.includes("Error") || eventCreationStatus.includes("Bummer") ? 
              styles.calendarStatusError : 
              styles.calendarStatusSuccess)
          }}>
            Calendar Update: {eventCreationStatus}
          </p>
        )}
      </div>

      {/* Session Management UI */}
      <div style={styles.googleServicesContainer}>
        <h4 style={styles.googleServicesTitle}>Session Management 🧠</h4>
        
        <div style={{ marginBottom: '12px', fontSize: '12px', color: '#666' }}>
          Current Session: <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px' }}>
            {currentSessionId.split('_')[1] || 'Loading...'}
          </code>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button
            onClick={handleNewSession}
            style={{
              background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '12px',
              transition: 'all 0.3s ease',
            }}
          >
            🆕 New Session
          </button>
          
          <button
            onClick={handleClearSession}
            style={{
              background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '12px',
              transition: 'all 0.3s ease',
            }}
          >
            🗑️ Clear Context
          </button>
        </div>
        
        {sessionStatus && (
          <p style={{
            fontSize: '12px',
            color: sessionStatus.includes('Failed') ? '#f44336' : '#4CAF50',
            margin: '4px 0',
            fontWeight: '500'
          }}>
            {sessionStatus}
          </p>
        )}
        
        <p style={{ fontSize: '11px', color: '#888', margin: '8px 0 0 0', lineHeight: '1.3' }}>
          • <strong>New Session:</strong> Start fresh conversation context<br/>
          • <strong>Clear Context:</strong> Remove current session history<br/>
          • Sessions auto-create on page refresh
        </p>
      </div>

      {currentOperationMessage && !eventCreationStatus && (
         <div style={styles.operationStatus}>
            {currentOperationMessage}
         </div>
      )}

      {/* Animations CSS */}
      <style>{animations}</style>
    </>
  );
}

export const Altair = memo(AltairComponent);