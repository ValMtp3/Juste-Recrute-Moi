# JustHireMe MCP

JustHireMe exposes a lightweight stdio MCP server for agent workflows that need job lead intelligence without running the full desktop app.

## Start

From the repository root:

```powershell
backend\.venv\Scripts\python.exe backend\mcp_server.py
```

In the client config below, replace `<ABSOLUTE_PATH_TO_REPO>` with the absolute path to your local checkout of this repository.

The server implements `initialize`, `tools/list`, and `tools/call` over newline-delimited JSON-RPC on stdio.

## Tools

- `score_job_fit`: scores a raw posting against a JustHireMe candidate profile JSON.
- `evaluate_lead_quality`: runs the deterministic lead quality gate for a normalized lead.
- `extract_lead_intel`: extracts company, location, budget, urgency, stack, and signal quality from raw text.

## Example Client Config

```json
{
  "mcpServers": {
    "justhireme": {
      "command": "<ABSOLUTE_PATH_TO_REPO>\\backend\\.venv\\Scripts\\python.exe",
      "args": ["<ABSOLUTE_PATH_TO_REPO>\\backend\\mcp_server.py"],
      "cwd": "<ABSOLUTE_PATH_TO_REPO>"
    }
  }
}
```

Keep the MCP layer small and deterministic. If a tool needs persisted lead state, generated PDFs, or long-running scans, expose the existing FastAPI sidecar instead of duplicating that behavior here.
