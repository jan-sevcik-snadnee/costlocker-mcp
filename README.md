# costlocker-mcp

MCP server for [Costlocker](https://costlocker.com) — your project management and time tracking tool. Connect your AI assistant to Costlocker and work with projects, budgets, timesheets, and more through natural language.

## Quick start

### 1. Get your API token from Costlocker

> Only the account **Owner** can create API tokens. See the [step-by-step guide with screenshots](https://help.costlocker.com/settings/api).

1. Log in to [Costlocker](https://new.costlocker.com)
2. Click your **name** in the top-right corner and select **Settings**
3. Go to the **API** tab (or go directly to [new.costlocker.com/settings/api](https://new.costlocker.com/settings/api))
4. Copy your **personal access token** (click "Zkopírovat do schránky" or "Regenerate token" if you don't have one yet)

### 2. Configure your MCP client

Add the `costlocker` server to your MCP client configuration. Example for desktop apps:

- **macOS config:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows config:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "costlocker": {
      "command": "npx",
      "args": ["-y", "costlocker-mcp"],
      "env": {
        "COSTLOCKER_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

Replace `your-api-token` with the token from step 1.

### 3. Restart your MCP client

That's it. Your AI assistant now has access to your Costlocker data. Try asking:

- *"Show me all running projects"*
- *"How many hours did I log this week?"*
- *"What's the budget status of project X?"*

## What can it do?

| Category | Tools | Description |
|---|---|---|
| **Projects** | `list_projects`, `get_project`, `search_projects` | Browse and search projects |
| | `create_project`, `update_project` | Create or update projects (with confirmation) |
| **Timesheets** | `log_time` | Log time entries (with confirmation) |
| | `get_timesheet`, `get_monthly_timesheet` | View timesheet data |
| | `get_running_entry`, `get_assignments` | Check running timer and available assignments |
| **People** | `list_people`, `get_me`, `get_project_people` | View team members and assignments |
| **Finance** | `get_project_budget`, `get_project_billing`, `get_project_expenses` | View budgets, billing, and expenses |
| **Lookup** | `list_clients`, `list_activities`, `list_tags`, `list_groups` | Browse reference data |

All tool names are prefixed with `costlocker_` (e.g. `costlocker_list_projects`).

## Security

- **Write operations** (`create_project`, `update_project`, `log_time`) require user confirmation — the AI will always ask before making changes
- **Input validation** on all write operations (Zod schemas)
- **Access control** is handled by your personal API token — you only see data your Costlocker role allows
- **Credential check** on startup via `/me` endpoint — invalid tokens fail immediately
- **Error sanitization** — API error responses are truncated to prevent leaking sensitive data

## Configuration

| Environment variable | Required | Description |
|---|---|---|
| `COSTLOCKER_API_TOKEN` | Yes | Personal access token from Costlocker API settings |
| `COSTLOCKER_HOST` | No | API host (default: `https://rest.costlocker.com`) |

## License

MIT
