const { richTextFromMarkdown } = require('@contentful/rich-text-from-markdown');
const { BLOCKS, INLINES, MARKS } = require('@contentful/rich-text-types');
const MarkdownIt = require('markdown-it');

class NotionTextFormatter {
    constructor() {
        this.md = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true,
            breaks: true
        });
    }

    /**
     * Convert Contentful Rich Text to Notion blocks
     * @param {Object} richTextDocument - Contentful rich text document
     * @returns {Array} Array of Notion block objects
     */
    richTextToNotionBlocks(richTextDocument) {
        const blocks = [];
        
        if (!richTextDocument || !richTextDocument.content) {
            return blocks;
        }

        for (const node of richTextDocument.content) {
            const notionBlock = this.convertRichTextNodeToNotionBlock(node);
            if (notionBlock) {
                if (Array.isArray(notionBlock)) {
                    blocks.push(...notionBlock);
                } else {
                    blocks.push(notionBlock);
                }
            }
        }

        return blocks;
    }

    /**
     * Convert a single rich text node to Notion block
     * @param {Object} node - Rich text node
     * @returns {Object|Array} Notion block or array of blocks
     */
    convertRichTextNodeToNotionBlock(node) {
        switch (node.nodeType) {
            case BLOCKS.PARAGRAPH:
                const richText = this.convertRichTextToNotionRichText(node.content);
                // Check if content is too long and split if necessary
                return this.createValidatedParagraphBlocks(richText);

            case BLOCKS.HEADING_1:
                return {
                    object: 'block',
                    type: 'heading_1',
                    heading_1: {
                        rich_text: this.convertRichTextToNotionRichText(node.content)
                    }
                };

            case BLOCKS.HEADING_2:
                return {
                    object: 'block',
                    type: 'heading_2',
                    heading_2: {
                        rich_text: this.convertRichTextToNotionRichText(node.content)
                    }
                };

            case BLOCKS.HEADING_3:
            case 'heading-4':
            case 'heading-5':
            case 'heading-6':
                // Notion only supports H1-H3, convert H4-H6 to H3
                return {
                    object: 'block',
                    type: 'heading_3',
                    heading_3: {
                        rich_text: this.convertRichTextToNotionRichText(node.content)
                    }
                };

            case BLOCKS.UL_LIST:
                return this.convertListToNotionBlocks(node, 'bulleted_list_item');

            case BLOCKS.OL_LIST:
                return this.convertListToNotionBlocks(node, 'numbered_list_item');

            case BLOCKS.QUOTE:
                return {
                    object: 'block',
                    type: 'quote',
                    quote: {
                        rich_text: this.convertRichTextToNotionRichText(node.content)
                    }
                };

            case BLOCKS.HR:
                return {
                    object: 'block',
                    type: 'divider',
                    divider: {}
                };

            default:
                console.warn('⚠️ Unsupported rich text node type:', node.nodeType);
                return null;
        }
    }

    /**
     * Convert rich text list to Notion list blocks
     * @param {Object} listNode - Rich text list node
     * @param {string} listType - Notion list type
     * @returns {Array} Array of Notion list item blocks
     */
    convertListToNotionBlocks(listNode, listType) {
        const blocks = [];
        
        if (listNode.content) {
            for (const listItem of listNode.content) {
                if (listItem.nodeType === BLOCKS.LIST_ITEM && listItem.content) {
                    // Convert list item content (usually paragraphs)
                    const itemContent = [];
                    for (const itemNode of listItem.content) {
                        if (itemNode.nodeType === BLOCKS.PARAGRAPH) {
                            itemContent.push(...this.convertRichTextToNotionRichText(itemNode.content));
                        }
                    }
                    
                    if (itemContent.length > 0) {
                        blocks.push({
                            object: 'block',
                            type: listType,
                            [listType]: {
                                rich_text: itemContent
                            }
                        });
                    }
                }
            }
        }
        
        return blocks;
    }

    /**
     * Validate if a string is a valid URL
     * @param {string} url - URL string to validate
     * @returns {boolean} True if valid URL
     */
    isValidUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    /**
     * Clean and validate URLs, replacing invalid ones with null
     * @param {string} url - URL to clean
     * @returns {string|null} Valid URL or null
     */
    cleanUrl(url) {
        if (!url || typeof url !== 'string') return null;
        
        // Skip obviously invalid URLs
        if (url.includes('url_to_') || url.length < 7) return null;
        
        // If it doesn't start with http/https, try adding https
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        return this.isValidUrl(url) ? url : null;
    }

    /**
     * Convert rich text content to Notion rich text format
     * @param {Array} content - Array of rich text nodes
     * @returns {Array} Array of Notion rich text objects
     */
    convertRichTextToNotionRichText(content) {
        const notionRichText = [];
        
        if (!content || !Array.isArray(content)) {
            return notionRichText;
        }

        for (const node of content) {
            if (node.nodeType === 'text') {
                notionRichText.push({
                    type: 'text',
                    text: {
                        content: node.value || '',
                        link: null
                    },
                    annotations: this.extractMarksFromNode(node),
                    plain_text: node.value || '',
                    href: null
                });
            } else if (node.nodeType === INLINES.HYPERLINK) {
                const linkText = this.extractTextFromNode(node);
                const cleanedUrl = this.cleanUrl(node.data?.uri);
                
                notionRichText.push({
                    type: 'text',
                    text: {
                        content: linkText,
                        link: cleanedUrl ? { url: cleanedUrl } : null
                    },
                    annotations: this.extractMarksFromNode(node),
                    plain_text: linkText,
                    href: cleanedUrl
                });
            }
        }

        return notionRichText;
    }

    /**
     * Extract text content from a rich text node
     * @param {Object} node - Rich text node
     * @returns {string} Extracted text
     */
    extractTextFromNode(node) {
        if (node.nodeType === 'text') {
            return node.value || '';
        }
        
        if (node.content && Array.isArray(node.content)) {
            return node.content.map(child => this.extractTextFromNode(child)).join('');
        }
        
        return '';
    }

    /**
     * Extract formatting marks from a rich text node
     * @param {Object} node - Rich text node
     * @returns {Object} Notion annotations object
     */
    extractMarksFromNode(node) {
        const annotations = {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: 'default'
        };

        if (node.marks && Array.isArray(node.marks)) {
            for (const mark of node.marks) {
                switch (mark.type) {
                    case MARKS.BOLD:
                        annotations.bold = true;
                        break;
                    case MARKS.ITALIC:
                        annotations.italic = true;
                        break;
                    case MARKS.CODE:
                        annotations.code = true;
                        break;
                    case MARKS.UNDERLINE:
                        annotations.underline = true;
                        break;
                }
            }
        }

        return annotations;
    }

    /**
     * Convert markdown text to properly formatted Notion blocks using enhanced conversion
     * @param {string} markdownText - The markdown text to convert
     * @returns {Array} Array of Notion block objects
     */
    async convertMarkdownToNotionBlocks(markdownText) {
        try {
            // First try using Contentful's rich text library
            const richTextDocument = await richTextFromMarkdown(markdownText);
            const notionBlocks = this.richTextToNotionBlocks(richTextDocument);
            
            // Validate blocks and check for length violations
            const preValidationLength = notionBlocks.length;
            const validatedBlocks = this.validateNotionBlocks(notionBlocks);
            
            // If we lost blocks due to validation (likely length issues), use fallback
            if (validatedBlocks.length < preValidationLength) {
                console.warn(`⚠️ Lost ${preValidationLength - validatedBlocks.length} blocks in validation, using fallback conversion`);
                return this.fallbackBasicConversion(markdownText);
            }
            
            console.log(`✅ Converted ${markdownText.length} characters to ${validatedBlocks.length} Notion blocks using rich text library`);
            return validatedBlocks;
        } catch (error) {
            console.warn('⚠️ Contentful rich text conversion failed, using fallback:', error.message);
            // Fallback to basic conversion if library fails
            return this.fallbackBasicConversion(markdownText);
        }
    }

    /**
     * Preprocess content to clean up formatting issues and malformed markdown
     * @param {string} content - Content to preprocess
     * @returns {string} Cleaned content
     */
    preprocessContent(content) {
        if (!content || typeof content !== 'string') {
            console.warn('⚠️ Invalid content provided to preprocessContent');
            return '';
        }

        let processedContent = content;

        // Clean up malformed and empty headings
        processedContent = processedContent
            // Remove lines that are just hash characters with optional whitespace
            .replace(/^#{1,6}\s*$/gm, '')
            // Fix malformed headings with extra # characters (like "###### # Mate Choice")
            .replace(/^(#{1,6})\s*#+\s*/gm, '$1 ')
            // Fix multiple hash characters anywhere in heading content
            .replace(/^(#{1,6})\s+(.+)/gm, (match, hashes, content) => {
                // Clean any additional # characters from the content and extra whitespace
                const cleanContent = content.replace(/^#+\s*/, '').replace(/\s*#+\s*/, ' ').trim();
                return cleanContent ? `${hashes} ${cleanContent}` : '';
            })
            // Convert H4+ to H3 and clean content
            .replace(/^#{4,6}\s+(.+)/gm, '### $1')
            // Remove lines that contain only hash characters after processing
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                // Filter out lines that are just hash characters or just whitespace
                return trimmed !== '' && !trimmed.match(/^#{1,6}$/) && !trimmed.match(/^#+\s*$/);
            })
            .join('\n')
            // Fix multiple newlines
            .replace(/\n{3,}/g, '\n\n')
            // Fix spacing around headers (ensure single space after #)
            .replace(/^(#{1,3})\s+/gm, '$1 ')
            // Fix list formatting - ensure proper numbered list format
            .replace(/^(\d+)\.\s+/gm, '$1. ')
            // Fix bulleted list formatting
            .replace(/^(\s*)-\s+/gm, '$1- ')
            // Fix bold and italic formatting
            .replace(/\*\*([^*]+)\*\*/g, '**$1**')
            .replace(/\*([^*]+)\*/g, '*$1*')
            // Fix code blocks
            .replace(/```(\w+)?\n/g, '```$1\n')
            // Fix inline code
            .replace(/`([^`]+)`/g, '`$1`')
            // Remove excessive whitespace
            .replace(/[ \t]+$/gm, '')
            // Remove completely empty lines that result from cleaning
            .replace(/^\s*$/gm, '')
            // Fix multiple empty lines again after cleaning
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        return processedContent;
    }

    /**
     * Convert deep heading markdown to bold bullet points for better Notion formatting
     * @param {string} content - Content with multiple heading levels
     * @returns {string} Content with improved hierarchy formatting
     */
    convertDeepHeadingsToHierarchy(content) {
        const lines = content.split('\n');
        const processedLines = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Convert H4, H5, H6 to bullet points with bold text
            if (trimmed.match(/^#{4,6}\s+/)) {
                const level = (trimmed.match(/^#+/) || [''])[0].length;
                const text = trimmed.replace(/^#+\s+/, '');
                
                // Create indentation based on heading level
                const indent = '  '.repeat(Math.max(0, level - 4)); // H4=0 indent, H5=2 spaces, H6=4 spaces
                const bulletPoint = `${indent}- **${text}**`;
                processedLines.push(bulletPoint);
            } else {
                processedLines.push(line);
            }
        }
        
        return processedLines.join('\n');
    }

    /**
     * Format STORM research content for Notion
     * @param {Object} stormResult - STORM research result object
     * @param {string} query - Original research query
     * @returns {Array} Array of Notion blocks
     */
    async formatStormContentForNotion(stormResult, query) {
        console.log('🔧 Formatting STORM content for Notion...');
        
        let notionContent = '';
        
        // Add research overview if available (without heading)
        if (stormResult.overview) {
            notionContent += `${stormResult.overview}\n\n`;
        }

        // Add main article content - with improved hierarchy formatting (without heading)
        if (stormResult.article) {
            const improvedArticle = this.convertDeepHeadingsToHierarchy(stormResult.article);
            notionContent += `${improvedArticle}\n\n`;
        }

        // Preprocess and use fallback conversion for better control over STORM formatting
        const preprocessedContent = this.preprocessContent(notionContent);
        console.log('🔧 Using fallback conversion for STORM content to ensure proper formatting');
        return this.fallbackBasicConversion(preprocessedContent);
    }

    /**
     * Split long text content into chunks that fit Notion's limits
     * @param {string} text - Text to split
     * @param {number} maxLength - Maximum length per chunk (default 2000)
     * @returns {Array<string>} Array of text chunks
     */
    splitLongText(text, maxLength = 2000) {
        if (!text || text.length <= maxLength) {
            return [text];
        }

        const chunks = [];
        let remaining = text;

        while (remaining.length > maxLength) {
            // Find a good break point (preferably at sentence or word boundary)
            let breakPoint = maxLength;
            
            // Try to break at sentence end
            const sentenceEnd = remaining.lastIndexOf('.', maxLength);
            if (sentenceEnd > maxLength * 0.7) { // Don't break too early
                breakPoint = sentenceEnd + 1;
            } else {
                // Try to break at word boundary
                const wordEnd = remaining.lastIndexOf(' ', maxLength);
                if (wordEnd > maxLength * 0.7) {
                    breakPoint = wordEnd;
                }
            }

            chunks.push(remaining.substring(0, breakPoint).trim());
            remaining = remaining.substring(breakPoint).trim();
        }

        if (remaining.length > 0) {
            chunks.push(remaining);
        }

        return chunks.filter(chunk => chunk.length > 0);
    }

    /**
     * Parse markdown link format [text](url) into rich text object with length validation
     * @param {string} text - Text that may contain markdown links
     * @returns {Array} Array of rich text objects
     */
    parseMarkdownLinks(text) {
        // First split long text into manageable chunks
        const textChunks = this.splitLongText(text, 1800); // Leave some buffer for link formatting
        const allRichTextParts = [];

        for (const chunk of textChunks) {
            const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
            const richTextParts = [];
            let lastIndex = 0;
            let match;

            while ((match = linkRegex.exec(chunk)) !== null) {
                // Add text before the link
                if (match.index > lastIndex) {
                    const beforeText = chunk.substring(lastIndex, match.index);
                    if (beforeText) {
                        richTextParts.push({
                            type: 'text',
                            text: { content: beforeText }
                        });
                    }
                }

                // Add the link
                const linkText = match[1];
                const linkUrl = this.cleanUrl(match[2]);
                
                if (linkUrl) {
                    richTextParts.push({
                        type: 'text',
                        text: { 
                            content: linkText,
                            link: { url: linkUrl }
                        }
                    });
                } else {
                    // If URL is invalid, just add as plain text
                    richTextParts.push({
                        type: 'text',
                        text: { content: linkText }
                    });
                }

                lastIndex = linkRegex.lastIndex;
            }

            // Add any remaining text after the last link
            if (lastIndex < chunk.length) {
                const remainingText = chunk.substring(lastIndex);
                if (remainingText) {
                    richTextParts.push({
                        type: 'text',
                        text: { content: remainingText }
                    });
                }
            }

            // If no links were found in this chunk, return the original text
            if (richTextParts.length === 0) {
                richTextParts.push({
                    type: 'text',
                    text: { content: chunk }
                });
            }

            allRichTextParts.push(...richTextParts);
        }

        return allRichTextParts.length > 0 ? allRichTextParts : [{
            type: 'text',
            text: { content: text }
        }];
    }

    /**
     * Create paragraph blocks from rich text, splitting if necessary
     * @param {Array} richTextParts - Array of rich text objects
     * @returns {Array} Array of paragraph block objects
     */
    createParagraphBlocks(richTextParts) {
        const blocks = [];
        let currentBlock = [];
        let currentLength = 0;

        for (const part of richTextParts) {
            let content = part.text.content;
            // If this part is too long, split it into multiple parts
            while (content.length > 2000) {
                const chunk = content.substring(0, 2000);
                const splitPart = {
                    ...part,
                    text: { ...part.text, content: chunk }
                };
                currentBlock.push(splitPart);
                currentLength += chunk.length;
                // If adding this chunk would exceed the block limit, start a new block
                if (currentLength >= 1900) {
                    blocks.push({
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: currentBlock
                        }
                    });
                    currentBlock = [];
                    currentLength = 0;
                }
                content = content.substring(2000);
            }
            // Add the remaining part (if any)
            if (content.length > 0) {
                const splitPart = {
                    ...part,
                    text: { ...part.text, content }
                };
                // If adding this part would exceed the limit, start a new block
                if (currentLength + content.length > 1900 && currentBlock.length > 0) {
                    blocks.push({
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: currentBlock
                        }
                    });
                    currentBlock = [];
                    currentLength = 0;
                }
                currentBlock.push(splitPart);
                currentLength += content.length;
            }
        }

        // Add the final block if there's content
        if (currentBlock.length > 0) {
            blocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: currentBlock
                }
            });
        }

        return blocks;
    }

    /**
     * Create validated paragraph blocks, splitting if content is too long
     * @param {Array} richTextParts - Array of rich text objects
     * @returns {Object|Array} Single paragraph block or array of paragraph blocks
     */
    createValidatedParagraphBlocks(richTextParts) {
        if (!richTextParts || richTextParts.length === 0) {
            return {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: []
                }
            };
        }

        // Calculate total content length
        const totalLength = richTextParts.reduce((sum, part) => {
            return sum + (part.text?.content?.length || 0);
        }, 0);

        // If content is within limits, return single block
        if (totalLength <= 1900) { // Leave buffer for safety
            return {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: richTextParts
                }
            };
        }

        // Content is too long, split into multiple paragraph blocks
        console.warn(`⚠️ Paragraph content too long (${totalLength} chars), splitting into multiple blocks`);
        return this.createParagraphBlocks(richTextParts);
    }

    /**
     * Fallback conversion method if main library fails
     * @param {string} markdownText - Markdown text to convert
     * @returns {Array} Basic Notion blocks
     */
    fallbackBasicConversion(markdownText) {
        console.warn('⚠️ Using fallback basic conversion');
        
        const lines = markdownText.split('\n');
        const blocks = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Skip empty lines and lines that are just hash characters
            if (trimmedLine === '' || trimmedLine.match(/^#+\s*$/)) {
                continue;
            }
            
            // Check for headings with improved validation
            const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                const hashCount = headingMatch[1].length;
                let headingContent = headingMatch[2].trim();
                
                // Clean any remaining hash characters from heading content
                headingContent = headingContent.replace(/^#+\s*/, '').replace(/\s*#+\s*/, ' ').trim();
                
                // Skip if heading content is empty or contains only hash characters after cleaning
                if (!headingContent || headingContent.match(/^#+\s*$/)) {
                    console.warn('⚠️ Skipping empty or malformed heading:', trimmedLine);
                    continue;
                }
                
                // Determine Notion heading type (H1-H3 only)
                let headingType = 'heading_3'; // Default to H3 for H4+
                if (hashCount === 1) headingType = 'heading_1';
                else if (hashCount === 2) headingType = 'heading_2';
                else if (hashCount === 3) headingType = 'heading_3';
                
                blocks.push({
                    object: 'block',
                    type: headingType,
                    [headingType]: {
                        rich_text: this.parseMarkdownLinks(headingContent)
                    }
                });
                continue;
            }
            
            // Handle bulleted lists
            if (trimmedLine.startsWith('- ')) {
                const content = trimmedLine.substring(2).trim();
                if (content) { // Only add if there's actual content
                    blocks.push({
                        object: 'block',
                        type: 'bulleted_list_item',
                        bulleted_list_item: {
                            rich_text: this.parseMarkdownLinks(content)
                        }
                    });
                }
                continue;
            }
            
            // Handle numbered lists
            const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
            if (numberedMatch) {
                const content = numberedMatch[2].trim();
                if (content) { // Only add if there's actual content
                    blocks.push({
                        object: 'block',
                        type: 'numbered_list_item',
                        numbered_list_item: {
                            rich_text: this.parseMarkdownLinks(content)
                        }
                    });
                }
                continue;
            }
            
            // Handle horizontal rule
            if (trimmedLine === '---') {
                blocks.push({
                    object: 'block',
                    type: 'divider',
                    divider: {}
                });
                continue;
            }
            
            // Handle regular paragraphs - but skip lines that look like malformed markdown
            if (trimmedLine.length > 0 && !trimmedLine.match(/^#+(\s+.*)?$/)) {
                const richTextParts = this.parseMarkdownLinks(trimmedLine);
                // Only create paragraph if there's actual content
                if (richTextParts.length > 0 && richTextParts.some(part => part.text?.content?.trim())) {
                    const paragraphBlocks = this.createValidatedParagraphBlocks(richTextParts);
                    // Ensure we always get an array
                    if (Array.isArray(paragraphBlocks)) {
                        blocks.push(...paragraphBlocks);
                    } else {
                        blocks.push(paragraphBlocks);
                    }
                }
            }
        }
        
        console.log(`✅ Fallback conversion created ${blocks.length} blocks`);
        return blocks;
    }

    /**
     * Convert plain text to Notion blocks with minimal formatting
     * @param {string} textContent - Plain text content
     * @returns {Array} Array of Notion blocks
     */
    async convertPlainTextToNotionBlocks(textContent) {
        const processedContent = this.preprocessContent(textContent);
        return await this.convertMarkdownToNotionBlocks(processedContent);
    }

    /**
     * Validate Notion blocks before sending to API
     * @param {Array} blocks - Array of Notion blocks
     * @returns {Array} Validated and cleaned blocks
     */
    validateNotionBlocks(blocks) {
        if (!Array.isArray(blocks)) {
            console.error('❌ Blocks is not an array');
            return [];
        }

        const validBlocks = blocks.filter(block => {
            // Basic validation
            if (!block || typeof block !== 'object') {
                console.warn('⚠️ Invalid block object');
                return false;
            }

            if (!block.type || !block.object) {
                console.warn('⚠️ Block missing required type or object properties');
                return false;
            }

            // Skip divider blocks (they don't need content validation)
            if (block.type === 'divider') {
                return true;
            }

            // Check if block has content
            const blockTypeKey = block.type;
            if (block[blockTypeKey] && block[blockTypeKey].rich_text) {
                const richText = block[blockTypeKey].rich_text;
                
                // Ensure rich_text is an array
                if (!Array.isArray(richText)) {
                    console.warn('⚠️ Block rich_text is not an array');
                    return false;
                }
                
                // Check if there's actual text content
                const hasContent = richText.some(rt => 
                    rt.text && rt.text.content && rt.text.content.trim().length > 0
                );
                
                if (!hasContent) {
                    console.warn(`⚠️ Block type '${block.type}' has no meaningful content`);
                    return false;
                }

                // Special validation for headings - ensure they don't have malformed content
                if (block.type.startsWith('heading_')) {
                    const headingContent = richText.map(rt => rt.text?.content || '').join('').trim();
                    
                    // Skip headings that are empty or contain only hash characters
                    if (!headingContent || headingContent.match(/^#+\s*$/)) {
                        console.warn(`⚠️ Skipping malformed heading with content: "${headingContent}"`);
                        return false;
                    }
                }

                // Check for content length violations
                const lengthViolations = richText.filter(rt => 
                    rt.text && rt.text.content && rt.text.content.length > 2000
                );
                if (lengthViolations.length > 0) {
                    console.error(`❌ Block has content exceeding 2000 characters:`, lengthViolations.map(v => v.text.content.length));
                    return false;
                }
            }

            return true;
        });

        console.log(`✅ Validated ${validBlocks.length} out of ${blocks.length} blocks`);
        
        // Additional summary of any issues found
        const rejectedCount = blocks.length - validBlocks.length;
        if (rejectedCount > 0) {
            console.warn(`⚠️ Rejected ${rejectedCount} blocks due to validation issues`);
        }
        
        return validBlocks;
    }
}

module.exports = NotionTextFormatter; 