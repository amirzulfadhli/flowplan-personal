# Project-specific local AI

Phase 4 adds an optional **AI** tab to each project. It has no global chatbot, background generation, cloud provider, telemetry, model download, or autonomous task execution. Existing browser IndexedDB, desktop SQLite, JSON backups, and the floating companion remain independent of AI availability.

## Setup and use

1. Install and run Ollama separately, with a local text model downloaded for your hardware. FlowPlan does not install Ollama or download models.
2. Set `OLLAMA_NO_CLOUD=1` for Ollama and restart it to disable its cloud features. On Windows, Ollama inherits the user's environment; see the [official configuration instructions](https://docs.ollama.com/faq#how-do-i-disable-ollamas-cloud-features).
3. Open a project → **AI** → **Enable local AI for this project**. Enabling alone sends nothing. The default address is `http://127.0.0.1:11434`.
4. Select **Find local models**, then a local model. Discovery sends no project data. Only installed models with local GGUF metadata are offered. Remote/cloud aliases and unverifiable models are rejected; text completion support is checked before generation.
5. Choose Summary, Priorities, Blockers, or Task breakdown. Optionally enter a question. Open **Review project context before sending** to inspect the exact selected-project data shape.
6. Select **Generate suggestions**. Read the answer and concise evidence-based reasoning summary. Select proposed actions, inspect the current/proposed fields, and choose **Approve and save selected actions** in the confirmation dialog. Nothing changes before that final approval.

Endpoint and model preferences are saved only in this application's local WebView/browser storage. Enabling AI and responses are session state: leaving the AI tab or project cancels an outstanding request and discards the response. There is no shared chat history or cross-project memory. Connection preferences are not part of workspace JSON backups.

Supported connections are HTTP loopback `127.0.0.1`, `localhost` (normalized to `127.0.0.1`), and `[::1]`, with a configurable port. LAN hosts, arbitrary hostnames, cloud URLs, credentials, URL paths, and redirects are disallowed. HTTP is used only on loopback; exposing an unauthenticated Ollama server to a network is not required.

Browser requests also obey the browser's CORS and local-network rules. If needed, configure `OLLAMA_ORIGINS` with the exact FlowPlan origin, such as `http://127.0.0.1:4173`, then restart Ollama. Do not use a wildcard to solve an origin error. Some hosted HTTPS browsers may require local-network permission or block the request; the desktop build avoids browser CORS by using its native transport. Core productivity features remain available when AI cannot connect.

## Data boundary

The context contains the selected project's name, description, deadline, saved notes, all of its tasks and their completion state, derived completion counts, and at most 30 recent project activity entries. Omitted activity is counted explicitly. It excludes the profile, other projects, their tasks/activity, recovery backups, companion timer, files, credentials, and previous requests. Text in notes is untrusted content, not a source of executable instructions.

Contexts over 60 KB are rejected visibly rather than silently removing tasks or notes. Questions are limited to 2,000 characters. The request asks for bounded structured JSON with at most eight proposals, a short reasoning summary, no tools, and no thinking trace. Raw thinking is not shown. Model content is rendered as plain React text, never HTML, script, or executable Markdown.

Loopback and model metadata checks reduce accidental cloud use, but the local Ollama service remains a trusted dependency: FlowPlan cannot prove that a custom or malicious daemon never relays data. Run the official daemon in local-only mode. Ollama's own installation, updates, model pulls, and logging policies are managed separately from FlowPlan.

## Architecture and approval safety

- `src/ai/protocol.ts` selects browser context and validates responses/proposals; `prompt.json` shares the request instructions and JSON schema with Rust.
- `src/ai/client.ts` separates browser Fetch from native IPC. Browser requests omit credentials, referrers, cache, and redirects. Rust's HTTP client disables proxies and redirects and accepts only fixed Ollama API paths.
- `src-tauri/src/ai.rs` reads SQLite itself using a selected project ID and reviewed workspace revision. It never accepts a frontend-supplied workspace/prompt. Only the main window has the three AI command capabilities; the companion has none. The WebView CSP is unchanged.
- The native cancellation registry bounds outstanding requests. Cancellation drops the HTTP future, closes the request, and prevents late answers from entering the panel. Browser AbortController has the same behavior. Discovery is limited to 15 seconds, generation to three minutes, and received JSON to 1 MB. No request automatically retries or downloads a missing model.
- `approveAiActions` is an explicit domain command. It revalidates the selected actions, fixes their project ID to the current project, rejects unknown/duplicate/out-of-project update IDs, and applies the selected batch in one existing repository transaction. SQLite revisions are compared again at commit. Approval never rebases onto a competing write; regenerate and review after any workspace change.

Tasks and activity created by approval use the same domain validation and timestamps as manual edits. No database migration or workspace JSON schema change is needed: SQLite stays at version 3, JSON at version 1. Advice alone has no effect on progress or analytics.

## Limits and troubleshooting

No AI response is guaranteed correct. Small models may return invalid JSON, unsupported fields, or inaccurate advice; FlowPlan rejects unsafe structure and displays the error without saving tasks. A model that cannot disable thinking or produce structured chat may be incompatible. Model quality and latency depend on the chosen model, context size, RAM, and GPU; the 16K requested context window is not a guarantee that every model retains every token.

Cancellation disconnects FlowPlan and discards the result; Ollama may take a short time to stop work or free resources. Completed requests ask Ollama to retain the model for one minute. There is no streaming answer, persistent AI history, embeddings, retrieval index, task deletion proposal, remote provider, or AI companion control in this phase.

Tests use a deterministic loopback Ollama protocol fixture, explicitly isolated from personal data. They establish transport, privacy, approval, cancellation, and persistence behavior; they do not measure real model reasoning quality. See [Phase 4 verification](phase-4-verification.md).

Phase 5 also tested the actual local `qwen3:1.7b` model on CPU with synthetic projects. After prompt refinement it produced accepted advice and task breakdowns, and approval/cancellation checks passed. One priorities explanation still misstated a task status. Treat this small model as experimental and review the stored facts and proposed fields; see [actual-model results and timings](phase-5-verification.md). `npm run audit:local-model` repeats that opt-in audit against an already installed model and never downloads one.

Protocol references: [Ollama chat API](https://docs.ollama.com/api/chat), [model listing](https://docs.ollama.com/api/tags), and [upstream OpenAPI model metadata](https://github.com/ollama/ollama/blob/main/docs/openapi.yaml).
