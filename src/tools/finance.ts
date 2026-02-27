import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CostlockerClient } from '../costlocker/client.js';

// --- Tool definitions ---

export const getProjectBudgetTool: Tool = {
  name: 'costlocker_get_project_budget',
  description: 'Get project budget information including revenue, costs, and profit. Uses Simple_Projects data for financial overview.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID to get budget for',
      },
    },
    required: ['project_id'],
  },
};

export const getProjectBillingTool: Tool = {
  name: 'costlocker_get_project_billing',
  description: 'Get billing/invoicing items for a project. Shows what has been billed and what is pending.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID to get billing for',
      },
    },
    required: ['project_id'],
  },
};

export const getProjectExpensesTool: Tool = {
  name: 'costlocker_get_project_expenses',
  description: 'Get expenses for a project. Shows non-personnel costs like materials, licenses, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID to get expenses for',
      },
    },
    required: ['project_id'],
  },
};

const TRUNCATION_LIMIT = 200;

// --- Handlers ---

interface SimpleProject {
  id: number;
  [key: string]: unknown;
}

export async function handleGetProjectBudget(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const projectId = args.project_id as number;
    const data = await client.simpleApiSingle<SimpleProject[]>('Simple_Projects');
    const projects = Array.isArray(data) ? data : [];
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      return {
        content: [{
          type: 'text' as const,
          text: `Project with ID ${projectId} not found`,
        }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Budget for project ${projectId}`,
          budget: project,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('getting project budget', error);
  }
}

export async function handleGetProjectBilling(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const projectId = args.project_id as number;
    const data = await client.simpleApiSingle<unknown[]>('Simple_Projects_Billing', { 'Simple_Projects_Billing': [projectId] });
    const items = Array.isArray(data) ? data : [];
    const truncated = items.length > TRUNCATION_LIMIT;
    const result = truncated ? items.slice(0, TRUNCATION_LIMIT) : items;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Billing for project ${projectId}: ${items.length} item(s)${truncated ? ` (showing first ${TRUNCATION_LIMIT})` : ''}`,
          billing: result,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('getting project billing', error);
  }
}

export async function handleGetProjectExpenses(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const projectId = args.project_id as number;
    const data = await client.simpleApiSingle<unknown[]>('Simple_Projects_Expenses', { 'Simple_Projects_Expenses': [projectId] });
    const items = Array.isArray(data) ? data : [];
    const truncated = items.length > TRUNCATION_LIMIT;
    const result = truncated ? items.slice(0, TRUNCATION_LIMIT) : items;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Expenses for project ${projectId}: ${items.length} item(s)${truncated ? ` (showing first ${TRUNCATION_LIMIT})` : ''}`,
          expenses: result,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('getting project expenses', error);
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
