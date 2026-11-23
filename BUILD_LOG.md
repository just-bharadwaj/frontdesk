# Build log — November 21, 2026

Built with Codex from the supplied application plan and dashboard image.

- Translated the healthcare demo brief into a bounded synthetic workflow: appointments, refill requests and staff handoffs.
- Created a React/TypeScript dashboard inspired by the provided blue-and-white clinical ERP layout.
- Added a deterministic browser engine and a Python FastAPI/Pydantic/SQLite reference implementation. Chose explicit simulation labels instead of claiming live AI behavior without a model connection.
- Browser QA caught an effect that implicitly returned the browser's scroll operation. This produced a React cleanup error after a chat turn. Fixed the effect to return nothing; reran booking through confirmation and inspected its trace.
- Review caught cancellation claiming success with no existing appointment. Added an initial synthetic Alex appointment and guards for absent appointments.
- Local API UI testing caught an initialization fetch overwriting a just-created session. Changed snapshot loading to merge concurrent conversations.
- Added eight frontend engine invariants and 40 Python checks. All passed locally; production frontend build succeeded.
- Tested desktop and phone layout. Phone content fits the viewport without horizontal document overflow.
- No application submission, profile editing, email or external clinical action was performed.
