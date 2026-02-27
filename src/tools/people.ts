import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CostlockerClient } from '../costlocker/client.js';

// --- Tool definitions ---

export const listPeopleTool: Tool = {
  name: 'costlocker_list_people',
  description: 'List all people in the Costlocker organization. Returns names, emails, roles, and financial data (salary, hourly rates) based on the user\'s access level. Data visibility is controlled by the API token permissions.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const getMeTool: Tool = {
  name: 'costlocker_get_me',
  description: 'Get information about the currently authenticated Costlocker user.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const getProjectPeopleTool: Tool = {
  name: 'costlocker_get_project_people',
  description: 'Get people assigned to a specific project with their budget hours, tracked hours, and costs.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID to get people for',
      },
    },
    required: ['project_id'],
  },
};

// --- Handlers ---

export async function handleListPeople(client: CostlockerClient) {
  try {
    const data = await client.simpleApiSingle<unknown[]>('Simple_People');
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Found ${Array.isArray(data) ? data.length : 0} person(s)`,
          people: data,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('listing people', error);
  }
}

export async function handleGetMe(client: CostlockerClient) {
  try {
    const data = await client.restGet('/me');
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: 'Current user info',
          user: data,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('getting current user', error);
  }
}

export async function handleGetProjectPeople(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const projectId = args.project_id as number;
    const data = await client.simpleApiSingle<unknown[]>('Simple_Projects_Ce', { 'Simple_Projects_Ce': [projectId] });
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `People assigned to project ${projectId}`,
          people: data,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('getting project people', error);
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
