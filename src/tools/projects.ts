import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CostlockerClient } from '../costlocker/client.js';
import { z } from 'zod';

// --- Tool definitions ---

export const listProjectsTool: Tool = {
  name: 'costlocker_list_projects',
  description: 'List projects in Costlocker. Optionally filter by client ID or project state. Returns project names, IDs, clients, states, and budget summaries.',
  inputSchema: {
    type: 'object',
    properties: {
      client_id: {
        type: 'number',
        description: 'Filter projects by client ID (optional)',
      },
      state: {
        type: 'string',
        enum: ['running', 'finished', 'idle'],
        description: 'Filter projects by state (optional)',
      },
    },
  },
};

export const getProjectTool: Tool = {
  name: 'costlocker_get_project',
  description: 'Get detailed information about a specific project including budget, people, and activities.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID to retrieve',
      },
    },
    required: ['project_id'],
  },
};

export const searchProjectsTool: Tool = {
  name: 'costlocker_search_projects',
  description: 'Search for projects by name. Returns matching projects with their IDs and basic info.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to match against project names (case-insensitive)',
      },
    },
    required: ['query'],
  },
};

export const createProjectTool: Tool = {
  name: 'costlocker_create_project',
  description: '[WRITE OPERATION] Create a new project in Costlocker. This writes to production data. Always confirm project details with the user before calling.',
  annotations: {
    title: 'Create Project',
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  },
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Project name',
      },
      client_id: {
        type: 'number',
        description: 'Client ID to assign the project to',
      },
      date_start: {
        type: 'string',
        description: 'Project start date (YYYY-MM-DD)',
      },
      date_end: {
        type: 'string',
        description: 'Project end date (YYYY-MM-DD)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tag names to assign to the project',
      },
      state: {
        type: 'string',
        enum: ['running', 'finished', 'idle'],
        description: 'Project state (default: running)',
      },
    },
    required: ['name', 'client_id'],
  },
};

export const updateProjectTool: Tool = {
  name: 'costlocker_update_project',
  description: '[WRITE OPERATION] Update an existing project (name, dates, state, tags) in Costlocker. This modifies production data. Always confirm changes with the user before calling.',
  annotations: {
    title: 'Update Project',
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'The project ID to update',
      },
      name: {
        type: 'string',
        description: 'New project name (optional)',
      },
      date_start: {
        type: 'string',
        description: 'New start date YYYY-MM-DD (optional)',
      },
      date_end: {
        type: 'string',
        description: 'New end date YYYY-MM-DD (optional)',
      },
      state: {
        type: 'string',
        enum: ['running', 'finished', 'idle'],
        description: 'New project state (optional)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'New tag names (replaces existing tags, optional)',
      },
    },
    required: ['project_id'],
  },
};

// --- Validation schemas ---

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format');

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  client_id: z.number().int().positive('Client ID must be a positive integer'),
  date_start: dateSchema.optional(),
  date_end: dateSchema.optional(),
  tags: z.array(z.string()).optional(),
  state: z.enum(['running', 'finished', 'idle']).optional(),
});

const updateProjectSchema = z.object({
  project_id: z.number().int().positive('Project ID must be a positive integer'),
  name: z.string().min(1).optional(),
  date_start: dateSchema.optional(),
  date_end: dateSchema.optional(),
  state: z.enum(['running', 'finished', 'idle']).optional(),
  tags: z.array(z.string()).optional(),
});

// --- Handlers ---

interface SimpleProject {
  id: number;
  name: string;
  client: { id: number; name: string };
  state: string;
  [key: string]: unknown;
}

export async function handleListProjects(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const data = await client.simpleApiSingle<SimpleProject[]>('Simple_Projects');

    let projects = Array.isArray(data) ? data : [];

    if (args.client_id) {
      projects = projects.filter(p => p.client?.id === args.client_id);
    }
    if (args.state) {
      projects = projects.filter(p => p.state === args.state);
    }

    // Truncate to reasonable size
    const truncated = projects.length > 100;
    const result = truncated ? projects.slice(0, 100) : projects;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Found ${projects.length} project(s)${truncated ? ' (showing first 100)' : ''}`,
          projects: result,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('listing projects', error);
  }
}

export async function handleGetProject(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const projectId = args.project_id as number;
    const data = await client.restGet(`/projects/${projectId}`);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Project detail for ID ${projectId}`,
          project: data,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('getting project', error);
  }
}

export async function handleSearchProjects(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const query = (args.query as string).toLowerCase();
    const data = await client.simpleApiSingle<SimpleProject[]>('Simple_Projects');

    const projects = Array.isArray(data) ? data : [];
    const matches = projects.filter(p =>
      p.name?.toLowerCase().includes(query)
    );

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Found ${matches.length} project(s) matching "${args.query}"`,
          projects: matches,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('searching projects', error);
  }
}

export async function handleCreateProject(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const parsed = createProjectSchema.parse(args);
    const items: Record<string, unknown>[] = [];

    const project: Record<string, unknown> = {
      name: parsed.name,
      client_id: parsed.client_id,
      state: parsed.state || 'running',
    };
    if (parsed.date_start) project.date_start = parsed.date_start;
    if (parsed.date_end) project.date_end = parsed.date_end;
    if (parsed.tags) project.tags = parsed.tags.map(t => ({ name: t }));

    items.push(project);

    const data = await client.restPost('/projects/', items);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Project "${parsed.name}" created`,
          result: data,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('creating project', error);
  }
}

export async function handleUpdateProject(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const parsed = updateProjectSchema.parse(args);
    const project: Record<string, unknown> = {
      id: parsed.project_id,
    };
    if (parsed.name) project.name = parsed.name;
    if (parsed.date_start) project.date_start = parsed.date_start;
    if (parsed.date_end) project.date_end = parsed.date_end;
    if (parsed.tags) project.tags = parsed.tags.map(t => ({ name: t }));

    // State changes use "action" field, not "state"
    // Valid actions: upsert (default), finish, reopen, delete, duplicate
    if (parsed.state === 'finished') {
      project.action = 'finish';
    } else if (parsed.state === 'running') {
      project.action = 'reopen';
    }

    const data = await client.restPost('/projects/', [project]);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Project ${parsed.project_id} updated`,
          result: data,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('updating project', error);
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
