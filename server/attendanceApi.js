import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const MAX_BYTES = 256 * 1024;
const PAGE_SIZE = 50;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = value => createHash('sha256').update(value).digest();
const problem = (status, message) => Object.assign(new Error(message), { status });
function isServerKey(key) {
  if (typeof key !== 'string') return false;
  if (key.startsWith('sb_secret_')) return true;
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'service_role'; }
  catch { return false; }
}

async function readBody(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    throw problem(415, 'Use application/json.');
  }
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BYTES) throw problem(413, 'Attendance request is too large.');
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body)) > MAX_BYTES) {
    throw problem(413, 'Attendance request is too large.');
  }
  try { return typeof body === 'string' ? JSON.parse(body) : body; }
  catch { throw problem(400, 'Invalid JSON.'); }
}

function snapshot(body) {
  const { session_id, attendance_date, records } = body || {};
  if (!uuid.test(session_id || '') || !/^\d{4}-\d{2}-\d{2}$/.test(attendance_date || '')
    || !Number.isFinite(Date.parse(attendance_date))
    || new Date(attendance_date).toISOString().slice(0, 10) !== attendance_date) {
    throw problem(400, 'Choose a valid session and attendance date.');
  }
  if (!Array.isArray(records) || records.length < 1 || records.length > 1000) {
    throw problem(400, 'A complete nonempty class snapshot is required.');
  }
  const names = new Set();
  const cleaned = records.map(row => {
    if (!row || typeof row.student_name !== 'string' || !['Present', 'Absent'].includes(row.status)) {
      throw problem(400, 'Invalid student name or attendance status.');
    }
    const name = row.student_name.trim();
    if (!name || name.length > 200 || names.has(name)) throw problem(400, 'Empty or duplicate student name.');
    names.add(name);
    return { student_name: name, status: row.status };
  });
  return { p_session_id: session_id, p_attendance_date: attendance_date, p_records: cleaned };
}

// Imported only by server entry points. No credentials or client flow enter the browser bundle.
export function createAttendanceHandler(getConfig = () => process.env) {
  let client; let previousUrl; let previousKey;
  return async function attendanceHandler(req, res) {
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(JSON.stringify(body));
    };
    try {
      const method = req.method || 'GET';
      if (!['GET', 'POST'].includes(method)) {
        res.setHeader('Allow', 'GET, POST'); throw problem(405, 'Method not allowed.');
      }
      const config = getConfig();
      if (method === 'POST') {
        const expected = config.ATTENDANCE_PUBLISH_PASSPHRASE;
        if (typeof expected !== 'string' || expected.length < 20) {
          throw problem(503, 'History publishing is not configured on this server.');
        }
        const authorization = String(req.headers.authorization || '');
        const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
        if (!timingSafeEqual(digest(supplied), digest(expected))) throw problem(403, 'Publishing passphrase was not accepted.');
        const origin = req.headers.origin;
        if (origin) {
          const allowed = config.ATTENDANCE_APP_ORIGIN;
          if (allowed ? origin !== allowed : new URL(origin).host !== req.headers.host) {
            throw problem(403, 'Cross-origin publishing is not allowed.');
          }
        }
      }
      const url = config.SUPABASE_URL;
      const key = config.SUPABASE_SECRET_KEY;
      if (!url || !isServerKey(key)) {
        throw problem(503, 'Attendance history storage is not configured.');
      }
      if (!client || previousUrl !== url || previousKey !== key) {
        client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(10000) }) },
        });
        previousUrl = url; previousKey = key;
      }
      if (method === 'POST') {
        const params = snapshot(await readBody(req));
        const { data, error } = await client.rpc('publish_attendance_session', params);
        if (error) throw problem(503, 'The session was not saved. Retry with the same session ID.');
        const saved = data?.[0];
        if (!saved || Number(saved.saved_count) !== params.p_records.length) {
          throw problem(503, 'The server could not confirm a complete save. Retry with the same session ID.');
        }
        send(200, { saved_count: Number(saved.saved_count), published_at: saved.publication_time });
      } else {
        const query = new URL(req.url, 'http://attendance.local').searchParams;
        if (query.get('students') === '1') {
          const { data, error } = await client.rpc('attendance_student_names');
          if (error) throw problem(503, 'Saved student names could not be loaded.');
          send(200, { students: (data || []).map(row => row.student_name) });
        } else {
          const name = query.get('student');
          const offset = Number(query.get('offset') || 0);
          if (!name || name.length > 200 || !Number.isSafeInteger(offset) || offset < 0 || offset > 1000000) {
            throw problem(400, 'Select a student and a valid history page.');
          }
          const { data, error } = await client.from('attendance_records')
            .select('id,session_id,student_name,status,attendance_date,published_at')
            .eq('student_name', name).order('attendance_date', { ascending: false })
            .order('published_at', { ascending: false }).order('id', { ascending: false })
            .range(offset, offset + PAGE_SIZE);
          if (error) throw problem(503, 'Attendance history could not be loaded.');
          send(200, { records: (data || []).slice(0, PAGE_SIZE), has_more: (data || []).length > PAGE_SIZE });
        }
      }
    } catch (error) {
      // Do not expose Supabase responses, environment values, or credentials.
      send(error.status || 503, { error: error.status ? error.message : 'Attendance history is temporarily unavailable.' });
    }
  };
}
