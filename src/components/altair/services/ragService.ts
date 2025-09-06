export async function getRagContent(): Promise<string> {
  const response = await fetch('/rag.txt');
  if (!response.ok) throw new Error('Failed to fetch rag content');
  return response.text();
} 