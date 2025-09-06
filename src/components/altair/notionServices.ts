import { DEFAULT_NOTION_PARENT_PAGE_ID } from './constants';
import { NotionPageResponse } from './types';

interface NotionRichText {
  type: 'text' | 'mention' | 'equation';
  text?: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
  plain_text?: string;
  href?: string | null;
}

interface NotionBlock {
  object: 'block';
  type: string;
  [key: string]: any;
}

function createRichText(content: string, annotations: Partial<NotionRichText['annotations']> = {}): NotionRichText {
  return {
    type: 'text',
    text: {
      content,
      link: null
    },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: 'default',
      ...annotations
    },
    plain_text: content,
    href: null
  };
}

function createParagraphBlock(text: string, annotations?: Partial<NotionRichText['annotations']>): NotionBlock {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [createRichText(text, annotations)]
    }
  };
}

function createHeadingBlock(text: string, level: 1 | 2 | 3, annotations?: Partial<NotionRichText['annotations']>): NotionBlock {
  return {
    object: 'block',
    type: `heading_${level}`,
    [`heading_${level}`]: {
      rich_text: [createRichText(text, annotations)]
    }
  };
}

function createBulletedListItem(text: string, annotations?: Partial<NotionRichText['annotations']>): NotionBlock {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [createRichText(text, annotations)]
    }
  };
}

function createNumberedListItem(text: string, annotations?: Partial<NotionRichText['annotations']>): NotionBlock {
  return {
    object: 'block',
    type: 'numbered_list_item',
    numbered_list_item: {
      rich_text: [createRichText(text, annotations)]
    }
  };
}

function createDividerBlock(): NotionBlock {
  return {
    object: 'block',
    type: 'divider',
    divider: {}
  };
}

function createCodeBlock(code: string, language: string = 'plain text'): NotionBlock {
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [createRichText(code)],
      language
    }
  };
}

function textToNotionBlocks(textContent: string): NotionBlock[] {
  const blocks: NotionBlock[] = [];
  const lines = textContent.split('\n');
  
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLanguage = 'plain text';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line === '') {
      blocks.push(createParagraphBlock(''));
      continue;
    }
    
    // Handle code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLanguage = line.slice(3).trim() || 'plain text';
        codeBlockContent = [];
      } else {
        inCodeBlock = false;
        blocks.push(createCodeBlock(codeBlockContent.join('\n'), codeBlockLanguage));
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(lines[i]);
      continue;
    }
    
    // Handle headings
    if (line.startsWith('# ')) {
      blocks.push(createHeadingBlock(line.slice(2), 1));
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(createHeadingBlock(line.slice(3), 2));
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(createHeadingBlock(line.slice(4), 3));
      continue;
    }
    
    // Handle bullet points
    if (line.startsWith('- ')) {
      blocks.push(createBulletedListItem(line.slice(2)));
      continue;
    }
    
    // Handle numbered lists
    if (/^\d+\.\s/.test(line)) {
      blocks.push(createNumberedListItem(line.replace(/^\d+\.\s/, '')));
      continue;
    }
    
    // Handle dividers
    if (line === '---' || line === '***' || line === '___') {
      blocks.push(createDividerBlock());
      continue;
    }
    
    // Handle bold text
    if (line.includes('**')) {
      const parts = line.split('**');
      const richTexts: NotionRichText[] = [];
      for (let j = 0; j < parts.length; j++) {
        if (j % 2 === 0) {
          richTexts.push(createRichText(parts[j]));
        } else {
          richTexts.push(createRichText(parts[j], { bold: true }));
        }
      }
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: richTexts }
      });
      continue;
    }
    
    // Handle italic text
    if (line.includes('*')) {
      const parts = line.split('*');
      const richTexts: NotionRichText[] = [];
      for (let j = 0; j < parts.length; j++) {
        if (j % 2 === 0) {
          richTexts.push(createRichText(parts[j]));
        } else {
          richTexts.push(createRichText(parts[j], { italic: true }));
        }
      }
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: richTexts }
      });
      continue;
    }
    
    // Handle inline code
    if (line.includes('`')) {
      const parts = line.split('`');
      const richTexts: NotionRichText[] = [];
      for (let j = 0; j < parts.length; j++) {
        if (j % 2 === 0) {
          richTexts.push(createRichText(parts[j]));
        } else {
          richTexts.push(createRichText(parts[j], { code: true }));
        }
      }
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: richTexts }
      });
      continue;
    }
    
    // Default to paragraph
    blocks.push(createParagraphBlock(line));
  }
  
  return blocks;
}

function notionBlocksToText(blocks: NotionBlock[]): string {
  let textContent = "";
  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        if (block.paragraph?.rich_text) {
          for (const rt of block.paragraph.rich_text) {
            if (rt.type === 'text' && rt.text?.content) {
              textContent += rt.text.content;
            }
          }
        }
        break;
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        const level = parseInt(block.type.split('_')[1]);
        const headingText = block[block.type]?.rich_text?.[0]?.text?.content || '';
        textContent += '#'.repeat(level) + ' ' + headingText;
        break;
      case 'bulleted_list_item':
        const bulletText = block.bulleted_list_item?.rich_text?.[0]?.text?.content || '';
        textContent += '- ' + bulletText;
        break;
      case 'numbered_list_item':
        const numberText = block.numbered_list_item?.rich_text?.[0]?.text?.content || '';
        textContent += '1. ' + numberText;
        break;
      case 'divider':
        textContent += '---';
        break;
      case 'code':
        const codeText = block.code?.rich_text?.[0]?.text?.content || '';
        const language = block.code?.language || 'plain text';
        textContent += '```' + language + '\n' + codeText + '\n```';
        break;
    }
    textContent += "\n";
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

export async function createNotionPageApi(title: string, content: string, parentPageId?: string): Promise<NotionPageResponse> {
  if (!DEFAULT_NOTION_PARENT_PAGE_ID && !parentPageId) {
    return { 
      success: false, 
      error: "Default Notion Parent Page ID is not configured and no specific parent_page_id provided." 
    };
  }

  const effectiveParentPageId = parentPageId || DEFAULT_NOTION_PARENT_PAGE_ID;
  
  try {
    const pageData = await callNotionApi('pages', 'POST', {
      parentId: effectiveParentPageId,
      title,
      content
    });

    return { 
      success: true, 
      message: `Notion page "${title}" created successfully.`, 
      page_id: pageData.id, 
      url: pageData.url 
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: `Failed to create Notion page: ${error.message}`
    };
  }
}

export async function getNotionPageContentApi(pageId: string): Promise<NotionPageResponse> {
  try {
    const data = await callNotionApi(`pages/${pageId}`, 'GET');
    return { 
      success: true, 
      page_id: pageId, 
      content: notionBlocksToText(data.blocks || [])
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: `Failed to get Notion page content: ${error.message}` 
    };
  }
}

function processMarkdownContent(content: string): string[] {
  const lines = content.split('\n');
  const processedLines: string[] = [];
  let currentLine = '';
  let inCodeBlock = false;
  let inList = false;
  let listIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (line === '') {
      if (currentLine) {
        processedLines.push(currentLine);
        currentLine = '';
      }
      continue;
    }

    // Handle code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        if (currentLine) {
          processedLines.push(currentLine);
          currentLine = '';
        }
        inCodeBlock = true;
        continue;
      } else {
        inCodeBlock = false;
        continue;
      }
    }

    if (inCodeBlock) {
      if (currentLine) {
        processedLines.push(currentLine);
      }
      currentLine = line;
      continue;
    }

    // Handle headings
    if (line.startsWith('# ')) {
      if (currentLine) {
        processedLines.push(currentLine);
      }
      processedLines.push(line);
      currentLine = '';
      continue;
    }

    // Handle lists
    if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      if (currentLine) {
        processedLines.push(currentLine);
      }
      processedLines.push(line);
      currentLine = '';
      continue;
    }

    // Handle regular text
    if (currentLine) {
      currentLine += ' ' + line;
    } else {
      currentLine = line;
    }
  }

  if (currentLine) {
    processedLines.push(currentLine);
  }

  return processedLines;
}

export async function appendNotionPageContentApi(pageId: string, contentToAppend: string): Promise<NotionPageResponse> {
  try {
    await callNotionApi(`pages/${pageId}`, 'PATCH', {
      content: contentToAppend
    });
    return { 
      success: true, 
      message: `Content appended to Notion page ${pageId}.` 
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: `Failed to append content to Notion page: ${error.message}` 
    };
  }
}

// Enhanced update functions using Gemini 1.5 Pro
export async function updateNotionPageWithAI(pageId: string, query: string, contentType: string = 'research', updateMode: 'append' | 'replace' = 'append'): Promise<NotionPageResponse> {
  try {
    const response = await fetch('http://localhost:3001/api/notion/enhanced-update/' + pageId, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        contentType,
        updateMode
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'Enhanced update failed');
    }

    const result = await response.json();
    
    return { 
      success: true, 
      page_id: result.notionPageId,
      url: result.notionPageUrl,
      message: result.message,
      metadata: {
        updateMode: result.updateMode,
        blocksAdded: result.blocksAdded,
        contentType: result.contentMetadata?.contentType,
        wordCount: result.contentMetadata?.wordCount,
        model: result.contentMetadata?.model
      }
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: `Failed to update Notion page with AI: ${error.message}` 
    };
  }
}

export async function appendNotionPageWithAI(pageId: string, query: string, contentType: string = 'research'): Promise<NotionPageResponse> {
  return updateNotionPageWithAI(pageId, query, contentType, 'append');
}

export async function replaceNotionPageWithAI(pageId: string, query: string, contentType: string = 'research'): Promise<NotionPageResponse> {
  return updateNotionPageWithAI(pageId, query, contentType, 'replace');
} 