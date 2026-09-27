<h1 align="center">Formatry for agents</h1>

<p align="center">Connect Codex and Cursor to Formatry for creative previews and Studio editing through MCP.</p>

<p align="center">
  <a href="#quick-start">Install</a> ·
  <a href="https://formatry.cc/studio/settings/developer">Get an API key</a> ·
  <a href="#prepare-a-creative">Workflow</a>
</p>

Formatry's hosted MCP connection lets an agent check access, upload supported attachments, create protected previews, and propose edits to saved Studio creatives. Payment confirmation and paid export stay in Studio.

The plugin connects directly to `https://formatry.cc/api/mcp`; it starts no local server. You need a scoped API key from [Formatry developer settings](https://formatry.cc/studio/settings/developer), supplied through `FORMATRY_CC_API_KEY`.

## Quick start

Install the public Codex plugin without downloading a bundle:

```bash
codex plugin marketplace add iddictive/formatry-plugin
codex plugin add formatry-api@formatry
```

Add the hosted MCP server to Cursor:

[![Add Formatry MCP to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=formatry-api&config=eyJmb3JtYXRyeS1hcGkiOnsidXJsIjoiaHR0cHM6Ly9mb3JtYXRyeS5jYy9hcGkvbWNwIiwiaGVhZGVycyI6eyJBdXRob3JpemF0aW9uIjoiQmVhcmVyICR7ZW52OkZPUk1BVFJZX0NDX0FQSV9LRVl9In19fQ%3D%3D)

Then set the key in the environment that starts your agent client:

```bash
export FORMATRY_CC_API_KEY='your-scoped-formatry-key'
```

The bundled connection is already configured for hosted Streamable HTTP:

```json
{
  "mcpServers": {
    "formatry-api": {
      "type": "http",
      "url": "https://formatry.cc/api/mcp",
      "bearer_token_env_var": "FORMATRY_CC_API_KEY"
    }
  }
}
```

In Codex, start with: `Check my Formatry connection and tell me the next safe step.`

## Prepare a creative

1. Run `formatry_connection_status`. A hosted connection needs `FORMATRY_CC_API_KEY`; a trial is a separate account/setup path, not a substitute for a scoped key.
2. Run `formatry_check_balance` and `formatry_get_preview_quota`. Balance covers generation access; preview quota covers protected previews. Neither guarantees the other.
3. Attach a source file in Codex. The hosted tool accepts only the OpenAI-authorized file object; it does not read a local path.
4. Run `formatry_upload_asset_file`, retain each returned `assetId`, and run `formatry_create_preview` with a stable `idempotencyKey` for a bounded protected preview.
5. For a saved Studio creative, read its exact revision, then use `formatry_apply_studio_command` only after the user confirms the typed edit. Use `formatry_create_studio_creative_preview` to inspect the exact revision and `formatry_create_studio_export_quote` to return the visible Studio handoff.
6. Paid confirmation and export remain in Studio. The hosted MCP does not confirm quotes, start paid work, or debit credits.

Example Codex prompt:

```text
Check my Formatry connection, balance, and preview quota. Upload the attached campaign image, create one protected preview, then inspect the saved Studio creative at its exact revision. Propose one typed edit, wait for my confirmation, create its exact preview and visible export quote, and return the Studio handoff. Do not confirm payment or start paid export.
```

`401` means configure or replace the key outside chat. `402` means reduce the output set or add generation balance outside chat before creating a new job. `403` means the key needs the returned scope. `409` means reuse the original request or wait as directed. `422` identifies an unsupported input. `429` provides a retry/reset time.

The public plugin starts no local subprocess. Codex and Cursor connect directly to the hosted Streamable HTTP endpoint above.
