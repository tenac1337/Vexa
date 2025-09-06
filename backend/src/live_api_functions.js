/**
 * Live API Function Definitions for Enhanced Content Generation
 * These functions provide immediate responses perfect for live audio APIs
 */

// Basic Notion Page Creation with Auto-Generated Content using Gemini
async function createNotionPage(args) {
    const { title, notionParentId } = args;
    
    if (!title) {
        return {
            success: false,
            error: "Title is required for Notion page creation."
        };
    }
    
    if (!notionParentId) {
        return {
            success: false,
            error: "Notion parent page ID is required. Please configure your Notion integration."
        };
    }
    
    try {
        // Auto-generate content using enhanced content generator
        const response = await fetch('http://localhost:3001/api/notion/enhanced-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: title,
                notionParentId: notionParentId,
                contentType: 'overview'  // Default to overview for general page creation
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            return {
                success: true,
                message: `Created Notion page: "${result.title}" with auto-generated content`,
                pageId: result.notionPageId,
                pageUrl: result.notionPageUrl,
                title: result.title,
                metadata: {
                    model: result.contentMetadata?.model,
                    wordCount: result.contentMetadata?.wordCount,
                    contentGenerated: true
                }
            };
        } else {
            return {
                success: false,
                error: `Failed to create Notion page with auto-generated content: ${result.error}`
            };
        }
        
    } catch (error) {
        return {
            success: false,
            error: `Network error creating Notion page: ${error.message}`
        };
    }
}

// Enhanced Content Generation Function - For Specific Content Types
async function createEnhancedNotionPage(args) {
    const { title, contentType, content_type, notionParentId, parent_page_id } = args;
    
    // Handle both parameter naming conventions
    const finalContentType = contentType || content_type || 'research';
    const finalParentId = notionParentId || parent_page_id;
    
    if (!title) {
        return {
            success: false,
            error: "Title is required for enhanced Notion page creation."
        };
    }
    
    // Use a default parent ID if none provided
    const DEFAULT_NOTION_PARENT_PAGE_ID = "1fe8a6c3e40b80dfa959f4a922519c15";
    const effectiveParentId = finalParentId || DEFAULT_NOTION_PARENT_PAGE_ID;
    
    try {
        const response = await fetch('http://localhost:3001/api/notion/enhanced-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: title,
                notionParentId: effectiveParentId,
                contentType: finalContentType
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            return {
                success: true,
                message: `Created comprehensive ${finalContentType} page: "${result.title}"`,
                page_id: result.notionPageId,
                url: result.notionPageUrl,
                metadata: {
                    model: result.contentMetadata?.model,
                    wordCount: result.contentMetadata?.wordCount,
                    sections: result.contentMetadata?.sectionsCount,
                    contentType: result.contentMetadata?.contentType
                }
            };
        } else {
            return {
                success: false,
                error: `Failed to create enhanced content: ${result.error}`
            };
        }
        
    } catch (error) {
        return {
            success: false,
            error: `Network error creating enhanced content: ${error.message}`
        };
    }
}

// Deep Research Tool using STORM
async function deepResearch(args) {
    const { query, notionParentId } = args;
    
    if (!query) {
        return {
            success: false,
            error: "Query is required for deep research."
        };
    }
    
    if (!notionParentId) {
        return {
            success: false,
            error: "Notion parent page ID is required. Please configure your Notion integration."
        };
    }
    
    try {
        const response = await fetch('http://localhost:3001/api/storm/research', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                notionParentId: notionParentId
            })
        });
        
        const result = await response.json();
        
        if (result.stormResult && result.stormResult.success) {
            return {
                success: true,
                message: `Completed deep research on: "${query}"`,
                pageId: result.notionPageId,
                pageUrl: result.notionPageUrl,
                research: {
                    overview: result.stormResult.overview,
                    sources: result.stormResult.sources?.length || 0,
                    depth: "Deep Research with Multiple Sources"
                }
            };
        } else {
            return {
                success: false,
                error: `Deep research failed: ${result.error || 'Unknown error'}`
            };
        }
        
    } catch (error) {
        return {
            success: false,
            error: `Network error during deep research: ${error.message}`
        };
    }
}

// Read Notion Page Content Function
async function readNotionPageContent(args) {
    const { pageId } = args;
    
    if (!pageId) {
        return {
            success: false,
            error: "Page ID is required to read Notion content."
        };
    }
    
    try {
        const response = await fetch(`http://localhost:3001/api/notion/content/${pageId}`);
        const result = await response.json();
        
        if (result.success) {
            return {
                success: true,
                title: result.metadata.title,
                summary: result.summary,
                fullContent: result.content,
                metadata: {
                    wordCount: result.metadata.wordCount,
                    blockCount: result.metadata.blockCount,
                    url: result.metadata.url,
                    lastEdited: result.metadata.lastEditedTime
                }
            };
        } else {
            return {
                success: false,
                error: `Failed to read content: ${result.error}`
            };
        }
        
    } catch (error) {
        return {
            success: false,
            error: `Network error reading content: ${error.message}`
        };
    }
}

// Enhanced Update Notion Page Function
async function updateNotionPageWithAI(args) {
    const { pageId, query, contentType, updateMode } = args;
    
    if (!pageId) {
        return {
            success: false,
            error: "Page ID is required for enhanced page update."
        };
    }
    
    if (!query) {
        return {
            success: false,
            error: "Query is required to generate content for page update."
        };
    }
    
    try {
        const response = await fetch(`http://localhost:3001/api/notion/enhanced-update/${pageId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                contentType: contentType || 'research',
                updateMode: updateMode || 'append'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            return {
                success: true,
                message: result.message,
                pageId: result.notionPageId,
                pageUrl: result.notionPageUrl,
                updateMode: result.updateMode,
                blocksAdded: result.blocksAdded,
                metadata: {
                    model: result.contentMetadata?.model,
                    wordCount: result.contentMetadata?.wordCount,
                    contentType: result.contentMetadata?.contentType
                }
            };
        } else {
            return {
                success: false,
                error: `Failed to update page with AI: ${result.error}`
            };
        }
        
    } catch (error) {
        return {
            success: false,
            error: `Network error updating page: ${error.message}`
        };
    }
}

// Function Definitions for Live API
const liveFunctions = {
    create_notion_page: {
        name: "create_notion_page",
        description: "Create a Notion page with auto-generated content using Gemini. Just provide the title and content type, and comprehensive content will be automatically generated.",
        parameters: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "The topic or title for the Notion page. Content will be auto-generated based on this title."
                },
                content_type: {
                    type: "string", 
                    enum: ["research", "notes", "essay"],
                    description: "Type of content to generate: notes (for lecture notes), essay (for essay writing), research (for research content)"
                },
                parent_page_id: {
                    type: "string",
                    description: "Optional. The Notion parent page ID where the new page should be created. If not provided, a default parent page will be used."
                }
            },
            required: ["title", "content_type"]
        },
        function: createEnhancedNotionPage
    },
    
    create_enhanced_notion_page: {
        name: "create_enhanced_notion_page",
        description: "Create comprehensive Notion pages using Gemini 1.5 Pro with specific content types. Returns immediately with page ID while content is generated.",
        parameters: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "The topic or title for the Notion page"
                },
                contentType: {
                    type: "string", 
                    enum: ["research", "notes", "essay"],
                    description: "Type of content to generate: research (comprehensive research), notes (lecture notes, easy to read and prepare), essay (for essay writing)"
                },
                notionParentId: {
                    type: "string",
                    description: "The Notion parent page ID where the new page should be created"
                }
            },
            required: ["title", "notionParentId"]
        },
        function: createEnhancedNotionPage
    },
    
    deep_research: {
        name: "deep_research",
        description: "Conduct comprehensive deep research using STORM (multi-source research with citations). This takes longer but provides more thorough research with multiple sources. Use when user specifically asks for 'deep research' or 'comprehensive research with sources'.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The research query or topic to investigate deeply"
                },
                notionParentId: {
                    type: "string",
                    description: "The Notion parent page ID where the research results should be created"
                }
            },
            required: ["query", "notionParentId"]
        },
        function: deepResearch
    },
    
    read_notion_content: {
        name: "read_notion_content", 
        description: "Read the content of a previously created Notion page. Use this when user asks about content from a page you created.",
        parameters: {
            type: "object",
            properties: {
                pageId: {
                    type: "string",
                    description: "The Notion page ID to read content from"
                }
            },
            required: ["pageId"]
        },
        function: readNotionPageContent
    },
    
    update_notion_page_with_ai: {
        name: "update_notion_page_with_ai",
        description: "Update an existing Notion page with AI-generated content using Gemini 1.5 Pro. Can append new content or replace existing content entirely.",
        parameters: {
            type: "object",
            properties: {
                pageId: {
                    type: "string",
                    description: "The Notion page ID to update"
                },
                query: {
                    type: "string",
                    description: "What content to generate and add to the page. Describe what you want the AI to write about."
                },
                contentType: {
                    type: "string",
                    enum: ["research", "notes", "essay", "summary", "analysis"],
                    description: "Type of content to generate: research (comprehensive research), notes (lecture notes), essay (essay writing), summary (summarize content), analysis (detailed analysis)"
                },
                updateMode: {
                    type: "string",
                    enum: ["append", "replace"],
                    description: "Whether to append new content to existing content or replace all existing content entirely"
                }
            },
            required: ["pageId", "query"]
        },
        function: updateNotionPageWithAI
    }
};

module.exports = { liveFunctions, createNotionPage, createEnhancedNotionPage, deepResearch, readNotionPageContent, updateNotionPageWithAI }; 