import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CostlockerClient } from '../costlocker/client.js';
import { z } from 'zod';

// --- Tool definitions ---

export const logTimeTool: Tool = {
  name: 'costlocker_log_time',
  description: '[WRITE OPERATION] Log time entry to a project/activity in Costlocker. This writes to production data. Duration is specified in hours (e.g. 1.5 for 1h 30m). Always confirm details with the user before calling.',
  annotations: {
    title: 'Log Time Entry',
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: true,
  },
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'number',
        description: 'Project ID to log time to',
      },
      activity_id: {
        type: 'number',
        description: 'Activity ID within the project',
      },
      person_id: {
        type: 'number',
        description: 'Person ID (if not provided, logs for current user)',
      },
      hours: {
        type: 'number',
        description: 'Duration in hours (e.g. 1.5 for 1h 30m)',
      },
      date: {
        type: 'string',
        description: 'Date for the entry (YYYY-MM-DD). Defaults to today.',
      },
      description: {
        type: 'string',
        description: 'Description of the work done (optional)',
      },
    },
    required: ['project_id', 'activity_id', 'hours'],
  },
};

export const getTimesheetTool: Tool = {
  name: 'costlocker_get_timesheet',
  description: 'Get timesheet entries with optional filters by date range, person, or project. Returns individual time entries with details.',
  inputSchema: {
    type: 'object',
    properties: {
      date_from: {
        type: 'string',
        description: 'Start date filter (YYYY-MM-DD)',
      },
      date_to: {
        type: 'string',
        description: 'End date filter (YYYY-MM-DD)',
      },
      person_id: {
        type: 'number',
        description: 'Filter by person ID (optional)',
      },
      project_id: {
        type: 'number',
        description: 'Filter by project ID (optional)',
      },
    },
  },
};

export const getMonthlyTimesheetTool: Tool = {
  name: 'costlocker_get_monthly_timesheet',
  description: 'Get monthly aggregated timesheet data. Shows total hours per person/project for a given month.',
  inputSchema: {
    type: 'object',
    properties: {
      date_from: {
        type: 'string',
        description: 'Start date (YYYY-MM-DD)',
      },
      date_to: {
        type: 'string',
        description: 'End date (YYYY-MM-DD)',
      },
      person_id: {
        type: 'number',
        description: 'Filter by person ID (optional)',
      },
      project_id: {
        type: 'number',
        description: 'Filter by project ID (optional)',
      },
    },
  },
};

export const getRunningEntryTool: Tool = {
  name: 'costlocker_get_running_entry',
  description: 'Get the currently running time tracking entry (if any).',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export const getAssignmentsTool: Tool = {
  name: 'costlocker_get_assignments',
  description: 'Get available project/activity assignments for time tracking. Shows which projects and activities the current user can log time to.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

// --- Validation schemas ---

const logTimeSchema = z.object({
  project_id: z.number().int().positive('Project ID must be a positive integer'),
  activity_id: z.number().int().positive('Activity ID must be a positive integer'),
  person_id: z.number().int().positive('Person ID must be a positive integer').optional(),
  hours: z.number().positive('Hours must be greater than 0').max(24, 'Hours cannot exceed 24'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').optional(),
  description: z.string().optional(),
});

// --- Handlers ---

export async function handleLogTime(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const parsed = logTimeSchema.parse(args);
    const durationSeconds = Math.round(parsed.hours * 3600);

    const entry: Record<string, unknown> = {
      project_id: parsed.project_id,
      activity_id: parsed.activity_id,
      duration: durationSeconds,
      date: parsed.date || new Date().toISOString().split('T')[0],
    };
    if (parsed.person_id) entry.person_id = parsed.person_id;
    if (parsed.description) entry.description = parsed.description;

    const data = await client.restPost('/timeentries/', [entry]);
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Logged ${parsed.hours}h on project ${parsed.project_id}, activity ${parsed.activity_id}`,
          result: data,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('logging time', error);
  }
}

export async function handleGetTimesheet(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const params: Record<string, unknown> = {};
    if (args.date_from) params.datef = args.date_from;
    if (args.date_to) params.datet = args.date_to;
    if (args.person_id) params.person = args.person_id;
    if (args.project_id) params.project = args.project_id;

    const data = await client.simpleApiSingle<unknown[]>('Simple_Timesheet', params);
    const entries = Array.isArray(data) ? data : [];

    // Truncate large results
    const truncated = entries.length > 200;
    const result = truncated ? entries.slice(0, 200) : entries;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Found ${entries.length} timesheet entries${truncated ? ' (showing first 200)' : ''}`,
          entries: result,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('getting timesheet', error);
  }
}

export async function handleGetMonthlyTimesheet(client: CostlockerClient, args: Record<string, unknown>) {
  try {
    const params: Record<string, unknown> = {};
    if (args.date_from) params.datef = args.date_from;
    if (args.date_to) params.datet = args.date_to;
    if (args.person_id) params.person = args.person_id;
    if (args.project_id) params.project = args.project_id;

    const data = await client.simpleApiSingle<unknown[]>('Simple_Timesheet_Month', params);
    const entries = Array.isArray(data) ? data : [];

    const truncated = entries.length > 200;
    const result = truncated ? entries.slice(0, 200) : entries;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: `Monthly timesheet data: ${entries.length} entries${truncated ? ' (showing first 200)' : ''}`,
          data: result,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('getting monthly timesheet', error);
  }
}

export async function handleGetRunningEntry(client: CostlockerClient) {
  try {
    const data = await client.simpleApiSingle('Simple_Tracking_RunningEntry');
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: 'Running time entry',
          entry: data,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('getting running entry', error);
  }
}

export async function handleGetAssignments(client: CostlockerClient) {
  try {
    const data = await client.simpleApiSingle('Simple_Tracking_Assignments');
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          summary: 'Available tracking assignments',
          assignments: data,
        }, null, 2),
      }],
    };
  } catch (error) {
    return errorResult('getting assignments', error);
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
