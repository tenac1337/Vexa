import type { Contact } from './types';

export async function mcpListDirectory(path: string) {
  const response = await fetch('http://localhost:3001/mcp/desktop-commander_list_directory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) throw new Error('Failed to list directory');
  return response.json();
}

export async function mcpReadFile(path: string, offset = 0, length = 100) {
  const response = await fetch('http://localhost:3001/mcp/desktop-commander_read_file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, offset, length }),
  });
  if (!response.ok) throw new Error('Failed to read file');
  return response.json();
}

export async function mcpListTools() {
  // This endpoint is usually /mcp/list_tools or similar; if not, adjust accordingly
  const response = await fetch('http://localhost:3001/mcp/list_tools', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to list MCP tools');
  return response.json();
}

export async function mcpCallTool(toolName: string, params: Record<string, any>) {
  // POST to the tool endpoint, e.g., /mcp/{toolName}
  const response = await fetch(`http://localhost:3001/mcp/${toolName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error(`Failed to call MCP tool: ${toolName}`);
  return response.json();
} 