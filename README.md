# Formatry API agent plugin

Use the hosted Formatry MCP server for normal Codex or Cursor work:

```text
https://formatry.cc/api/mcp
```

The distributed plugin connects only to the hosted MCP URL. Codex discovers Formatry's OAuth metadata from that endpoint. Cursor uses Formatry's predefined public marketplace client and the exact scopes required by the 26 published tools. Neither install needs a local server, package download, API key, or client secret.

## Connect

Install the public Codex plugin without downloading a bundle:

```bash
codex plugin marketplace add iddictive/formatry-plugin
codex plugin add formatry-api@formatry
```

Cursor can install the same hosted server through its native link:

[Install Formatry MCP in Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=formatry-api&config=eyJmb3JtYXRyeS1hcGkiOnsidXJsIjoiaHR0cHM6Ly9mb3JtYXRyeS5jYy9hcGkvbWNwIiwiYXV0aCI6eyJDTElFTlRfSUQiOiJodHRwczovL2Zvcm1hdHJ5LmNjL29hdXRoL2NsaWVudHMvY3Vyc29yLW1hcmtldHBsYWNlIiwic2NvcGVzIjpbImJhbGFuY2U6cmVhZCIsImFzc2V0czpyZWFkIiwiYXNzZXRzOndyaXRlIiwiam9iczp3cml0ZSIsImpvYnM6cmVhZCIsImFydGlmYWN0czpyZWFkIiwicHJldmlld3M6cmVhZCIsInByZXZpZXdzOndyaXRlIiwicHJvamVjdHM6cmVhZCIsInByb2plY3RzOndyaXRlIiwiY3JlYXRpdmVzOnJlYWQiLCJjcmVhdGl2ZXM6d3JpdGUiLCJwcmVzZXRzOnJlYWQiLCJicmFuZDpyZWFkIl19fX0=)

Complete the OAuth browser flow opened by the client. If Codex does not open it automatically, run:

```bash
codex mcp login formatry-api
```

The Codex connection is configured for hosted Streamable HTTP with OAuth as the client's default credential source:

```json
{
  "mcpServers": {
    "formatry-api": {
      "type": "http",
      "url": "https://formatry.cc/api/mcp"
    }
  }
}
```

Cursor's bundled config uses the public client id `https://formatry.cc/oauth/clients/cursor-marketplace` with no client secret. Formatry resolves this identifier server-side and accepts only Cursor's registered browser and local callbacks.

In Codex, start with: `Check my Formatry connection and tell me the next safe step.`

### Optional manual API-key connection

Formatry still accepts scoped API-key bearer tokens for direct integrations and existing automation. This is a manual compatibility path, not a marketplace-install requirement:

```bash
export FORMATRY_CC_API_KEY='your-scoped-formatry-key'
codex mcp add formatry-api-key --url https://formatry.cc/api/mcp --bearer-token-env-var FORMATRY_CC_API_KEY
```

Create or rotate a scoped key in [Formatry developer settings](https://formatry.cc/studio/settings/developer) and keep it out of chat and source files.

## Prepare a creative

1. Run `formatry_connection_status`. The normal hosted path uses the OAuth identity stored by the client; a manually configured scoped API key remains supported.
2. Run `formatry_check_balance` and `formatry_get_preview_quota`. Balance covers generation access; preview quota covers protected previews. Neither guarantees the other.
3. Reuse ready assets with `formatry_list_assets`, or inspect a user-authorized local source using the bundled Node helper, call `formatry_prepare_asset_upload`, transfer bytes with the helper and call `formatry_complete_asset_upload`. No manual Studio upload is required. Remote MCP receives metadata, not local paths.
4. Run `formatry_create_preview` with those assets and a stable `idempotencyKey` for a bounded protected preview. In ChatGPT or another compatible OpenAI host, `formatry_upload_asset_file` can accept a host-authorized file object with `download_url` and `file_id`; it does not read a local path.
5. For new work, call `formatry_start_creative` with a campaign `projectName`, optional `creativeName`, and a stable `idempotencyKey`. This creates a project and its first raster creative without Studio, rendering, or billing. Retain the returned ids and revision; after editing, resume with those ids rather than repeating creation. The tool requires `projects:write` and `creatives:write`; existing OAuth grants may need native reauthorization for the new scope. For a saved Studio creative, read its exact revision, then use `formatry_apply_studio_command` for the user-authorized typed edit. A request to propose or wait still requires the requested separate confirmation. Use `formatry_create_studio_creative_preview` to inspect the exact revision.
6. Read the saved creative revision, call `formatry_create_studio_export_quote` with `current` or `selected` output scope, and show the output set, `billingMode`, `freeUnits` and `freeRemaining`. After the user confirms a free raster quote, call `formatry_confirm_studio_export_quote` with the server-issued quote id and a stable idempotency key. Follow `job.id` through `formatry_wait_for_generation_job`, require a ready `formatry_get_artifact_manifest`, and return each requested file with `formatry_download_artifact_file`. Paid quotes use the upgrade/payment path in Studio; the hosted confirmation must reject them without debiting credits. No raw generation, pricing, provider or render fields are accepted.

Example Codex prompt:

```text
Check my Formatry connection, balance, and preview quota. List my ready Studio assets and create one protected preview, then inspect the saved Studio creative at its exact revision. Propose one typed edit, wait for my confirmation, create its exact preview, then quote downloadable raster files. Show my remaining free allowance and ask before consuming it. Confirm only a free quote and return ready files. Use Studio for paid export.
```

`401` means complete or repeat client OAuth sign-in, or replace the key for an explicitly manual key connection. `402` means reduce the output set or add generation balance outside chat before creating a new job. `403` means the identity needs the returned scope. `409` means reuse the original request or wait as directed. `422` identifies an unsupported input. `429` provides a retry/reset time.

The public plugin starts no local subprocess. Codex and Cursor connect directly to the hosted Streamable HTTP endpoint above.


## Local files without Studio

The bundled skill includes `scripts/formatry-files.mjs` for Node 22+ and ordinary host shell/filesystem permissions. It is not a local MCP process and does not read Codex credentials. The agent inspects an authorized source, prepares an upload through MCP, passes its encrypted two-minute capability to the helper on stdin, and completes the existing upload intent. Ready exports use `formatry_prepare_artifact_download` and the same helper to save checksum-verified files in the selected workspace, then open the actual result. Tickets must never be printed, persisted or placed in command-line arguments. The helper refuses redirects, workspace escapes, changed sources and overwriting existing output files. Transfer size is at most 25 MiB per file. Native OAuth still handles sign-in/signup/consent; normal work does not require the Studio UI. Resource-aware hosts may retain the existing embedded-file path. Hosts without permitted shell/filesystem input need that compatible resource path or an explicit limitation; remote MCP alone cannot write their disks.

This release does not yet expose paid confirmation or multiple creative creation in one project. These limits must not be described as a fully autonomous campaign implementation. Tests of the protocol and helper are not proof of a live Codex UI run.
