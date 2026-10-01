---
name: formatry-api
description: Create advertising images from product photos and brand copy, adapt designs for posts, stories and banners, and edit saved Formatry creatives.
---

# Formatry API

Use the bundled hosted `formatry-api` MCP tools for Formatry previews and saved Studio creative workflows. Local stdio is a developer-only opt-in and is not the plugin default.

## Workflow

1. Call `formatry_connection_status` first.
2. If authentication is missing, tell the user to complete the MCP client's native OAuth sign-in. In Codex, `codex mcp login formatry-api` starts that flow. Only mention a scoped key at `/studio/settings/developer` when the user explicitly chose the manual API-key compatibility path; never ask them to paste the secret.
3. Call `formatry_check_balance` and `formatry_get_preview_quota` before generation or preview work.
4. Call `formatry_list_assets` and use ready assets already uploaded in Studio. If the source is only a local Codex attachment, direct the user to upload it in Studio Files, then list assets again. A regular Codex MCP connection does not convert local files into OpenAI file objects. Only when a compatible host supplies an authorized file object containing `download_url` and `file_id`, use `formatry_upload_asset_file` and retain the returned `assetId`; never invent that object or its URL.
5. Create one bounded preview with `formatry_create_preview` and a stable idempotency key. Stop on exhausted quota until the returned reset time.
6. For a saved Studio creative, read its exact revision and propose one typed edit. Apply it with `formatry_apply_studio_command` only after the user confirms it.
7. Create an exact-revision preview with `formatry_create_studio_creative_preview`.
8. Read the saved creative revision, call `formatry_create_studio_export_quote` with `current` or `selected` output scope, and show the output set, `billingMode`, `freeUnits` and `freeRemaining`. After the user confirms a free raster quote, call `formatry_confirm_studio_export_quote` with the server-issued quote id and a stable idempotency key. Follow `job.id` through `formatry_wait_for_generation_job`, require a ready `formatry_get_artifact_manifest`, and return each requested file with `formatry_download_artifact_file`. Paid quotes use the upgrade/payment path in Studio; the hosted confirmation must reject them without debiting credits. No raw generation, pricing, provider or render fields are accepted.

## Boundaries

- This plugin supports raster advertising images only. Do not create, preview, edit or export video, App Store packs, review documents or editable vector outputs. Choose a raster creative instead.

- Do not call internal Formatry admin, payment, worker, renderer, or storage routes.
- Do not print API keys, signed upload URLs, signed download URLs, cookies, or payment data.
- Do not store raw IP addresses, user agents, client markers, temporary trial secrets, or signed URLs in evidence.
- A preview is not a downloadable deliverable. Require a succeeded generation job and ready artifact manifest before returning raster files. Never confirm a paid quote or spend credits through the hosted tools.
- Do not use local filesystem paths, the local trial tool, or the local download tool unless the user explicitly selected the developer-only stdio server.
