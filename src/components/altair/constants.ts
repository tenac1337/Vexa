// API Keys and Configuration
export const API_KEYS = {
  OPENAI: process.env.REACT_APP_OPENAI_API_KEY || '',
  NOTION: process.env.REACT_APP_NOTION_API_KEY || '',
  WEATHER: process.env.REACT_APP_WEATHER_API_KEY || '',
};

export const API_ENDPOINTS = {
  BACKEND: process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001',
  PYTHON_SERVER: process.env.REACT_APP_PYTHON_SERVER_URL || 'http://localhost:5000',
};

export const CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_FORMATS: ['.pdf', '.txt', '.docx'],
};