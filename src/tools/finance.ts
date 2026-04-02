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

export const updateProjectBillingTool: Tool = {
  name: 'costlocker_update_project_billing',
  description: 'Update a billing item on a project. Used to write invoice numbers back to Costlocker after creating an invoice in iDoklad. Sets the description (invoice number) and status on a billing item.',
  annotations: { destructiveHint: true },
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID containing the billing item',
      },
      billing_id: {
        type: 'string',
        description: 'The billing item ID to update',
      },
      invoice_number: {
        type: 'string',
        description: 'The invoice number to write to the billing item description',
      },
      status: {
        type: 'string',
        description: 'The billing status to set (default: "sent")',
        default: 'sent',
      },
    },
    required: ['project_id', 'billing_id', 'invoice_number'],
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

export async function handleUpdateProjectBilling(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const projectId = args.project_id as number;
    const billingId = args.billing_id as string;
    const invoiceNumber = args.invoice_number as string;
    const status = (args.status as string) ?? 'sent';

    const payload = [{
      id: String(projectId),
      items: [{
        item: { type: 'billing', billing_id: String(billingId) },
        billing: { description: invoiceNumber, status: status },
      }],
    }];

    const result = await client.restPost('/projects/', payload);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Updated billing item ${billingId} on project ${projectId} with invoice number "${invoiceNumber}" and status "${status}"`,
          result,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('updating project billing', error);
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
