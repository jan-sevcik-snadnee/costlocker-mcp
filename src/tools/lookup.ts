import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CostlockerClient } from '../costlocker/client.js';

// --- Tool definitions ---

export const listClientsTool: Tool = {
  name: 'costlocker_list_clients',
  description: 'List all clients in Costlocker. Returns client names and IDs.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const listActivitiesTool: Tool = {
  name: 'costlocker_list_activities',
  description: 'List all activities (task types) available in Costlocker.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const listTagsTool: Tool = {
  name: 'costlocker_list_tags',
  description: 'List all tags in Costlocker.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const listGroupsTool: Tool = {
  name: 'costlocker_list_groups',
  description: 'List all groups (teams/departments) in Costlocker with their people and activities.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

// --- Handlers ---

const TRUNCATION_LIMIT = 200;

function truncateList(data: unknown): { items: unknown[]; truncated: boolean } {
  const items = Array.isArray(data) ? data : [];
  const truncated = items.length > TRUNCATION_LIMIT;
  return { items: truncated ? items.slice(0, TRUNCATION_LIMIT) : items, truncated };
}

export async function handleListClients(client: CostlockerClient) {
  try {
    const data = await client.simpleApiSingle<unknown[]>('Simple_Clients');
    const { items, truncated } = truncateList(data);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Found ${Array.isArray(data) ? data.length : 0} client(s)${truncated ? ` (showing first ${TRUNCATION_LIMIT})` : ''}`,
          clients: items,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('listing clients', error);
  }
}

export async function handleListActivities(client: CostlockerClient) {
  try {
    const data = await client.simpleApiSingle<unknown[]>('Simple_Activities');
    const { items, truncated } = truncateList(data);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Found ${Array.isArray(data) ? data.length : 0} activity/activities${truncated ? ` (showing first ${TRUNCATION_LIMIT})` : ''}`,
          activities: items,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('listing activities', error);
  }
}

export async function handleListTags(client: CostlockerClient) {
  try {
    const data = await client.simpleApiSingle<unknown[]>('Simple_Tags');
    const { items, truncated } = truncateList(data);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Found ${Array.isArray(data) ? data.length : 0} tag(s)${truncated ? ` (showing first ${TRUNCATION_LIMIT})` : ''}`,
          tags: items,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('listing tags', error);
  }
}

export async function handleListGroups(client: CostlockerClient) {
  try {
    const data = await client.simpleApiSingle<unknown[]>('Simple_Groups');
    const { items, truncated } = truncateList(data);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Found ${Array.isArray(data) ? data.length : 0} group(s)${truncated ? ` (showing first ${TRUNCATION_LIMIT})` : ''}`,
          groups: items,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('listing groups', error);
  }
}

function errorResult(operation: string, error: unknown) {
  return {
    content: [{
      type: 'text' as const,
      text: `Error ${operation}: ${error instanceof Error ? error.message : String(error)}`,
    }],
    isError: true,
  };
}
