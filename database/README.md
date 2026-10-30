# Attendance history prototype

This adds persistent history without accounts, roles, or additional tables. Student
selection is public demonstration filtering, not private or authenticated access.
Use synthetic data. The existing live WebSocket broadcast is unchanged.

## Setup

1. Review `schema.sql` and run it in your Supabase project's SQL editor. It creates
   one table and two server-only functions. It refuses to overwrite an incompatible
   existing table (including the earlier `recorded_by` schema). Review a separate
   data-preserving migration if such a table exists; do not drop historical data.
2. Copy `.env.example` to a local ignored `.env`. Configure `SUPABASE_URL`, a
   `SUPABASE_SECRET_KEY` (new secret key or legacy service-role key), and a long
   random `ATTENDANCE_PUBLISH_PASSPHRASE` of at least 20 characters. Keep them
   server-only: never use a `VITE_` prefix for the secret or passphrase. Never put
   them in source control. The previous browser publishable-key client is not
   used by this feature.
3. Run `npm run dev`. The existing Vite server mounts `/api/attendance` separately
   from its unchanged WebSocket plugin. Restart after changing private settings.
   Without configuration, history fails closed with a clear error; live attendance
   remains independent.

Use Node.js 22 or newer, as required by the Supabase dependency.

## Teacher flow

Process the current masterlist and screenshot successfully, choose the class date,
enter the publishing passphrase, and click the existing Publish Attendance button.
The compiler's existing Present/Absent rules and live masterlist/OCR fields are preserved.
The live payload also includes the selected `attendanceDate` as a `YYYY-MM-DD`
calendar string, matching the date saved in history without timezone conversion.
History requires completed processing of the current screenshot/masterlist, so
an empty, failed, pending or stale analysis is not silently stored as attendance.
A valid completed analysis with no accepted faces can still save all-Absent rows.

One session UUID, selected date, and last successfully saved date are stored in
this browser's local storage, never the passphrase. Refreshing retains that session
and its date safeguard for retries. Republishing the same session and date replaces
its entire snapshot atomically, preserves IDs for retained students, removes
obsolete rows, and obtains one shared timestamp from PostgreSQL. Concurrent writes
for the same session serialize. A failed transaction keeps the previous snapshot.
Publishing a different date under a saved session prompts to start a New Session
instead; cancelling stops both the live publication and history request. Confirming
generates a new UUID and keeps the selected date. Older saved browser state without
a confirmed save date conservatively protects its restored date too.
Click New Session for another meeting; it generates a new UUID and keeps the selected date. Local storage must
be available to retain an unpublished session across reloads. Copy the displayed
session identifier before clearing browser storage.

The passphrase input is cleared when publishing. A save failure is reported beside
Publish; retry using the same session. Live sending is not gated on the database,
and saving is not gated on an open WebSocket.

## Student flow

Open `student-portal.html`, choose a saved student, and view records in Attendance
History. Refresh History reloads names and records; Load More pages older records.
The selected name is remembered locally. Reads never update attendance. History
uses stored class dates and session IDs, not the student's current date. Attendance
Today continues receiving attendance through the existing WebSocket relay. Messages
without `attendanceDate` retain the previous local-current-date display.

## Security boundary

The HTTP server checks a publish passphrase, rejects cross-origin publishing,
validates names/status/date/UUID and bounded payloads, and returns sanitized errors.
Use HTTPS when hosted. There is no client-side embedded password and no account
management. Anyone who knows the shared publishing passphrase can publish; it is
not teacher identity verification. GET history is intentionally public demo data.

RLS stays enabled. `anon`, `authenticated`, and `PUBLIC` have no direct table or
RPC privileges. Only the server service role can read/write through the narrow
HTTP handlers. Supabase secrets bypass RLS, so the server authorization is essential.
Do not import `server/attendanceApi.js` or `api/attendance.js` from frontend code.
The API exposes no arbitrary SQL, delete endpoint, user administration, or keys.

## Vercel

`api/attendance.js` is a thin Node serverless adapter using the same protected
handler as Vite. Set the three private variables in Vercel's project environment,
optionally set `ATTENDANCE_APP_ORIGIN` to the exact HTTPS origin (no trailing slash),
and apply the reviewed schema to the target Supabase project. The Vite build emits
both teacher and student HTML entry points. No Vite development server runs in the
production build. The adapter provides HTTP persistence/history only: hosting the
preexisting live WebSocket service in production is a separate existing deployment
requirement; this change does not redesign or replace that service.

Live Supabase/Vercel verification requires those settings and a deployment. Local
integration evidence must not be described as a successful remote deployment.
