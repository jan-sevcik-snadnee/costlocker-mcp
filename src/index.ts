#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CostlockerClient } from './costlocker/client.js';

// --- Env validation ---
const COSTLOCKER_API_TOKEN = process.env.COSTLOCKER_API_TOKEN;
const COSTLOCKER_HOST = process.env.COSTLOCKER_HOST || 'https://rest.costlocker.com';

if (!COSTLOCKER_API_TOKEN) {
  process.stderr.write('Missing COSTLOCKER_API_TOKEN environment variable.\n');
  process.exit(1);
}

const client = new CostlockerClient({
  apiToken: COSTLOCKER_API_TOKEN,
  host: COSTLOCKER_HOST,
});

// Verify credentials and cache user info at startup
try {
  const userInfo = await client.verifyConnection();
  const person = userInfo.person;
  const auth = userInfo.authorization || 'unknown';
  process.stderr.write(
    `Costlocker MCP connected: ${person?.first_name} ${person?.last_name} (${person?.email}), ` +
    `company: ${userInfo.company?.name}, authorization: ${auth}\n`
  );
} catch (error) {
  process.stderr.write(
    `Failed to verify Costlocker credentials: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
}

// --- Tool imports ---
import {
  listProjectsTool, getProjectTool, searchProjectsTool, createProjectTool, updateProjectTool,
  handleListProjects, handleGetProject, handleSearchProjects, handleCreateProject, handleUpdateProject,
} from './tools/projects.js';

import {
  logTimeTool, getTimesheetTool, getMonthlyTimesheetTool, getRunningEntryTool, getAssignmentsTool,
  handleLogTime, handleGetTimesheet, handleGetMonthlyTimesheet, handleGetRunningEntry, handleGetAssignments,
} from './tools/timesheet.js';

import {
  listPeopleTool, getMeTool, getProjectPeopleTool,
  handleListPeople, handleGetMe, handleGetProjectPeople,
} from './tools/people.js';

import {
  getProjectBudgetTool, getProjectBillingTool, getProjectExpensesTool, updateProjectBillingTool,
  handleGetProjectBudget, handleGetProjectBilling, handleGetProjectExpenses, handleUpdateProjectBilling,
} from './tools/finance.js';

import {
  listClientsTool, listActivitiesTool, listTagsTool, listGroupsTool,
  handleListClients, handleListActivities, handleListTags, handleListGroups,
} from './tools/lookup.js';

// --- Server setup ---
const server = new Server(
  { name: 'costlocker-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

server.setRequestHandler(InitializeRequestSchema, async () => ({
  protocolVersion: '2024-11-05',
  capabilities: { tools: {}, resources: {}, prompts: {} },
  serverInfo: { name: 'costlocker-mcp', version: '1.0.0' },
}));

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Lookup (reference data)
    listClientsTool,
    listActivitiesTool,
    listTagsTool,
    listGroupsTool,
    // People
    listPeopleTool,
    getMeTool,
    getProjectPeopleTool,
    // Projects
    listProjectsTool,
    getProjectTool,
    searchProjectsTool,
    createProjectTool,
    updateProjectTool,
    // Finance
    getProjectBudgetTool,
    getProjectBillingTool,
    getProjectExpensesTool,
    updateProjectBillingTool,
    // Timesheet
    logTimeTool,
    getTimesheetTool,
    getMonthlyTimesheetTool,
    getRunningEntryTool,
    getAssignmentsTool,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args || {}) as Record<string, unknown>;

  switch (name) {
    // Lookup
    case 'costlocker_list_clients': return handleListClients(client);
    case 'costlocker_list_activities': return handleListActivities(client);
    case 'costlocker_list_tags': return handleListTags(client);
    case 'costlocker_list_groups': return handleListGroups(client);
    // People
    case 'costlocker_list_people': return handleListPeople(client);
    case 'costlocker_get_me': return handleGetMe(client);
    case 'costlocker_get_project_people': return handleGetProjectPeople(client, a);
    // Projects
    case 'costlocker_list_projects': return handleListProjects(client, a);
    case 'costlocker_get_project': return handleGetProject(client, a);
    case 'costlocker_search_projects': return handleSearchProjects(client, a);
    case 'costlocker_create_project': return handleCreateProject(client, a);
    case 'costlocker_update_project': return handleUpdateProject(client, a);
    // Finance
    case 'costlocker_get_project_budget': return handleGetProjectBudget(client, a);
    case 'costlocker_get_project_billing': return handleGetProjectBilling(client, a);
    case 'costlocker_get_project_expenses': return handleGetProjectExpenses(client, a);
    case 'costlocker_update_project_billing': return handleUpdateProjectBilling(client, a);
    // Timesheet
    case 'costlocker_log_time': return handleLogTime(client, a);
    case 'costlocker_get_timesheet': return handleGetTimesheet(client, a);
    case 'costlocker_get_monthly_timesheet': return handleGetMonthlyTimesheet(client, a);
    case 'costlocker_get_running_entry': return handleGetRunningEntry(client);
    case 'costlocker_get_assignments': return handleGetAssignments(client);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));

// --- Error handling ---
process.on('uncaughtException', () => { process.exit(1); });
process.on('unhandledRejection', () => { process.exit(1); });

// --- Start ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(() => { process.exit(1); });
