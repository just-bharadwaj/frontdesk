# FrontDesk improvement roadmap

FrontDesk currently demonstrates deterministic patient-access workflows. This roadmap describes proposed work, not shipped capabilities.

## 1. Connect a model without giving it unchecked authority

Add a server-side LLM adapter that proposes typed tool calls. Keep identity checks, patient/session ownership, confirmation requirements and mutations under backend control. Treat model output and EHR content as untrusted input. Add live-model evaluations for paraphrases, incomplete information, prompt injection and tool failures.

**Done when:** a real model completes booking/refill flows through the existing validation layer, cannot bypass verification, and never reports a mutation that did not succeed.

## 2. Add inbound phone calls

Connect a voice-capable Twilio number and a realtime voice model to the same tool router. Implement verified inbound webhooks, call/session mapping, duplicate-event handling, interruption support, silence timeouts, and a configured human transfer/fallback path.

**Done when:** a caller can verify the synthetic identity, select and confirm an appointment, and see the result in the staff dashboard. Failed calls and unavailable staff have a tested fallback. Voice is not currently connected.

## 3. Deploy a shared backend

Host FastAPI with HTTPS and any required WebSocket support. Move from demo-local SQLite to a managed relational database with migrations, backups and transactional constraints. Persist conversation/audit history, add timestamps and retention controls, and make webhook actions idempotent.

**Done when:** two browser sessions share the same state, a backend restart preserves audit history, and concurrent calls cannot double-book a slot.

## 4. Strengthen access control and identity

Add authenticated staff sessions, role-based permissions, server-side ownership checks, rate limits and session expiry. Replace public name/DOB fixtures with an identity workflow appropriate for the actual deployment. Separate staff and patient-facing endpoints.

**Done when:** unauthenticated users cannot read staff records, one patient cannot access another patient's actions, and sensitive operations are audited.

## 5. Improve evaluation and product usability

- Consolidate shared workflow contracts or add parity tests for the browser and Python implementations.
- Add browser end-to-end tests in CI for booking, cancellation, refill routing, and failure handling.
- Add richer date/timezone handling, same-day scheduling, empty availability and provider preferences.
- Improve dialog focus trapping, keyboard navigation, screen-reader support and contrast checks.
- Add structured output schemas for each individual tool, durable tool IDs and richer failure categories.
- Expand language and adversarial test datasets; evaluate model regressions separately from deterministic code tests.
- Add measured latency, cost and reliability reporting once real providers are connected.

**Done when:** CI verifies key user journeys, accessibility checks pass, and model changes have explicit regression gates.

## 6. Replace the mock EHR with a sandbox integration

Implement an adapter for an authorized EHR developer sandbox. Add OAuth/token lifecycle support, resource mapping, pagination, retries, error classification and external identifier handling. Do not claim athenaOne compatibility until tested against the actual API.

**Done when:** appointments and refill requests reconcile correctly against the sandbox and failure recovery is tested.

## Before any real-patient use

The public demo accepts synthetic data only. Real use requires a separate assessment covering appropriate agreements/BAAs, access controls, encryption, audit retention, incident response, clinical workflow review, provider/service eligibility, and operational ownership. A working demo is not evidence of compliance or clinical safety.
