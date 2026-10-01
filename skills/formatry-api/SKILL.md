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
4. Call `formatry_list_assets` to reuse suitable ready assets. For user-authorized local sources, use the native file workflow below. A remote MCP server cannot read local paths. Only when a compatible host supplies an authorized file object containing `download_url` and `file_id`, use `formatry_upload_asset_file`; never invent that object or its URL.
5. Create one bounded preview with `formatry_create_preview` and a stable idempotency key. Stop on exhausted quota until the returned reset time.
6. For a new campaign, call `formatry_start_creative` with the requested project name, an optional first-creative name and a stable idempotency key. Retain the returned ids. It creates saved design data only, not a render or export. Read the new creative, then continue with typed operations. Existing grants may need native reauthorization for `projects:write`; never bypass a scope refusal. For a saved Studio creative, read its exact revision and propose one typed edit. Apply it with `formatry_apply_studio_command` when the user has authorized that edit. An explicit instruction to make an ordinary edit supplies authorization; a request to propose or inspect does not. Honor an explicit request to wait for separate confirmation.
7. Create an exact-revision preview with `formatry_create_studio_creative_preview`.
8. Read the saved creative revision, call `formatry_create_studio_export_quote` with `current` or `selected` output scope, and show the output set, `billingMode`, `freeUnits` and `freeRemaining`. After the user confirms a free raster quote, call `formatry_confirm_studio_export_quote` with the server-issued quote id and a stable idempotency key. Follow `job.id` through `formatry_wait_for_generation_job`, require a ready `formatry_get_artifact_manifest`, and save each requested file with the native download workflow below. Compatible resource-aware hosts can instead use `formatry_download_artifact_file`. Non-free quotes can use formatry_confirm_included_export only with an exact approvedUnits value and an existing included subscription/unlimited allowance. Included subscription exports cannot debit purchased-credit balances. If that allowance is unavailable, explain the entitlement limit without initiating checkout or promoting an upgrade. No raw generation, pricing, provider or render fields are accepted.

## Boundaries

- This plugin supports raster advertising images only. Do not create, preview, edit or export video, App Store packs, review documents or editable vector outputs. Choose a raster creative instead.

- Do not call internal Formatry admin, payment, worker, renderer, or storage routes.
- Do not print API keys, signed upload URLs, signed download URLs, cookies, or payment data.
- Do not store raw IP addresses, user agents, client markers, temporary trial secrets, or signed URLs in evidence.
- A preview is not a downloadable deliverable. Require a succeeded generation job and ready artifact manifest before returning raster files. Never initiate checkout, purchase credits/subscriptions or use purchased-credit balances through the hosted tools. Included subscription quota requires the exact authorized quote and the separate included-export tool.
- Pass local paths only to the bundled helper under the host's ordinary filesystem and execution permissions. Never put local paths into remote MCP arguments. The local trial tool and developer-only stdio server are not part of this workflow.


## Native files in Codex

Use the bundled `scripts/formatry-files.mjs` relative to this skill's directory. Resolve that installed path; do not download or rewrite the helper. It requires Node 22+ and the client's permitted shell/filesystem tools, not a local MCP server. Execute with the user's selected workspace as the current directory. Respect host permission refusals. If shell/files are unavailable, report that limit rather than claiming delivery.

For input files:
Resolve user attachments through the host's supported attachment/materialization tools first. Verify that actual readable bytes are present in the selected workspace. If an authorized source exists elsewhere, use permitted host file tools to copy it into that workspace; do not broaden the helper root, escape through symlinks, invent a download URL, or mistake an attachment id for a filesystem path. Report an actual materialization blocker precisely.

1. Run `node <skill-directory>/scripts/formatry-files.mjs inspect <workspace-relative-source>` to obtain the exact filename, MIME type, byte length, SHA-256 and supported dimensions. Never read account credentials or Codex authentication storage.
2. Call `formatry_prepare_asset_upload` with that metadata, a supported asset slot and a stable idempotency key. The source must be user-authorized for upload to Formatry. No local path, public URL or file contents belong in MCP arguments.
3. Run the helper's `upload <workspace-relative-source>` command with the returned `transfer` object as JSON on stdin through the client's supported input mechanism. Do not put tickets in command-line arguments, environment variables, saved scripts, user-facing messages, logs or files; never display the transfer object to the user. Use the host's supported process-input mechanism; do not echo the input. MCP and execution tool records may retain this short-lived capability, so it must never grant reusable account access. The helper checks the source has not changed and sends bytes only to Formatry.
4. After `status: uploaded`, call `formatry_complete_asset_upload` using the original uploadId, assetId, byteLength, sha256 and a stable completion idempotency key. Keep the returned ready asset id for binding. A prepared intent alone is not a completed upload.

For outputs:
1. Require the existing job to succeed and its artifact manifest to be ready. Select only the requested file ids.
2. Call `formatry_prepare_artifact_download` for one file, then run `download <workspace-relative-output>` with its transfer object on stdin as above. Choose a new output filename; the helper never overwrites existing files.
3. Require `status: saved` and the verified SHA-256/byteLength, then open or inspect the actual local file with the host's supported tools. Deliver the saved artifact using the host's native file presentation. A manifest, private URL or planned path is not a delivered file.

Each transfer is purpose-bound, expires within two minutes, is limited to 25 MiB, and is rechecked against active account/OAuth authorization. On `TRANSFER_EXPIRED` or `TRANSFER_EXPIRED_OR_REVOKED`, prepare the same file once again through MCP. If authorization is denied, follow native OAuth recovery; do not loop or ask for secrets. Other integrity errors require inspecting the source/result, not silently recreating generation. For larger archives use individual manifest files within the limit. Keep existing quote, revision, idempotency, quota and paid-spend protections.

## Own a campaign through delivery

When the user asks for a finished campaign, continue through the authorized steps instead of stopping after a proposal, job id or preview. Use their objective, audience, source assets, brand, requested channels/formats, copy and output count. Ask only for a missing decision that materially changes the work; otherwise state a reasonable assumption and proceed. A request to propose only, or to wait for a separate confirmation, still limits execution.

- Reuse account-owned assets and Brand Kit/presets when relevant; preserve exact source fingerprints. Never invent unavailable source images or licensing rights.
- Start or resume the correct saved creative. Keep the returned project/creative ids, exact revision, operation idempotency keys, quote id, job id and artifact/file ids. If the host permits saving run state, keep only these non-secret references and user-facing output paths in the selected workspace. Never save credentials, capabilities or signed URLs. After interruption, read current state and resume the existing job before creating anything new.
- Apply cohesive typed design operations within the tool schema. Read back the creative after mutation. On revision conflict, read the new state and reconcile the user's intent; never silently force an older document over it.
- Check the whole preview: copy, clipping, brand assets, CTA, contrast, spacing, hierarchy and the requested aspect ratios. Preview a representative output for each distinct layout and inspect actual pixels with host tools. Fix concrete defects within scope, without generating unrequested variants or burning allowance on endless retries.
- Quote exactly the requested free raster output set. An explicit user authorization to produce that bounded free set can cover its confirmation; show the real allowance and obtain a decision if output count, cost or requested scope changes. If the user specifically asked for proposal → separate confirmation (including a reviewer demo), preserve that sequence. For non-free terms, use the separate included-export tool only when the requested set is already covered by the account's subscription quota/unlimited entitlement. Explain unavailable access without promoting an upgrade.
- Follow each accepted job to a terminal state with returned polling guidance. Retry transient reads with bounded backoff. Never create a replacement job merely because a read timed out. Surface a terminal failure with its safe code and retain the original identifiers for recovery.
- Save every requested ready file, verify it, inspect the result, and present the actual deliverables in the host. Summarize filenames/formats, successful output count and any unresolved limitation. Do not claim a campaign is complete while a requested output is missing or unverified.

For several independent concepts in one campaign, call `formatry_add_creative` for each requested named concept using the same projectId and a distinct stable creation key. It creates a blank raster creative; configure it with typed operations and a current revision. Retrying the same name/key returns the existing creative and its current revision without resetting later edits. A renamed or archived target returns a conflict with its ids for inspection; do not silently create a duplicate or reactivate it. This tool does not clone an existing design. Multiple output sizes within one concept use supported per-size configuration and selected-output export.

## Existing included subscription exports

For a non-free raster quote, inspect the account's current subscriptionQuota and unlimited entitlement. Only if the user's authorized output set is covered by that already-existing allowance, call `formatry_confirm_included_export` with the exact quote id, its creditsRequired as approvedUnits, and a stable idempotency key. Explain the quoted units and obtain approval if the user's request did not already authorize that bounded quota use. This consumes subscription allowance only; it never falls back to any credit balance. An unlimited entitlement creates the existing job without a debit. A stale or insufficient allowance fails without a new job or charge. Do not silently substitute this route for an explicitly free-only request.

If no included entitlement covers the request, explain that the feature is unavailable with the current allowance. Do not display plans, promote upgrades, sell credits, create subscriptions, initiate checkout or link to transactional billing pages. Buying new access is not part of this plugin. The user may independently manage their account outside the plugin; do not direct a purchase flow. Preserve explicit separate confirmations requested for review demos and all host safety requirements.
