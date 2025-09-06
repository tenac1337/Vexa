require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const MarkdownIt = require('markdown-it');
const { PythonShell } = require('python-shell');
const path = require('path');
const NotionTextFormatter = require('./notionTextFormatter');
const { callPerplexitySearch, callStormResearch } = require('./live_api_functions');
const notionTextFormatter = require('./notionTextFormatter');
const { NotionClient } = require('./notionClient');
const { generateEnhancedContent, generateAndCreateNotionPage, generateAndUpdateNotionPage } = require('./contentGenerator');
const sqlite3 = require('sqlite3').verbose();
const fetch = require('node-fetch');
const { execSync } = require('child_process');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3001;

// --- Constants ---
const DEFAULT_NOTION_PARENT_PAGE_ID = process.env.DEFAULT_NOTION_PARENT_PAGE_ID || "1fe8a6c3e40b80dfa959f4a922519c15";

// Initialize the improved text formatter
const textFormatter = new NotionTextFormatter();

// Middleware
app.use(helmet());
app.use(cors({
    origin: 'http://localhost:3000', // Allow requests from your frontend
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        port: port
    });
});

// Notion API configuration
const notionConfig = {
    baseURL: 'https://api.notion.com/v1',
    headers: {
        'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
        'Notion-Version': process.env.NOTION_VERSION || '2022-06-28',
        'Content-Type': 'application/json'
    }
};

const md = new MarkdownIt();

function tokensToRichText(tokens) {
    const richTexts = [];
    let stack = []; // To manage nested styles like bold within italics
    let currentAnnotations = {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false, // Notion API doesn't directly support underline in rich text, but we keep it for completeness
        code: false,
        color: 'default'
    };
    let currentLink = null;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        let textContent = token.content;

        if (token.type === 'text') {
            richTexts.push({
                type: 'text',
                text: { content: textContent, link: currentLink },
                annotations: { ...currentAnnotations },
                plain_text: textContent,
                href: currentLink ? currentLink.href : null
            });
        } else if (token.type === 'strong_open') {
            stack.push({ ...currentAnnotations });
            currentAnnotations.bold = true;
        } else if (token.type === 'strong_close') {
            currentAnnotations.bold = stack.pop()?.bold || false;
        } else if (token.type === 'em_open') {
            stack.push({ ...currentAnnotations });
            currentAnnotations.italic = true;
        } else if (token.type === 'em_close') {
            currentAnnotations.italic = stack.pop()?.italic || false;
        } else if (token.type === 's_open') { // Strikethrough open
            stack.push({ ...currentAnnotations });
            currentAnnotations.strikethrough = true;
        } else if (token.type === 's_close') { // Strikethrough close
            currentAnnotations.strikethrough = stack.pop()?.strikethrough || false;
        } else if (token.type === 'code_inline') {
            // For inline code, we create a single rich text object with the code annotation
            richTexts.push({
                type: 'text',
                text: { content: textContent, link: currentLink },
                annotations: { ...currentAnnotations, code: true }, // Apply current annotations plus code
                plain_text: textContent,
                href: currentLink ? currentLink.href : null
            });
        } else if (token.type === 'link_open') {
            stack.push(currentLink); // Save current link state if any
            const hrefAttr = token.attrs.find(attr => attr[0] === 'href');
            if (hrefAttr) {
                currentLink = { href: hrefAttr[1] };
            }
        } else if (token.type === 'link_close') {
            currentLink = stack.pop(); // Restore previous link state
        }
        // Softbreak and hardbreak can be handled by how blocks are structured, or ignored for rich text.
    }
    return richTexts.filter(rt => rt.plain_text.length > 0 || (rt.text && rt.text.content.length > 0)); // Ensure no empty rich text objects
}

function markdownToNotionBlocks(markdownContent) {
    const tokens = md.parse(markdownContent, {});
    const blocks = [];
    let currentBlock = null;
    let listType = null; // 'bulleted_list_item' or 'numbered_list_item'
    let listChildren = [];

    function pushCurrentList() {
        if (listChildren.length > 0) {
            if (listType === 'bulleted_list_item') {
                // This is a simplification. Notion API expects list items as direct children of the page or other blocks.
                // A true bulleted_list block would contain bulleted_list_item children.
                // For now, each list item becomes its own block for simplicity with markdown-it tokens.
                // Or, we group them as paragraphs if Notion API doesn't support nested list blocks well this way.
                 listChildren.forEach(item => blocks.push(item));
            } else if (listType === 'numbered_list_item') {
                 listChildren.forEach(item => blocks.push(item));
            }
        }
        listChildren = [];
        listType = null;
    }

    function createHeadingBlock(level, inlineToken) {
        try {
            if (!inlineToken || !inlineToken.children) {
                console.warn(`Skipping heading_${level} - no inline content available`);
                return null;
            }
            const richText = tokensToRichText(inlineToken.children);
            if (richText.length === 0) {
                console.warn(`Skipping heading_${level} - empty rich text content`);
                return null;
            }
            // Notion only supports heading_1, heading_2, and heading_3
            // Convert H4, H5, H6 to H3
            const notionLevel = Math.min(level, 3);
            return {
                object: 'block',
                type: `heading_${notionLevel}`,
                [`heading_${notionLevel}`]: { rich_text: richText }
            };
        } catch (error) {
            console.error(`Error creating heading_${level} block:`, error);
            return null;
        }
    }

    function createParagraphBlock(inlineToken) {
        try {
            if (!inlineToken || !inlineToken.children) {
                console.warn('Skipping paragraph - no inline content available');
                return null;
            }
            const richText = tokensToRichText(inlineToken.children);
            if (richText.length === 0) {
                console.warn('Skipping paragraph - empty rich text content');
                return null;
            }
            return {
                object: 'block',
                type: 'paragraph',
                paragraph: { rich_text: richText }
            };
        } catch (error) {
            console.error('Error creating paragraph block:', error);
            return null;
        }
    }

    function createListItemBlock(listItemType, contentTokens) {
        try {
            if (!contentTokens || contentTokens.length === 0) {
                console.warn(`Skipping ${listItemType} - no content tokens`);
                return null;
            }
            const richText = tokensToRichText(contentTokens);
            if (richText.length === 0) {
                console.warn(`Skipping ${listItemType} - empty rich text content`);
                return null;
            }
            return {
                object: 'block',
                type: listItemType,
                [listItemType]: { rich_text: richText }
            };
        } catch (error) {
            console.error(`Error creating ${listItemType} block:`, error);
            return null;
        }
    }

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type.endsWith('_open')) {
            // If a block type opens and we have an active list, push it first.
            if (!token.type.startsWith('list_item') && !token.type.startsWith('bulleted_list') && !token.type.startsWith('ordered_list') && listType) {
                pushCurrentList();
            }
        }

        switch (token.type) {
            case 'heading_open':
                pushCurrentList();
                const level = parseInt(token.tag.substring(1));
                const inlineContentToken = tokens[i + 1];
                const headingBlock = createHeadingBlock(level, inlineContentToken);
                if (headingBlock) {
                    blocks.push(headingBlock);
                }
                i++; // Skip the inline content token as it's handled by createHeadingBlock
                break;

            case 'paragraph_open':
                pushCurrentList();
                // tokens[i+1] should be 'inline' token with children
                const paragraphInlineContent = tokens[i+1];
                const paragraphBlock = createParagraphBlock(paragraphInlineContent);
                if (paragraphBlock) {
                    blocks.push(paragraphBlock);
                }
                i++; // Skip the inline content token
                break;

            case 'bullet_list_open':
                pushCurrentList();
                listType = 'bulleted_list_item';
                break;
            case 'ordered_list_open':
                pushCurrentList();
                listType = 'numbered_list_item';
                break;
            
            case 'list_item_open':
                // Content of list items will be handled by paragraph_open or other nested blocks.
                // We need to find the inline content for this list item.
                // markdown-it structure for lists: list_item_open -> paragraph_open -> inline -> text -> paragraph_close -> list_item_close
                let listItemContentTokens = [];
                // Look ahead for the inline content of the list item
                if (tokens[i+1] && tokens[i+1].type === 'paragraph_open' && tokens[i+2] && tokens[i+2].type === 'inline') {
                    listItemContentTokens = tokens[i+2].children;
                     i += 2; // Move past paragraph_open and inline
                } else if (tokens[i+1] && tokens[i+1].type === 'inline') { // Simpler list item
                    listItemContentTokens = tokens[i+1].children;
                    i +=1; // Move past inline
                }

                if (listType && listItemContentTokens.length > 0) {
                    const listItemBlock = createListItemBlock(listType, listItemContentTokens);
                    if (listItemBlock) {
                        listChildren.push(listItemBlock);
                    }
                }
                break;

            case 'bullet_list_close':
            case 'ordered_list_close':
                pushCurrentList();
                break;

            case 'fence': // Code block
                pushCurrentList();
                try {
                    const lang = token.info ? token.info.split(' ')[0] : 'plain text';
                    if (token.content && token.content.trim().length > 0) {
            blocks.push({
                object: 'block',
                type: 'code',
                code: {
                                rich_text: [{ type: 'text', text: { content: token.content } }],
                                language: lang.toLowerCase() || 'javascript' // Default to JS if no lang
                            }
                        });
                    } else {
                        console.warn('Skipping code block - empty content');
                    }
                } catch (error) {
                    console.error('Error creating code block:', error);
                }
                break;

            case 'blockquote_open':
                pushCurrentList();
                try {
                    // For blockquotes, we'll gather all inline content within it.
                    // This assumes blockquotes contain paragraphs.
                    // A more robust parser would handle nested block elements if any.
                    let quoteTokens = [];
                    let j = i + 1;
                    while (j < tokens.length && tokens[j].type !== 'blockquote_close') {
                        if (tokens[j].type === 'paragraph_open' && tokens[j+1] && tokens[j+1].type === 'inline') {
                            quoteTokens.push(...tokens[j+1].children);
                             // Add a newline if there are multiple paragraphs in the blockquote
                            if (tokens[j+2] && tokens[j+2].type === 'paragraph_close' && tokens[j+3] && tokens[j+3].type === 'paragraph_open') {
                                 quoteTokens.push({type: 'text', content: '\n'});
                            }
                            j += 2; // Skip paragraph_open and inline
                        } else {
                            j++;
                        }
                    }
                    i = j; // Move index past the blockquote
                    
                    if(quoteTokens.length > 0) {
                        const richText = tokensToRichText(quoteTokens);
                        if (richText.length > 0) {
                            blocks.push({
                                object: 'block',
                                type: 'quote',
                                quote: { rich_text: richText }
                            });
                        } else {
                            console.warn('Skipping blockquote - empty rich text content');
                        }
                    } else {
                        console.warn('Skipping blockquote - no content tokens');
                    }
                } catch (error) {
                    console.error('Error creating blockquote block:', error);
                }
                break;
            
            case 'hr': // Horizontal rule
                pushCurrentList();
            blocks.push({
                object: 'block',
                type: 'divider',
                divider: {}
            });
                break;

            // We can ignore _close tokens for blocks handled by _open, and inline tokens as they're part of block content.
            // text tokens outside of inline/paragraphs are usually not expected at the top level of md.parse.
        }
    }
    pushCurrentList(); // Push any remaining list items

    // Filter out any potentially empty or undefined blocks, and ensure block-specific content exists
    const validBlocks = blocks.filter(block => {
        if (!block || !block.type) {
            console.warn('Filtering out block without type:', JSON.stringify(block));
            return false;
        }
        // Check if the block-specific content key (e.g., block.paragraph, block.heading_1) exists and is an object
        if (typeof block[block.type] !== 'object' || block[block.type] === null) {
            console.warn('Filtering out malformed block - missing content object:', JSON.stringify(block));
            return false;
        }
        // For blocks that rely on rich_text, ensure rich_text is present and not empty
        if (block[block.type] && block[block.type].hasOwnProperty('rich_text')) {
            const richText = block[block.type].rich_text;
            if (!Array.isArray(richText) || richText.length === 0) {
                // Allow empty rich_text for certain types like 'code' where content is elsewhere, 
                // but for paragraphs, headings, etc., it should not be empty.
                if (block.type !== 'code') { // 'code' block's content is in block.code.text.content, not rich_text array for the main content.
                    console.warn(`Filtering out block type '${block.type}' due to empty/invalid rich_text:`, JSON.stringify(block));
                    return false;
                }
            }
        }
        return true;
    });

    console.log(`markdownToNotionBlocks: Created ${blocks.length} total blocks, ${validBlocks.length} valid blocks after filtering`);
    return validBlocks;
}

// Table support is not included in this implementation. Notion API table blocks require a more complex structure.
// You may add table support in the future if needed.

// Helper: Split array into chunks of specified size
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

// Helper: Create Notion page with batching for >100 blocks
async function createNotionPageWithBatching({ parent, properties, children }) {
    if (children.length === 0) {
        throw new Error('No blocks to create page with');
    }

    const blockChunks = chunkArray(children, 100);
    console.log(`📊 Creating page with ${children.length} blocks in ${blockChunks.length} batches`);

    // 1. Create the page with the first 100 blocks (or fewer)
    const createResponse = await axios.post(
        `${notionConfig.baseURL}/pages`,
        {
            parent,
            properties,
            children: blockChunks[0]
        },
        { headers: notionConfig.headers }
    );

    const pageId = createResponse.data.id;
    console.log(`✅ Created page with ${blockChunks[0].length} blocks`);

    // 2. Append remaining blocks in batches of 100
    for (let i = 1; i < blockChunks.length; i++) {
        console.log(`📝 Appending batch ${i + 1}/${blockChunks.length} (${blockChunks[i].length} blocks)`);
        await axios.patch(
            `${notionConfig.baseURL}/blocks/${pageId}/children`,
            { children: blockChunks[i] },
            { headers: notionConfig.headers }
        );
        console.log(`✅ Appended batch ${i + 1} successfully`);
    }

    return {
        data: createResponse.data,
        pageId,
        url: createResponse.data.url
    };
}

// Create a new Notion page
app.post('/api/notion/pages', async (req, res) => {
    try {
        const { parentId, title, content } = req.body;

        if (!parentId || !title || !content) {
            return res.status(400).json({
                error: 'Missing required fields',
                details: 'parentId, title, and content are required'
            });
        }

        const blocks = markdownToNotionBlocks(content);
        const response = await axios.post(
            `${notionConfig.baseURL}/pages`,
            {
                parent: { page_id: parentId },
                properties: {
                    title: [
                        {
                            text: {
                                content: title
                            }
                        }
                    ]
                },
                children: blocks
            },
            { headers: notionConfig.headers }
        );

        res.json({
            id: response.data.id,
            url: response.data.url,
            title: title
        });
    } catch (error) {
        console.error('Error creating Notion page:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to create Notion page',
            details: error.response?.data || error.message
        });
    }
});

// Get a Notion page
app.get('/api/notion/pages/:pageId', async (req, res) => {
    try {
        const pageId = req.params.pageId;
        
        // First get the page metadata
        const pageResponse = await axios.get(
            `${notionConfig.baseURL}/pages/${pageId}`,
            { headers: notionConfig.headers }
        );

        // Then get the page content
        const blocksResponse = await axios.get(
            `${notionConfig.baseURL}/blocks/${pageId}/children`,
            { headers: notionConfig.headers }
        );

        res.json({
            id: pageId,
            title: pageResponse.data.properties.title.title[0]?.text.content || 'Untitled',
            blocks: blocksResponse.data.results || [],
            url: pageResponse.data.url
        });
    } catch (error) {
        console.error('Error fetching Notion page:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to fetch Notion page',
            details: error.response?.data || error.message
        });
    }
});

// Update a Notion page
app.patch('/api/notion/pages/:pageId', async (req, res) => {
    try {
        const pageId = req.params.pageId;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                error: 'Missing required field',
                details: 'content is required'
            });
        }

        const blocks = markdownToNotionBlocks(content);
        const response = await axios.patch(
            `${notionConfig.baseURL}/blocks/${pageId}/children`,
            {
                children: blocks
            },
            { headers: notionConfig.headers }
        );

        res.json({
            id: pageId,
            message: 'Page updated successfully'
        });
    } catch (error) {
        console.error('Error updating Notion page:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: 'Failed to update Notion page',
            details: error.response?.data || error.message
        });
    }
});

// STORM Research API
app.post('/api/storm/research', async (req, res) => {
    try {
        const { query, notionParentId } = req.body;
        
        console.log(`Received STORM request - Query: "${query}", ParentId: "${notionParentId}"`);
        
        if (!query) {
            return res.status(400).json({ error: 'Missing required field: query' });
        }
        if (!notionParentId) {
            return res.status(400).json({ error: 'Missing required field: notionParentId' });
        }

        console.log(`Starting STORM research for: ${query}`);

        // Setup Python environment variables
        const pythonOptions = {
            mode: 'text',
            pythonPath: path.join(__dirname, '../venv/bin/python'),
            pythonOptions: ['-u'], // Unbuffered stdout
            scriptPath: __dirname + '/../',
            args: [query, '--output-dir', '/tmp/storm_output']
        };

        // Set environment variables for Python script
        const env = {
            ...process.env,
            GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
            SEARCH_ENGINE: process.env.SEARCH_ENGINE || 'duckduckgo',
            SEARCH_TOP_K: process.env.SEARCH_TOP_K || '3'
        };

        // Add search engine API keys if available
        if (process.env.BING_SEARCH_API_KEY) env.BING_SEARCH_API_KEY = process.env.BING_SEARCH_API_KEY;
        if (process.env.YDC_API_KEY) env.YDC_API_KEY = process.env.YDC_API_KEY;
        if (process.env.SERPER_API_KEY) env.SERPER_API_KEY = process.env.SERPER_API_KEY;
        if (process.env.TAVILY_API_KEY) env.TAVILY_API_KEY = process.env.TAVILY_API_KEY;

        pythonOptions.env = env;

        console.log('PythonShell: About to run script with options:', JSON.stringify(pythonOptions));
        
        // Run STORM research
        const stormResult = await new Promise((resolve, reject) => {
            console.log('PythonShell: Promise created, PythonShell.run initiating...');
            const pyshell = new PythonShell('storm_research.py', pythonOptions);

            let scriptOutput = [];

            pyshell.on('message', function (message) {
                // This will receive each line from python script's stdout
                console.log('PythonShell [stdout]:', message);
                scriptOutput.push(message);
            });

            pyshell.on('stderr', function (stderr) {
                // stderr messages from python script
                console.error('PythonShell [stderr]:', stderr);
                // We might not want to reject immediately on any stderr, 
                // as some libraries use it for warnings. But good to log.
            });

            pyshell.on('error', function (err) {
                // This is for errors encountered by PythonShell itself (e.g., can't find python)
                console.error('PythonShell [error event]: Error with PythonShell execution:', err);
                return reject(err);
            });

            pyshell.on('close', function (code) {
                console.log('PythonShell [close event]: Script finished.');
                console.log('PythonShell [close event]: Exit code was:', code);

                if (code !== 0 && scriptOutput.length === 0) {
                    console.error(`PythonShell: Script exited with code ${code} and no output.`);
                    return reject(new Error(`Python script exited with code ${code}`));
                }

                // Filter out empty lines from scriptOutput, then take the last actual line of output.
                const nonEmptyOutputLines = scriptOutput.filter(line => line.trim() !== '');
                if (nonEmptyOutputLines.length === 0) {
                    console.error('PythonShell: No non-empty output collected from Python script via stdout messages.');
                    return reject(new Error('No non-empty output from STORM script messages'));
                }

                const lastLineOutput = nonEmptyOutputLines[nonEmptyOutputLines.length - 1];

                try {
                    // const output = scriptOutput.join('\n'); // OLD WAY - INCORRECT
                    const output = lastLineOutput; // NEW WAY - Should be the single JSON line
                    console.log('PythonShell: Final output line for JSON parsing. Length:', output.length);
                    console.log('PythonShell: Attempting to parse JSON from last line:', output.substring(0, 500) + (output.length > 500 ? '...' : ''));
                    
                    const result = JSON.parse(output);
                    console.log('PythonShell: JSON parsed successfully. Result success flag:', result.success);
                    return resolve(result);
                } catch (parseError) {
                    console.error('PythonShell: Failed to parse final Python output line as JSON:', parseError);
                    console.error('PythonShell: Last line that failed parsing:', lastLineOutput);
                    console.error('PythonShell: All stdout lines received:', scriptOutput);
                    return reject(new Error('Failed to parse final STORM research result line as JSON'));
                }
            });

            // Note: PythonShell.run is a convenience method that does new PythonShell(...).end(...).send(...).collect(...)
            // By constructing it manually, we have more control over event handling.
            // We don't need to call pyshell.send() if we pass args via pythonOptions.
            // We don't need to call pyshell.end() if the script is supposed to run once and exit.

        });

        console.log('Node.js: Promise for PythonShell resolved/rejected. stormResult:', stormResult);

        console.log('STORM research completed. Success:', stormResult.success);

        if (!stormResult.success) {
            let errorMessage = 'STORM research failed';
            let statusCode = 500;
            
            // Check for specific Google API errors
            if (stormResult.error && stormResult.error.includes('Generative Language API has not been used')) {
                errorMessage = 'Google Generative Language API is not enabled for this project. Please enable it in the Google Cloud Console.';
                statusCode = 503; // Service Unavailable
            } else if (stormResult.error && stormResult.error.includes('PERMISSION_DENIED')) {
                errorMessage = 'Google API access denied. Please check your API key and permissions.';
                statusCode = 403;
            }
            
            return res.status(statusCode).json({
                error: errorMessage,
                details: stormResult.error,
                helpUrl: stormResult.error && stormResult.error.includes('93866513270') ? 
                    'https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=93866513270' : 
                    null
            });
        }

        console.log('Creating Notion page...');

        // Create Notion page with STORM results
        const capitalizedQuery = query.charAt(0).toUpperCase() + query.slice(1);
        const notionPageTitle = capitalizedQuery.length > 50 ? `${capitalizedQuery.substring(0, 50)}...` : capitalizedQuery;
        
        // Use the improved text formatter to format STORM content
        console.log('🔧 Using improved text formatter for Notion conversion...');
        const blocks = await textFormatter.formatStormContentForNotion(stormResult, query);
        
        // Validate blocks before sending to Notion
        const validatedBlocks = textFormatter.validateNotionBlocks(blocks);
        
        console.log('Number of validated blocks to send to Notion:', validatedBlocks.length);
        console.log('Generated Notion Blocks (first 3 shown):', JSON.stringify(validatedBlocks.slice(0, 3), null, 2));
        
        if (validatedBlocks.length === 0) {
            console.error('❌ No valid blocks generated for Notion');
            return res.status(500).json({
                error: 'Failed to format content for Notion',
                details: 'No valid blocks could be generated from the content'
            });
        }

        console.log('Creating Notion page with title:', notionPageTitle);
        
        const notionApiResponse = await createNotionPageWithBatching({
                parent: { page_id: notionParentId },
                properties: {
                    title: [
                        {
                            text: {
                                content: notionPageTitle
                            }
                        }
                    ]
                },
            children: validatedBlocks
        });

        console.log(`STORM research completed and added to Notion for: ${query}`);
        console.log('Notion page URL:', notionApiResponse.url);

        res.json({
            stormResult,
            notionPageUrl: notionApiResponse.url,
            notionPageId: notionApiResponse.pageId,
            message: 'STORM research completed and results added to Notion.'
        });

    } catch (error) {
        console.error('Error in STORM research workflow:', error);
        console.error('Error stack:', error.stack);
        let errorMessage = 'Failed in STORM research workflow';
        if (error.message) {
            errorMessage = error.message;
        }
        res.status(500).json({
            error: errorMessage,
            details: error.message || 'Unknown error occurred'
        });
    }
});

// Perplexity API configuration
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY ;

// Perplexity Search Proxy (Sonar Pro)
app.post('/api/perplexity/search', async (req, res) => {
    try {
        const { query, notionParentId } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Missing required field: query' });
        }
        if (!notionParentId) {
            return res.status(400).json({ error: 'Missing required field: notionParentId' });
        }

        const perplexityResponse = await axios.post(
            'https://api.perplexity.ai/chat/completions',
            {
                model: 'sonar-pro',
                messages: [
                    { role: 'system', content: 'Provide a comprehensive answer, formatted in Markdown.' },
                    { role: 'user', content: query }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
                }
            }
        );

        const perplexityContent = perplexityResponse.data.choices[0]?.message?.content;

        if (!perplexityContent) {
            return res.status(500).json({ error: 'Failed to get content from Perplexity' });
        }

        // Create a new Notion page with the Perplexity content
        const notionPageTitle = `Perplexity Result: ${query.substring(0, 50)}${query.length > 50 ? '...' : ''}`;
        
        // Use the improved text formatter
        console.log('🔧 Using improved text formatter for Perplexity content...');
        const blocks = await textFormatter.convertMarkdownToNotionBlocks(perplexityContent);
        const validatedBlocks = textFormatter.validateNotionBlocks(blocks);
        
        if (validatedBlocks.length === 0) {
            console.error('❌ No valid blocks generated for Perplexity content');
            return res.status(500).json({
                error: 'Failed to format Perplexity content for Notion',
                details: 'No valid blocks could be generated from the content'
            });
        }

        const notionApiResponse = await createNotionPageWithBatching({
                parent: { page_id: notionParentId },
                properties: {
                    title: [
                        {
                            text: {
                                content: notionPageTitle
                            }
                        }
                    ]
                },
            children: validatedBlocks
        });

        res.json({
            perplexityResponse: perplexityResponse.data,
            notionPageUrl: notionApiResponse.url,
            notionPageId: notionApiResponse.pageId,
            message: 'Successfully fetched from Perplexity and created Notion page.'
        });

    } catch (error) {
        console.error('Error in Perplexity to Notion workflow:', error.response?.data || error.message);
        let errorMessage = 'Failed in Perplexity to Notion workflow';
        if (error.isAxiosError && error.response) {
            errorMessage = `Error from ${error.config.url}: ${JSON.stringify(error.response.data)}`;
        } else if (error.message) {
            errorMessage = error.message;
        }
        res.status(error.response?.status || 500).json({
            error: errorMessage,
            details: error.response?.data || error.message
        });
    }
});

// Enhanced Content Generation API using Gemini 1.5 Pro
app.post('/api/notion/enhanced-content', async (req, res) => {
    try {
        const { query, notionParentId, contentType = 'research' } = req.body;
        
        if (!query) {
            return res.status(400).json({ error: 'Missing required field: query' });
        }
        // Use default parent ID if not provided
        const parentId = notionParentId || DEFAULT_NOTION_PARENT_PAGE_ID;

        const result = await generateAndCreateNotionPage({
            query,
            notionParentId: parentId,
            contentType,
            textFormatter,
            notionConfig
        });

        res.json(result);

    } catch (error) {
        console.error('Error in Enhanced Content generation workflow:', error);
        res.status(500).json({
            success: false,
            error: 'Failed in Enhanced Content generation workflow',
            details: error.message || 'Unknown error occurred'
        });
    }
});

// Enhanced Page Update API using Gemini 1.5 Pro
app.patch('/api/notion/enhanced-update/:pageId', async (req, res) => {
    try {
        const pageId = req.params.pageId;
        const { query, contentType = 'research', updateMode = 'append' } = req.body;
        
        if (!pageId) {
            return res.status(400).json({ error: 'Missing required field: pageId' });
        }
        
        if (!query) {
            return res.status(400).json({ error: 'Missing required field: query (what content to generate)' });
        }

        console.log(`Enhanced update request - Page: ${pageId}, Query: "${query}", Type: ${contentType}, Mode: ${updateMode}`);

        const result = await generateAndUpdateNotionPage({
            pageId,
            query,
            contentType,
            updateMode,
            textFormatter,
            notionConfig
        });

        res.json(result);

    } catch (error) {
        console.error('Error in Enhanced Update workflow:', error);
        res.status(500).json({
            success: false,
            error: 'Failed in Enhanced Update workflow',
            details: error.message || 'Unknown error occurred'
        });
    }
});

// Read Notion page content (for live API to retrieve later)
app.get('/api/notion/content/:pageId', async (req, res) => {
    try {
        const pageId = req.params.pageId;
        
        console.log(`Reading content for Notion page: ${pageId}`);
        
        // Get the page metadata
        const pageResponse = await axios.get(
            `${notionConfig.baseURL}/pages/${pageId}`,
            { headers: notionConfig.headers }
        );

        // Get the page content blocks
        const blocksResponse = await axios.get(
            `${notionConfig.baseURL}/blocks/${pageId}/children?page_size=100`,
            { headers: notionConfig.headers }
        );

        // Extract title
        const title = pageResponse.data.properties.title?.title?.[0]?.text?.content || 'Untitled';
        
        // Convert blocks back to readable text
        const contentText = await convertNotionBlocksToText(blocksResponse.data.results);
        
        // Get additional metadata
        const metadata = {
            id: pageId,
            title: title,
            url: pageResponse.data.url,
            createdTime: pageResponse.data.created_time,
            lastEditedTime: pageResponse.data.last_edited_time,
            wordCount: contentText.split(/\s+/).length,
            blockCount: blocksResponse.data.results.length
        };

        console.log(`Successfully retrieved content for page: ${title} (${contentText.length} characters)`);

        res.json({
            success: true,
            metadata: metadata,
            content: contentText,
            summary: contentText.substring(0, 500) + (contentText.length > 500 ? '...' : ''),
            blocks: blocksResponse.data.results
        });

    } catch (error) {
        console.error('Error reading Notion page content:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            error: 'Failed to read Notion page content',
            details: error.response?.data || error.message
        });
    }
});

/**
 * Convert Notion blocks back to readable text
 * @param {Array} blocks - Array of Notion blocks
 * @returns {string} Readable text content
 */
async function convertNotionBlocksToText(blocks) {
    let text = '';
    
    for (const block of blocks) {
        try {
            switch (block.type) {
                case 'paragraph':
                    if (block.paragraph?.rich_text) {
                        text += extractRichTextToPlain(block.paragraph.rich_text) + '\n\n';
                    }
                    break;
                    
                case 'heading_1':
                    if (block.heading_1?.rich_text) {
                        text += '# ' + extractRichTextToPlain(block.heading_1.rich_text) + '\n\n';
                    }
                    break;
                    
                case 'heading_2':
                    if (block.heading_2?.rich_text) {
                        text += '## ' + extractRichTextToPlain(block.heading_2.rich_text) + '\n\n';
                    }
                    break;
                    
                case 'heading_3':
                    if (block.heading_3?.rich_text) {
                        text += '### ' + extractRichTextToPlain(block.heading_3.rich_text) + '\n\n';
                    }
                    break;
                    
                case 'bulleted_list_item':
                    if (block.bulleted_list_item?.rich_text) {
                        text += '• ' + extractRichTextToPlain(block.bulleted_list_item.rich_text) + '\n';
                    }
                    break;
                    
                case 'numbered_list_item':
                    if (block.numbered_list_item?.rich_text) {
                        text += '1. ' + extractRichTextToPlain(block.numbered_list_item.rich_text) + '\n';
                    }
                    break;
                    
                case 'quote':
                    if (block.quote?.rich_text) {
                        text += '> ' + extractRichTextToPlain(block.quote.rich_text) + '\n\n';
                    }
                    break;
                    
                case 'code':
                    if (block.code?.rich_text) {
                        text += '```\n' + extractRichTextToPlain(block.code.rich_text) + '\n```\n\n';
                    }
                    break;
                    
                case 'divider':
                    text += '---\n\n';
                    break;
                    
                default:
                    // For other block types, try to extract any rich text
                    if (block[block.type]?.rich_text) {
                        text += extractRichTextToPlain(block[block.type].rich_text) + '\n';
                    }
                    break;
            }
        } catch (blockError) {
            console.warn(`Error processing block ${block.id}:`, blockError);
            // Continue processing other blocks
        }
    }
    
    return text.trim();
}

/**
 * Extract plain text from Notion rich text array
 * @param {Array} richText - Notion rich text array
 * @returns {string} Plain text
 */
function extractRichTextToPlain(richText) {
    if (!Array.isArray(richText)) return '';
    
    return richText
        .map(rt => rt.text?.content || '')
        .join('')
        .trim();
}

// --- Database Setup ---
const dbPath = path.resolve(__dirname, '..', 'context_storage.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS contexts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// --- API Endpoints ---

// Endpoint to store new context
app.post('/api/context', (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ success: false, error: 'Content is required.' });
  }

  const stmt = db.prepare("INSERT INTO contexts (content) VALUES (?)");
  stmt.run(content, function(err) {
    if (err) {
      console.error('Error inserting context into database:', err);
      return res.status(500).json({ success: false, error: 'Failed to store context.' });
    }
    res.json({ success: true, message: 'Context stored successfully.', id: this.lastID });
  });
  stmt.finalize();
});

// Endpoint to get the latest stored context
app.get('/api/context', (req, res) => {
  db.get("SELECT content FROM contexts ORDER BY created_at DESC LIMIT 1", (err, row) => {
    if (err) {
      console.error('Error fetching context from database:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch context.' });
    }
    if (row) {
      res.json({ success: true, content: row.content });
    } else {
      res.json({ success: true, content: null, message: 'No context stored yet.' });
    }
  });
});

// Endpoint for creating a detailed report in Notion from the latest context
app.post('/api/context/detailed-report', async (req, res) => {
  const { title } = req.body;
  
  try {
    // Get the latest stored context
    const contextResult = await new Promise((resolve, reject) => {
      db.get("SELECT content FROM contexts ORDER BY created_at DESC LIMIT 1", (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!contextResult) {
      return res.status(404).json({ 
        success: false, 
        error: 'No context found. Please store some context first.' 
      });
    }

    const content = contextResult.content;
    const response = await fetch('http://localhost:3001/api/notion/enhanced-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `${title}: ${content}`,
        notionParentId: DEFAULT_NOTION_PARENT_PAGE_ID,
        contentType: 'detailed_report'
      })
    });

    const result = await response.json();
    if (result.success) {
      res.json({
        success: true,
        message: `Created detailed report: "${result.title}"`,
        notionPageUrl: result.notionPageUrl,
        notionPageId: result.notionPageId
      });
    } else {
      throw new Error(result.error || 'Failed to create detailed report');
    }
  } catch (error) {
    console.error('Error creating detailed report:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create detailed report' 
    });
  }
});

// Notion API Proxy
const notionClient = new NotionClient();

// NEW: Conversation storage for session context
const conversationDb = new sqlite3.Database(path.resolve(__dirname, '..', 'conversation_storage.db'), (err) => {
  if (err) {
    console.error('Error opening conversation database', err.message);
  } else {
    console.log('Connected to the conversation SQLite database.');
    conversationDb.run(`CREATE TABLE IF NOT EXISTS conversation_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      speaker TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Create screen context storage table
    conversationDb.run(`CREATE TABLE IF NOT EXISTS screen_contexts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME NOT NULL,
      platform TEXT NOT NULL,
      active_application TEXT,
      active_window_title TEXT,
      display_server TEXT,
      process_name TEXT,
      ocr_text TEXT,
      ocr_status TEXT,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

// NEW: System-wide typing endpoint
app.post('/api/system-typing', async (req, res) => {
  try {
    const { content_type, context_hint, tone, length, session_id } = req.body;
    
    // Use provided session_id or default
    const sessionId = session_id || 'default_session';
    
    console.log(`🎯 System typing request: ${content_type} (${tone || 'default'} tone, ${length || 'medium'} length)`);
    
    // STEP 1: Automatically capture current screen context for enhanced awareness
    console.log('📱 Capturing screen context for enhanced typing...');
    const screenContext = await getScreenContext(true); // Always include OCR for maximum context
    
    // STEP 2: Get conversation context for better content generation
    const conversationHistory = await new Promise((resolve, reject) => {
      conversationDb.all(
        "SELECT speaker, content FROM conversation_turns WHERE session_id = ? ORDER BY timestamp DESC LIMIT 50",
        [sessionId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    // Get the most recent user query (the current request that triggered this typing)
    const recentUserQuery = conversationHistory.find(row => row.speaker === 'user')?.content || context_hint;
    
    // Create comprehensive context for content generation
    const backgroundContext = conversationHistory
      .slice(0, 50)
      .map(row => `${row.speaker}: ${row.content}`).join('\n');
    
    // STEP 3: Build enhanced prompt with screen context integration
    const contextualPrompt = `You are Pi, Tarun's AI assistant. Generate ${content_type} content that will be typed directly where his cursor is positioned.

CRITICAL: Generate ONLY the final content to be typed. No explanations, no quotes around the content, no prefixes like "Here's a tweet:" - just the raw content.

PRIMARY REQUEST: "${recentUserQuery || context_hint}"

CONTENT REQUIREMENTS:
- Content Type: ${content_type}
- Tone: ${tone || 'friendly'}
- Length: ${length || 'medium'}

🖥️ CURRENT SCREEN CONTEXT:
- Active Application: ${screenContext.activeApplication || 'Unknown'}
- Window Title: ${screenContext.activeWindowTitle || 'Unknown'}
- Platform: ${screenContext.platform}
${screenContext.displayServer ? `- Display Server: ${screenContext.displayServer}` : ''}
${screenContext.ocrText && screenContext.ocrStatus === 'success' ? `
- Visible Screen Text: "${screenContext.ocrText.substring(0, 500)}${screenContext.ocrText.length > 500 ? '...' : ''}"` : ''}

BACKGROUND CONVERSATION CONTEXT (for reference only):
${backgroundContext}

APPLICATION-SPECIFIC GUIDANCE:
${screenContext.activeApplication === 'Cursor' || screenContext.activeApplication === 'code' ? `
🔧 CODE EDITOR DETECTED: Generate code comments, documentation, or code snippets as appropriate.
` : screenContext.activeApplication?.toLowerCase().includes('mail') || screenContext.activeApplication?.toLowerCase().includes('gmail') || screenContext.activeApplication?.toLowerCase().includes('outlook') ? `
📧 EMAIL CLIENT DETECTED: Generate professional email content with proper formatting.
` : screenContext.activeApplication?.toLowerCase().includes('slack') || screenContext.activeApplication?.toLowerCase().includes('discord') || screenContext.activeApplication?.toLowerCase().includes('teams') ? `
💬 CHAT APPLICATION DETECTED: Generate casual, conversational responses appropriate for team communication.
` : screenContext.activeApplication?.toLowerCase().includes('twitter') || screenContext.activeApplication?.toLowerCase().includes('x.com') ? `
🐦 TWITTER/X DETECTED: Generate tweet-optimized content under 280 characters with hashtags.
` : screenContext.activeApplication?.toLowerCase().includes('browser') || screenContext.activeApplication?.toLowerCase().includes('firefox') || screenContext.activeApplication?.toLowerCase().includes('chrome') ? `
🌐 WEB BROWSER DETECTED: Generate content appropriate for web forms, comments, or social media.
` : ''}

SPECIFIC INSTRUCTIONS FOR ${content_type.toUpperCase()}:
${content_type === 'tweet' ? `
- Generate a complete, engaging tweet (under 280 characters)
- Include relevant hashtags (2-3 max)
- Use emojis sparingly but effectively
- Make it conversational and authentic
- Focus on the specific topic: "${recentUserQuery || context_hint}"
- Consider the current screen context for relevance
- Example style: "Steve Jobs' design philosophy was revolutionary! Simple yet profound - 'simplicity is the ultimate sophistication' 🍎 #design #innovation #stevejobs"
` : content_type === 'email' ? `
- Generate a complete email with proper greeting and closing
- Professional tone unless specified otherwise
- Include subject context if relevant
- Keep it concise but complete
- Consider the email client context for formatting
` : content_type === 'code_comment' ? `
- Generate clear, helpful code comments
- Use appropriate comment syntax for the detected editor
- Be concise but informative
- Explain the purpose or functionality
` : content_type === 'response' ? `
- Generate a thoughtful response based on visible screen context
- Reference specific elements from the OCR text if relevant
- Keep tone consistent with the conversation
` : `
- Generate appropriate ${content_type} content
- Make it contextually relevant to the current application
- Keep it natural and conversational
- Consider the screen context for enhanced relevance
`}

CONTEXTUAL ENHANCEMENT:
${screenContext.ocrText && screenContext.ocrStatus === 'success' ? `
Based on the visible screen text, consider:
- Current topic/conversation visible on screen
- Form fields or input context
- Application-specific content requirements
- Any relevant keywords or phrases from: "${screenContext.ocrText.substring(0, 200)}..."
` : ''}

Generate the ${content_type} content now for: "${recentUserQuery || context_hint}"

Remember: Output ONLY the content to be typed, nothing else. The content should be perfectly suited for the current application context (${screenContext.activeApplication}).`;

    // STEP 4: Generate content using AI with enhanced context
    let generatedContent = '';
    
    try {
      // Use new Gemini API for content generation
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: contextualPrompt,
        config: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      });
      
      generatedContent = response.text;
      
      console.log(`✅ Generated contextual content for ${screenContext.activeApplication}: ${generatedContent.substring(0, 100)}...`);
      
    } catch (llmError) {
      console.warn('Gemini API generation failed, using enhanced fallback:', llmError.message);
      
      // Enhanced fallback with screen context
      generatedContent = await generateEnhancedTypingContentWithContext(
        content_type, 
        context_hint, 
        tone, 
        length, 
        conversationHistory, 
        screenContext
      );
    }

    // STEP 5: Type the content using xdotool with proper escaping
    let typed = false;
    try {
      // Escape the content properly for shell execution
      const escapedContent = generatedContent
        .replace(/\\/g, '\\\\')  // Escape backslashes
        .replace(/"/g, '\\"')    // Escape double quotes
        .replace(/'/g, "\\'")    // Escape single quotes
        .replace(/`/g, '\\`')    // Escape backticks
        .replace(/\$/g, '\\$')   // Escape dollar signs
        .replace(/!/g, '\\!')    // Escape exclamation marks
        .replace(/&/g, '\\&');   // Escape ampersands
      
      // Use a more reliable typing method
      setTimeout(() => {
        try {
          // Method 1: Try with proper escaping
          execSync(`xdotool type "${escapedContent}"`);
          console.log(`✅ Successfully typed content using xdotool in ${screenContext.activeApplication}`);
        } catch (xdotoolError) {
          console.warn('xdotool failed, trying alternative method:', xdotoolError.message);
          // Method 2: Write to temp file and type from file
          const fs = require('fs');
          const tempFile = '/tmp/pi_typing_content.txt';
          fs.writeFileSync(tempFile, generatedContent);
          execSync(`xdotool type --file "${tempFile}"`);
          fs.unlinkSync(tempFile); // Clean up
          console.log('✅ Successfully typed content using temp file method');
        }
      }, 100);
      typed = true;
    } catch (typingError) {
      console.error('Failed to type at cursor:', typingError);
      typed = false;
    }

    res.json({
      success: true,
      content: generatedContent,
      typed: typed,
      session_id: sessionId,
      screenContext: {
        application: screenContext.activeApplication,
        windowTitle: screenContext.activeWindowTitle,
        platform: screenContext.platform,
        hasOcrText: !!screenContext.ocrText,
        ocrStatus: screenContext.ocrStatus
      },
      message: typed ? 
        `Content generated and typed successfully in ${screenContext.activeApplication}!` : 
        'Content generated but typing failed'
    });

  } catch (error) {
    console.error('System typing error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// NEW: Store conversation turn
app.post('/api/conversation/store', (req, res) => {
  const { speaker, content, timestamp, session_id } = req.body;
  
  if (!speaker || !content) {
    return res.status(400).json({ 
      success: false, 
      error: 'Speaker and content are required.' 
    });
  }

  const sessionId = session_id || 'default_session';
  const stmt = conversationDb.prepare(
    "INSERT INTO conversation_turns (session_id, speaker, content, timestamp) VALUES (?, ?, ?, ?)"
  );
  
  stmt.run(sessionId, speaker, content, timestamp || new Date().toISOString(), function(err) {
    if (err) {
      console.error('Error storing conversation turn:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to store conversation turn.' 
      });
    }
    res.json({ 
      success: true, 
      message: 'Conversation turn stored successfully.',
      id: this.lastID 
    });
  });
  
  stmt.finalize();
});

// NEW: Get conversation context
app.get('/api/conversation/context', (req, res) => {
  const { session_id, limit = 50 } = req.query;
  const sessionId = session_id || 'default_session';
  
  conversationDb.all(
    "SELECT * FROM conversation_turns WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?",
    [sessionId, parseInt(limit)],
    (err, rows) => {
      if (err) {
        console.error('Error fetching conversation context:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch conversation context.' 
        });
      }
      
      res.json({ 
        success: true, 
        context: rows.reverse(), // Return in chronological order
        count: rows.length 
      });
    }
  );
});

// NEW: Create new session
app.post('/api/conversation/new-session', (req, res) => {
  const { session_id } = req.body;
  
  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Session ID is required.' 
    });
  }
  
  console.log(`🆕 New session created: ${session_id}`);
  
  res.json({ 
    success: true, 
    message: 'New session created successfully.',
    session_id: session_id 
  });
});

// NEW: Clear session context
app.post('/api/conversation/clear-session', (req, res) => {
  const { session_id } = req.body;
  
  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Session ID is required.' 
    });
  }
  
  conversationDb.run(
    "DELETE FROM conversation_turns WHERE session_id = ?",
    [session_id],
    function(err) {
      if (err) {
        console.error('Error clearing session context:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to clear session context.' 
        });
      }
      
      console.log(`🗑️ Cleared ${this.changes} conversation turns for session: ${session_id}`);
      
      res.json({ 
        success: true, 
        message: `Session context cleared successfully. Removed ${this.changes} conversation turns.`,
        session_id: session_id,
        cleared_count: this.changes
      });
    }
  );
});

// NEW: Get session statistics
app.get('/api/conversation/session-stats', (req, res) => {
  const { session_id } = req.query;
  
  if (!session_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Session ID is required.' 
    });
  }
  
  conversationDb.all(
    `SELECT 
      COUNT(*) as total_turns,
      COUNT(CASE WHEN speaker = 'user' THEN 1 END) as user_turns,
      COUNT(CASE WHEN speaker = 'assistant' THEN 1 END) as assistant_turns,
      MIN(timestamp) as session_start,
      MAX(timestamp) as last_activity
     FROM conversation_turns 
     WHERE session_id = ?`,
    [session_id],
    (err, rows) => {
      if (err) {
        console.error('Error fetching session stats:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch session statistics.' 
        });
      }
      
      const stats = rows[0] || {
        total_turns: 0,
        user_turns: 0,
        assistant_turns: 0,
        session_start: null,
        last_activity: null
      };
      
      res.json({ 
        success: true, 
        session_id: session_id,
        stats: stats
      });
    }
  );
});

// NEW: Get screen context
app.post('/api/screen-context', async (req, res) => {
  const { include_ocr = true } = req.body;
  
  try {
    const screenContext = await getScreenContext(include_ocr);
    res.json({
      success: true,
      context: screenContext
    });
  } catch (error) {
    console.error('Error getting screen context:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get screen context'
    });
  }
});

// NEW: Get screen context history
app.get('/api/screen-context/history', (req, res) => {
  const { limit = 50, include_ocr = false } = req.query;
  
  let query = `SELECT 
    id, timestamp, platform, active_application, active_window_title, 
    display_server, process_name, note, created_at
    ${include_ocr === 'true' ? ', ocr_text, ocr_status' : ''}
    FROM screen_contexts 
    ORDER BY created_at DESC 
    LIMIT ?`;
  
  conversationDb.all(query, [parseInt(limit)], (err, rows) => {
    if (err) {
      console.error('Error fetching screen context history:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch screen context history.' 
      });
    }
    
    res.json({ 
      success: true, 
      contexts: rows,
      count: rows.length 
    });
  });
});

// NEW: Get screen context statistics
app.get('/api/screen-context/stats', (req, res) => {
  const statsQuery = `
    SELECT 
      COUNT(*) as total_captures,
      COUNT(DISTINCT active_application) as unique_applications,
      COUNT(CASE WHEN ocr_text IS NOT NULL THEN 1 END) as ocr_captures,
      MIN(created_at) as first_capture,
      MAX(created_at) as latest_capture
    FROM screen_contexts
  `;
  
  conversationDb.get(statsQuery, (err, stats) => {
    if (err) {
      console.error('Error fetching screen context stats:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch screen context statistics.' 
      });
    }
    
    // Get most frequent applications
    const appsQuery = `
      SELECT active_application, COUNT(*) as frequency 
      FROM screen_contexts 
      WHERE active_application IS NOT NULL
      GROUP BY active_application 
      ORDER BY frequency DESC 
      LIMIT 10
    `;
    
    conversationDb.all(appsQuery, (err, apps) => {
      if (err) {
        console.error('Error fetching app frequency:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch application statistics.' 
        });
      }
      
      res.json({ 
        success: true, 
        statistics: stats,
        frequent_applications: apps
      });
    });
  });
});

// Helper function for enhanced content generation
async function generateEnhancedTypingContent(content_type, context_hint, tone, length, conversationContext) {
  // Enhanced template-based generation with better logic
  let content = '';
  
  const toneMap = {
    'enthusiastic': { adjective: 'incredible', emoji: '🚀', energy: 'high' },
    'professional': { adjective: 'significant', emoji: '📊', energy: 'formal' },
    'casual': { adjective: 'cool', emoji: '💫', energy: 'relaxed' },
    'friendly': { adjective: 'interesting', emoji: '✨', energy: 'warm' }
  };
  
  const currentTone = toneMap[tone] || toneMap['friendly'];
  
  switch (content_type) {
    case 'tweet':
      if (context_hint?.toLowerCase().includes('steve jobs')) {
        content = `Steve Jobs' innovation was truly ${currentTone.adjective}! ${currentTone.emoji} He didn't just build products, he redefined entire industries and inspired millions to think differently. What an incredible legacy of pushing boundaries! 🍎 #SteveJobs #Innovation #Legacy`;
      } else if (context_hint?.toLowerCase().includes('ai') || context_hint?.toLowerCase().includes('artificial intelligence')) {
        content = `AI development is absolutely ${currentTone.adjective}! ${currentTone.emoji} We're witnessing the birth of technologies that will reshape how we work, create, and solve problems. The future is being written right now! 🤖 #AI #Innovation #Future`;
      } else {
        content = `${context_hint || 'This'} is truly ${currentTone.adjective}! ${currentTone.emoji} ${
          tone === 'enthusiastic' ? 'Always exciting to see progress and innovation happening!' : 
          tone === 'professional' ? 'Worth noting the significant implications and potential impact.' :
          'Pretty amazing stuff happening in this space!'
        } #Innovation #Progress`;
      }
      break;
      
    case 'email':
      const greeting = tone === 'professional' ? 'I hope this email finds you well.' : 'Hope you\'re doing great!';
      const closing = tone === 'professional' ? 'Best regards' : tone === 'casual' ? 'Cheers!' : 'Best';
      content = `Hi there,\n\n${greeting} ${context_hint ? `Regarding ${context_hint}, I` : 'I'} wanted to share some thoughts and follow up on our discussion.\n\n${closing}`;
      break;
      
    case 'response':
      content = `Thanks for sharing that! ${context_hint ? `The point about ${context_hint} is particularly ${currentTone.adjective}.` : 'Really appreciate the insight.'} ${currentTone.emoji}`;
      break;
      
    case 'summary':
      content = `## Summary\n\n${context_hint ? `Key points about ${context_hint}:` : 'Main takeaways:'}\n\n• ${currentTone.adjective.charAt(0).toUpperCase() + currentTone.adjective.slice(1)} insights from our discussion\n• Worth exploring further\n• ${currentTone.emoji} Exciting potential ahead`;
      break;
      
    default:
      content = `${context_hint || 'Here is the requested content'} with a ${tone || 'friendly'} tone. ${currentTone.emoji}`;
  }
  
  // Adjust length
  if (length === 'short' && content.length > 100) {
    content = content.substring(0, 97) + '...';
  } else if (length === 'long' && content.length < 200) {
    content += `\n\nThis ${content_type} was generated with ${tone} tone, incorporating context about ${context_hint || 'the current discussion'}.`;
  }
  
  return content;
}

// Fallback content generation function
function generateFallbackContent(content_type, context_hint, tone, length) {
  const fallbackMap = {
    'tweet': `${context_hint || 'This'} is ${tone === 'enthusiastic' ? 'amazing' : 'interesting'}! ✨ #Innovation`,
    'email': `Hi,\n\n${context_hint ? `Regarding ${context_hint}, I` : 'I'} wanted to follow up.\n\nBest regards`,
    'response': `Thanks for that! ${context_hint ? `The ${context_hint} point is really insightful.` : 'Great perspective!'} 👍`,
    'summary': `Summary: ${context_hint || 'Key points from our discussion'} - worth exploring further.`
  };
  
  return fallbackMap[content_type] || `${context_hint || 'Generated content'} with ${tone || 'friendly'} tone.`;
}

// Helper function for generating content for typing
async function generateTypingContent({ content_type, context_hint, tone, length, conversationContext, screenContext }) {
  // This is a simple implementation - you can enhance with actual LLM calls
  let content = '';
  
  const contexts = conversationContext?.map(c => `${c.speaker}: ${c.content}`).join('\n') || '';
  
  switch (content_type) {
    case 'tweet':
      content = `${context_hint || 'Interesting thought'} 🚀 ${tone === 'enthusiastic' ? 'This is amazing!' : 'Worth sharing!'} #Innovation`;
      break;
    case 'email':
      content = `Hi,\n\n${context_hint || 'Following up on our conversation'}, I wanted to share some thoughts.\n\nBest regards`;
      break;
    default:
      content = `${context_hint || 'Generated content'} with ${tone || 'neutral'} tone.`;
  }
  
  return content;
}

// Helper function for typing at cursor using RobotJS
async function typeAtCursor(text) {
  try {
    execSync(`xdotool type "${text}"`);
    return { success: true, message: 'Text typed successfully' };
  } catch (error) {
    console.error('Failed to type at cursor:', error);
    return { success: false, error: error.message };
  }
}

async function getScreenContext(includeOCR = true) {
  const context = {
    timestamp: new Date().toISOString(),
    platform: process.platform
  };

  try {
    // Get active window information with enhanced Linux support
    if (process.platform === 'darwin') {
      // macOS - use AppleScript
      const activeApp = execSync(`osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`).toString().trim();
      context.activeApplication = activeApp;
      
      // Get window title if possible
      try {
        const windowTitle = execSync(`osascript -e 'tell application "System Events" to get title of front window of first application process whose frontmost is true'`).toString().trim();
        context.activeWindowTitle = windowTitle;
      } catch (e) {
        console.warn('Could not get window title on macOS:', e.message);
      }
      
    } else if (process.platform === 'win32') {
      // Windows - use PowerShell to get active window
      try {
        const activeApp = execSync('powershell "Get-Process | Where-Object {$_.MainWindowTitle -ne \\"\\"} | Select-Object -First 1 ProcessName | ForEach-Object {$_.ProcessName}"', { encoding: 'utf8' }).toString().trim();
        context.activeApplication = activeApp || 'Windows (unknown)';
        
        // Get window title
        const windowTitle = execSync('powershell "Get-Process | Where-Object {$_.MainWindowTitle -ne \\"\\"} | Select-Object -First 1 MainWindowTitle | ForEach-Object {$_.MainWindowTitle}"', { encoding: 'utf8' }).toString().trim();
        context.activeWindowTitle = windowTitle || 'Unknown Window';
      } catch (e) {
        console.warn('Could not get active window on Windows:', e.message);
        context.activeApplication = 'Windows (detection failed)';
      }
      
    } else {
      // Linux - Enhanced detection for X11 and Wayland
      try {
        // Check if we're in Wayland
        const waylandDisplay = process.env.WAYLAND_DISPLAY;
        const xdgSessionType = process.env.XDG_SESSION_TYPE;
        
        if (waylandDisplay || xdgSessionType === 'wayland') {
          // Wayland environment
          context.displayServer = 'wayland';
          
          try {
            // Try to get active window via swaymsg (for Sway compositor)
            const swayOutput = execSync('swaymsg -t get_tree | jq -r ".. | select(.focused? == true) | .app_id // .window_properties.class"', { encoding: 'utf8' }).toString().trim();
            context.activeApplication = swayOutput || 'Wayland (unknown app)';
          } catch (swayError) {
            try {
              // Try hyprctl for Hyprland
              const hyprOutput = execSync('hyprctl activewindow | grep "class:" | cut -d" " -f2', { encoding: 'utf8' }).toString().trim();
              context.activeApplication = hyprOutput || 'Wayland (unknown app)';
            } catch (hyprError) {
              context.activeApplication = 'Wayland (compositor not supported)';
              context.note = 'Active window detection requires Sway or Hyprland compositor';
            }
          }
        } else {
          // X11 environment
          context.displayServer = 'x11';
          
          try {
            // Get active window ID
            const windowId = execSync('xdotool getactivewindow', { encoding: 'utf8' }).toString().trim();
            
            // Get window class/application name using xprop
            const windowClassOutput = execSync(`xprop -id ${windowId} | grep "WM_CLASS"`, { encoding: 'utf8' }).toString().trim();
            const classMatch = windowClassOutput.match(/WM_CLASS\(STRING\) = "([^"]*)", "([^"]*)"/);
            const windowClass = classMatch ? classMatch[2] || classMatch[1] : 'Unknown';
            context.activeApplication = windowClass;
            
            // Get window title using xprop
            try {
              const windowTitleOutput = execSync(`xprop -id ${windowId} | grep "WM_NAME"`, { encoding: 'utf8' }).toString().trim();
              const titleMatch = windowTitleOutput.match(/WM_NAME\(STRING\) = "([^"]*)"/);
              const windowTitle = titleMatch ? titleMatch[1] : 'Unknown Window';
              context.activeWindowTitle = windowTitle;
            } catch (titleError) {
              // Fallback: try xdotool for title
              try {
                const windowTitle = execSync(`xdotool getwindowname ${windowId}`, { encoding: 'utf8' }).toString().trim();
                context.activeWindowTitle = windowTitle || 'Unknown Window';
              } catch (e) {
                context.activeWindowTitle = 'Title unavailable';
              }
            }
            
            // Get additional window info
            try {
              const windowPid = execSync(`xdotool getwindowpid ${windowId}`, { encoding: 'utf8' }).toString().trim();
              const processName = execSync(`ps -p ${windowPid} -o comm=`, { encoding: 'utf8' }).toString().trim();
              context.processName = processName;
            } catch (e) {
              console.warn('Could not get process info:', e.message);
            }
            
          } catch (xError) {
            console.warn('X11 window detection failed, trying fallback methods:', xError.message);
            
            // Fallback: try wmctrl
            try {
              const wmctrlOutput = execSync('wmctrl -l | grep "$(xdotool getactivewindow)"', { encoding: 'utf8' }).toString().trim();
              const windowInfo = wmctrlOutput.split(/\s+/).slice(3).join(' ');
              context.activeApplication = windowInfo || 'X11 (wmctrl fallback)';
            } catch (wmctrlError) {
              context.activeApplication = 'Linux X11 (detection failed)';
              context.note = 'Please install xdotool or wmctrl for window detection';
            }
          }
        }
      } catch (generalError) {
        console.warn('Linux window detection failed:', generalError.message);
        context.activeApplication = 'Linux (detection not available)';
        context.note = 'Window detection requires X11 tools (xdotool) or Wayland compositor support';
      }
    }

    // Enhanced OCR functionality
    if (includeOCR) {
      try {
        console.log('🔍 Starting OCR screen capture...');
        
        // Take screenshot first
        const screenshotPath = path.join(__dirname, '..', 'temp', `screenshot_${Date.now()}.png`);
        
        // Ensure temp directory exists
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Platform-specific screenshot commands
        if (process.platform === 'darwin') {
          execSync(`screencapture -x "${screenshotPath}"`);
        } else if (process.platform === 'win32') {
          // Windows - use PowerShell
          execSync(`powershell "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds | ForEach-Object { [System.Drawing.Bitmap]::new($_.Width, $_.Height) } | ForEach-Object { $graphics = [System.Drawing.Graphics]::FromImage($_); $graphics.CopyFromScreen(0, 0, 0, 0, $_.Size); $graphics.Dispose(); $_.Save('${screenshotPath}', [System.Drawing.Imaging.ImageFormat]::Png); $_.Dispose() }"`);
        } else {
          // Linux - try different screenshot tools
          try {
            execSync(`gnome-screenshot -f "${screenshotPath}"`);
          } catch (gnomeError) {
            try {
              execSync(`scrot "${screenshotPath}"`);
            } catch (scrotError) {
              try {
                execSync(`import -window root "${screenshotPath}"`);
              } catch (importError) {
                throw new Error('No screenshot tool found. Please install gnome-screenshot, scrot, or imagemagick');
              }
            }
          }
        }
        
        // Check if Tesseract is available
        try {
          execSync('tesseract --version', { stdio: 'ignore' });
          
          // Run OCR on the screenshot
          const ocrOutputPath = screenshotPath.replace('.png', '.txt');
          execSync(`tesseract "${screenshotPath}" "${ocrOutputPath.replace('.txt', '')}" -l eng`);
          
          // Read OCR results
          if (fs.existsSync(ocrOutputPath)) {
            const ocrText = fs.readFileSync(ocrOutputPath, 'utf8').trim();
            context.ocrText = ocrText || 'No text detected in screenshot';
            context.ocrStatus = 'success';
            
            // Clean up temporary files
            fs.unlinkSync(ocrOutputPath);
          } else {
            context.ocrText = 'OCR processing failed - no output file generated';
            context.ocrStatus = 'failed';
          }
          
          // Clean up screenshot
          if (fs.existsSync(screenshotPath)) {
            fs.unlinkSync(screenshotPath);
          }
          
        } catch (tesseractError) {
          context.ocrText = 'OCR not available - Tesseract not installed';
          context.ocrStatus = 'unavailable';
          context.ocrNote = 'Install Tesseract OCR: sudo apt install tesseract-ocr (Linux) or brew install tesseract (macOS)';
          
          // Clean up screenshot if it exists
          if (fs.existsSync(screenshotPath)) {
            fs.unlinkSync(screenshotPath);
          }
        }
        
      } catch (ocrError) {
        console.error('OCR processing failed:', ocrError);
        context.ocrText = `OCR failed: ${ocrError.message}`;
        context.ocrStatus = 'error';
      }
    }

    // Store screen context for future reference
    await storeScreenContext(context);

    return context;
  } catch (error) {
    console.error('Error getting screen context:', error);
    return { 
      error: error.message,
      timestamp: new Date().toISOString(),
      platform: process.platform 
    };
  }
}

// Helper function to store screen context
async function storeScreenContext(context) {
  return new Promise((resolve, reject) => {
    const stmt = conversationDb.prepare(`
      INSERT INTO screen_contexts (
        timestamp, platform, active_application, active_window_title, 
        display_server, process_name, ocr_text, ocr_status, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      context.timestamp,
      context.platform,
      context.activeApplication || null,
      context.activeWindowTitle || null,
      context.displayServer || null,
      context.processName || null,
      context.ocrText || null,
      context.ocrStatus || null,
      context.note || null
    ], function(err) {
      if (err) {
        console.error('Error storing screen context:', err);
        reject(err);
      } else {
        console.log(`📱 Screen context stored with ID: ${this.lastID}`);
        resolve(this.lastID);
      }
    });
    
    stmt.finalize();
  });
}

// Helper function for enhanced content generation with screen context
async function generateEnhancedTypingContentWithContext(content_type, context_hint, tone, length, conversationContext, screenContext) {
  // Enhanced template-based generation with screen context awareness
  let content = '';
  
  const toneMap = {
    'enthusiastic': { adjective: 'incredible', emoji: '🚀', energy: 'high' },
    'professional': { adjective: 'significant', emoji: '📊', energy: 'formal' },
    'casual': { adjective: 'cool', emoji: '💫', energy: 'relaxed' },
    'friendly': { adjective: 'interesting', emoji: '✨', energy: 'warm' }
  };
  
  const currentTone = toneMap[tone] || toneMap['friendly'];
  const activeApp = screenContext.activeApplication || 'Unknown';
  const ocrText = screenContext.ocrText || '';
  
  // Application-specific content generation
  const isCodeEditor = activeApp === 'Cursor' || activeApp === 'code' || activeApp.toLowerCase().includes('vscode');
  const isEmailClient = activeApp.toLowerCase().includes('mail') || activeApp.toLowerCase().includes('gmail') || activeApp.toLowerCase().includes('outlook');
  const isChatApp = activeApp.toLowerCase().includes('slack') || activeApp.toLowerCase().includes('discord') || activeApp.toLowerCase().includes('teams');
  const isTwitter = activeApp.toLowerCase().includes('twitter') || activeApp.toLowerCase().includes('x.com');
  const isBrowser = activeApp.toLowerCase().includes('browser') || activeApp.toLowerCase().includes('firefox') || activeApp.toLowerCase().includes('chrome');
  
  switch (content_type) {
    case 'tweet':
      if (isTwitter) {
        content = `${context_hint || 'This'} is truly ${currentTone.adjective}! ${currentTone.emoji} ${
          tone === 'enthusiastic' ? 'Twitter/X is the perfect place to share this excitement!' : 
          tone === 'professional' ? 'Sharing insights on the platform where ideas spread fast.' :
          'Love discussing this on X!'
        } #Innovation #Twitter`;
      } else {
        content = `${context_hint || 'This'} is ${currentTone.adjective}! ${currentTone.emoji} ${
          context_hint?.toLowerCase().includes('steve jobs') ? 'Revolutionary thinking that changed everything! 🍎 #SteveJobs #Innovation' :
          context_hint?.toLowerCase().includes('ai') ? 'The future is being written right now! 🤖 #AI #Innovation' :
          'Worth sharing with the world! #Innovation #Progress'
        }`;
      }
      break;
      
    case 'email':
      if (isEmailClient) {
        const greeting = tone === 'professional' ? 'I hope this email finds you well.' : 'Hope you\'re doing great!';
        const closing = tone === 'professional' ? 'Best regards' : tone === 'casual' ? 'Cheers!' : 'Best';
        content = `Subject: ${context_hint ? `Re: ${context_hint}` : 'Follow-up'}\n\nHi there,\n\n${greeting} ${context_hint ? `Regarding ${context_hint}, I` : 'I'} wanted to share some thoughts and follow up on our discussion.\n\n${closing}`;
      } else {
        content = `Hi,\n\n${context_hint ? `About ${context_hint}, I` : 'I'} wanted to follow up.\n\nBest regards`;
      }
      break;
      
    case 'code_comment':
      if (isCodeEditor) {
        content = `// ${context_hint ? `${context_hint} - ` : ''}${currentTone.adjective} functionality\n// TODO: Implement proper error handling and validation`;
      } else {
        content = `/* ${context_hint || 'Function description'} */`;
      }
      break;
      
    case 'response':
      if (isChatApp) {
        content = `${currentTone.emoji} Thanks for sharing! ${context_hint ? `The point about ${context_hint} is particularly ${currentTone.adjective}.` : 'Really appreciate the insight.'} Let's discuss this further!`;
      } else if (ocrText && ocrText.length > 10) {
        // Use OCR context for more relevant responses
        const ocrKeywords = ocrText.split(' ').slice(0, 5).join(' ');
        content = `Thanks for that! ${context_hint ? `The ${context_hint}` : `What you mentioned about ${ocrKeywords}`} is really ${currentTone.adjective}. ${currentTone.emoji}`;
      } else {
        content = `Thanks for sharing that! ${context_hint ? `The point about ${context_hint} is particularly ${currentTone.adjective}.` : 'Really appreciate the insight.'} ${currentTone.emoji}`;
      }
      break;
      
    case 'summary':
      content = `## Summary\n\n${context_hint ? `Key points about ${context_hint}:` : 'Main takeaways:'}\n\n• ${currentTone.adjective.charAt(0).toUpperCase() + currentTone.adjective.slice(1)} insights from our discussion\n• Worth exploring further\n• ${currentTone.emoji} Exciting potential ahead`;
      break;
      
    case 'casual_message':
      if (isChatApp) {
        content = `Hey! ${context_hint || 'Just wanted to check in'} ${currentTone.emoji} ${
          tone === 'enthusiastic' ? 'This is so exciting!' : 
          tone === 'friendly' ? 'Hope all is well!' :
          'Let me know what you think!'
        }`;
      } else {
        content = `${context_hint || 'Just a quick note'} ${currentTone.emoji}`;
      }
      break;
      
    case 'formal_document':
      content = `${context_hint ? context_hint : 'Introduction'}\n\nThis document provides ${currentTone.adjective} insights into the topic under discussion. ${
        tone === 'professional' ? 'The analysis presented herein demonstrates significant value.' :
        'The following points outline key considerations.'
      }\n\n1. Key Findings\n2. Recommendations\n3. Conclusion`;
      break;
      
    default:
      // Context-aware default generation
      if (ocrText && ocrText.length > 20) {
        const relevantContext = ocrText.substring(0, 100);
        content = `Regarding ${context_hint || 'what we discussed'}, and considering the current context: "${relevantContext}..." - this is ${currentTone.adjective}! ${currentTone.emoji}`;
      } else {
        content = `${context_hint || 'Generated content'} with ${tone || 'friendly'} tone for ${activeApp}. ${currentTone.emoji}`;
      }
  }
  
  // Adjust length while maintaining application context
  if (length === 'short' && content.length > 150) {
    content = content.substring(0, 147) + '...';
  } else if (length === 'long' && content.length < 200) {
    content += `\n\n${isCodeEditor ? '// ' : ''}This ${content_type} was generated with ${tone} tone for ${activeApp}, incorporating context about ${context_hint || 'the current discussion'}.`;
  }
  
  return content;
}

// Proxy to Python tool opener service
app.post('/api/open-tool', async (req, res) => {
    try {
        const response = await axios.post('http://localhost:5005/api/open-tool', req.body);
        res.json(response.data);
    } catch (error) {
        console.error('Error proxying to tool opener:', error.message);
        res.status(500).json({ error: 'Failed to open tool', details: error.message });
    }
});

// Start server
const server = app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
        console.log('HTTP server closed.');
        // Add any other cleanup here (e.g., database connections)
        process.exit(0);
    });

    // Force shutdown if server hasn't closed in time
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000); // 10 seconds
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); 