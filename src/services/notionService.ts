import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api/notion';

export interface NotionPage {
    parentId: string;
    title: string;
    content: string[];
}

export const notionService = {
    createPage: async (page: NotionPage) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/pages`, page);
            return response.data;
        } catch (error) {
            console.error('Error creating Notion page:', error);
            throw error;
        }
    },

    getPage: async (pageId: string) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/pages/${pageId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching Notion page:', error);
            throw error;
        }
    },

    updatePage: async (pageId: string, updates: Partial<NotionPage>) => {
        try {
            // If there's content to update, use AI-enhanced update
            if (updates.content && Array.isArray(updates.content) && updates.content.length > 0) {
                const query = updates.content.join(' '); // Convert content array to string
                const response = await axios.patch(`${API_BASE_URL}/enhanced-update/${pageId}`, {
                    query: query,
                    contentType: 'research',
                    updateMode: 'replace' // Replace existing content with new AI-generated content
                });
                return response.data;
            } else {
                // For non-content updates (like title changes), use original method
                const response = await axios.patch(`${API_BASE_URL}/pages/${pageId}`, updates);
                return response.data;
            }
        } catch (error) {
            console.error('Error updating Notion page:', error);
            throw error;
        }
    }
}; 