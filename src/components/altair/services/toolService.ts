export const openTool = async (tool: string, duration?: number): Promise<any> => {
  try {
    const response = await fetch('http://localhost:3001/api/open-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, duration }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || 'Failed to open tool');
    }
    return await response.json();
  } catch (error: any) {
    console.error(`Error opening tool ${tool}:`, error);
    return { success: false, error: error.message };
  }
}; 