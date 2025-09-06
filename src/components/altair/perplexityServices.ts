export async function callPerplexitySearch(query: string) {
  const response = await fetch('/api/perplexity/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error('Perplexity API request failed');
  return response.json();
}

export async function callStormResearch(query: string, notionParentId: string) {
  // Increase timeout for long-running STORM research
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes timeout
  
  try {
    const response = await fetch('/api/storm/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, notionParentId }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'STORM research request failed');
    }
    
    return await response.json();
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('STORM research timed out after 10 minutes');
    }
    throw error;
  }
} 