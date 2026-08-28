---
name: formatry-api
description: Use when a Codex task needs a novice-safe visual workflow through Formatry's hosted MCP, from connection and file upload through a protected preview and Studio handoff.
---

# Formatry API

Use the bundled hosted `formatry-api` MCP tools for Formatry previews and saved Studio creative workflows. Local stdio is a developer-only opt-in and is not the plugin default.

## Workflow

1. Call `formatry_connection_status` first.
2. If authentication is missing, tell the user to create a scoped key at `/studio/settings/developer` and set `FORMATRY_CC_API_KEY` outside chat. Never ask them to paste the secret.
3. Call `formatry_check_balance` and `formatry_get_preview_quota` before generation or preview work.
4. Upload only the OpenAI-authorized file supplied by the user with `formatry_upload_asset_file`; keep the returned `assetId` for the next call.
5. Create one bounded preview with `formatry_create_preview` and a stable idempotency key. Stop on exhausted quota until the returned reset time.
6. For a saved Studio creative, read its exact revision and propose one typed edit. Apply it with `formatry_apply_studio_command` only after the user confirms it.
7. Create an exact-revision preview with `formatry_create_studio_creative_preview`, then request a visible export quote with `formatry_create_studio_export_quote`.
8. Stop at the Studio handoff. Paid confirmation and export happen visibly in Studio; the hosted MCP must not confirm payment, start paid export, or debit credits.

## Boundaries

- Do not call internal Formatry admin, payment, worker, renderer, or storage routes.
- Do not print API keys, signed upload URLs, signed download URLs, cookies, or payment data.
- Do not store raw IP addresses, user agents, client markers, temporary trial secrets, or signed URLs in evidence.
- Do not claim a paid export or deliverable exists from a preview or quote; require the user to confirm and export in Studio.
- Do not use local filesystem paths, the local trial tool, or the local download tool unless the user explicitly selected the developer-only stdio server.
