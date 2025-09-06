const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

// Helper: Split array into chunks of specified size
function chunkArray(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

// Helper: Create Notion page with batching for >100 blocks
async function createNotionPageWithBatching({ parent, properties, children, notionConfig }) {
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


async function generateAndCreateNotionPage({ query, notionParentId, contentType, textFormatter, notionConfig }) {
    if (!query || !notionParentId || !contentType || !textFormatter || !notionConfig) {
        throw new Error("Missing required arguments for content generation.");
    }
    
    console.log(`Starting Enhanced Content generation for: ${query}`);

    const contentResult = await new Promise((resolve, reject) => {
        const pythonPath = path.join(__dirname, '../venv/bin/python');
        const scriptPath = path.join(__dirname, '../enhanced_content_generator.py');
        
        const env = { ...process.env };
        
        const pythonProcess = spawn(pythonPath, [scriptPath, query, contentType], {
            env: env,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log('Python [stdout]:', data.toString().trim());
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error('Python [stderr]:', data.toString().trim());
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Enhanced content generator script exited with code ${code}: ${stderr}`));
            }
            const outputLines = stdout.trim().split('\n').filter(line => line.trim() !== '');
            if (outputLines.length === 0) {
                return reject(new Error('No output from enhanced content generator'));
            }
            const lastLineOutput = outputLines[outputLines.length - 1];
            try {
                const result = JSON.parse(lastLineOutput);
                return resolve(result);
            } catch (parseError) {
                return reject(new Error('Failed to parse enhanced content generator result as JSON'));
            }
        });

        pythonProcess.on('error', (error) => reject(error));
    });

    if (!contentResult.success) {
        throw new Error(contentResult.error || 'Enhanced content generation script failed.');
    }

    console.log('Creating enhanced Notion page...');
    const capitalizedQuery = query.charAt(0).toUpperCase() + query.slice(1);
    const notionPageTitle = contentResult.content.title || (capitalizedQuery.length > 50 ? `${capitalizedQuery.substring(0, 50)}...` : capitalizedQuery);
    
    const blocks = await textFormatter.convertMarkdownToNotionBlocks(contentResult.content.body);
    const validatedBlocks = textFormatter.validateNotionBlocks(blocks);
    
    if (validatedBlocks.length === 0) {
        throw new Error('No valid blocks could be generated from the content.');
    }

    const notionApiResponse = await createNotionPageWithBatching({
        parent: { page_id: notionParentId },
        properties: {
            title: [{ text: { content: notionPageTitle } }]
        },
        children: validatedBlocks,
        notionConfig
    });

    return {
        success: true,
        notionPageId: notionApiResponse.pageId,
        notionPageUrl: notionApiResponse.url,
        title: notionPageTitle,
        contentMetadata: contentResult.metadata,
        message: `Enhanced ${contentType} content created successfully in Notion.`
    };
}

async function generateAndUpdateNotionPage({ pageId, query, contentType, textFormatter, notionConfig, updateMode = 'append' }) {
    if (!pageId || !query || !contentType || !textFormatter || !notionConfig) {
        throw new Error("Missing required arguments for enhanced page update.");
    }
    
    console.log(`Starting Enhanced Content update for page: ${pageId}, query: ${query}`);

    // Generate new content using Gemini 1.5 Pro
    const contentResult = await new Promise((resolve, reject) => {
        const pythonPath = path.join(__dirname, '../venv/bin/python');
        const scriptPath = path.join(__dirname, '../enhanced_content_generator.py');
        
        const env = { ...process.env };
        
        const pythonProcess = spawn(pythonPath, [scriptPath, query, contentType], {
            env: env,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log('Python [stdout]:', data.toString().trim());
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error('Python [stderr]:', data.toString().trim());
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Enhanced content generator script exited with code ${code}: ${stderr}`));
            }
            const outputLines = stdout.trim().split('\n').filter(line => line.trim() !== '');
            if (outputLines.length === 0) {
                return reject(new Error('No output from enhanced content generator'));
            }
            const lastLineOutput = outputLines[outputLines.length - 1];
            try {
                const result = JSON.parse(lastLineOutput);
                return resolve(result);
            } catch (parseError) {
                return reject(new Error('Failed to parse enhanced content generator result as JSON'));
            }
        });

        pythonProcess.on('error', (error) => reject(error));
    });

    if (!contentResult.success) {
        throw new Error(contentResult.error || 'Enhanced content generation script failed.');
    }

    console.log('Updating Notion page with enhanced content...');
    
    // Convert the generated content to Notion blocks
    const blocks = await textFormatter.convertMarkdownToNotionBlocks(contentResult.content.body);
    const validatedBlocks = textFormatter.validateNotionBlocks(blocks);
    
    if (validatedBlocks.length === 0) {
        throw new Error('No valid blocks could be generated from the content.');
    }

    // Update the page based on the mode
    if (updateMode === 'replace') {
        // Get existing blocks and replace them
        const existingBlocksResponse = await axios.get(
            `${notionConfig.baseURL}/blocks/${pageId}/children?page_size=100`,
            { headers: notionConfig.headers }
        );

        // Delete existing blocks (in reverse order to avoid conflicts)
        const existingBlocks = existingBlocksResponse.data.results;
        console.log(`🗑️ Deleting ${existingBlocks.length} existing blocks`);
        for (let i = existingBlocks.length - 1; i >= 0; i--) {
            await axios.delete(
                `${notionConfig.baseURL}/blocks/${existingBlocks[i].id}`,
                { headers: notionConfig.headers }
            );
        }
    }

    // Add new content in batches
    const blockChunks = chunkArray(validatedBlocks, 100);
    console.log(`📊 Adding ${validatedBlocks.length} blocks in ${blockChunks.length} batches`);

    for (let i = 0; i < blockChunks.length; i++) {
        console.log(`📝 Adding batch ${i + 1}/${blockChunks.length} (${blockChunks[i].length} blocks)`);
        await axios.patch(
            `${notionConfig.baseURL}/blocks/${pageId}/children`,
            { children: blockChunks[i] },
            { headers: notionConfig.headers }
        );
        console.log(`✅ Added batch ${i + 1} successfully`);
    }

    // Get the updated page URL
    const pageResponse = await axios.get(
        `${notionConfig.baseURL}/pages/${pageId}`,
        { headers: notionConfig.headers }
    );

    return {
        success: true,
        notionPageId: pageId,
        notionPageUrl: pageResponse.data.url,
        contentMetadata: contentResult.metadata,
        updateMode: updateMode,
        blocksAdded: validatedBlocks.length,
        message: `Enhanced ${contentType} content ${updateMode === 'replace' ? 'replaced' : 'appended'} successfully in Notion.`
    };
}

module.exports = {
  generateAndCreateNotionPage,
  generateAndUpdateNotionPage,
  // Alias generateEnhancedContent to the main function for compatibility
  generateEnhancedContent: generateAndCreateNotionPage 
}; 