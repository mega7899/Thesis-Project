// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const attendance = vi.hoisted(() => ({
  masterlist: [{ name: 'SYNTHETIC STUDENT A' }, { name: 'SYNTHETIC STUDENT B' }],
  present: [],
  ready: true,
}));
vi.mock('../src/Algorithm-Folder/studentRegister', () => ({ getMasterlistData: () => attendance.masterlist }));
vi.mock('../src/Algorithm-Folder/processImage', () => ({
  getPresentStudents: () => attendance.present,
  isAttendanceReady: () => attendance.ready,
}));
vi.mock('xlsx', () => ({ utils: {}, writeFile: vi.fn(), read: vi.fn() }));

const storageKey = 'attendance-history-session-v1';
const byId = id => document.getElementById(id);
const savedSession = () => JSON.parse(localStorage.getItem(storageKey));
let sockets;
let sessions;
let requests;
let failNextSave;
let confirm;

function mount() {
  document.body.innerHTML = `
    <input id="attendance-date" type="date" required>
    <span id="attendance-session"></span>
    <button id="attendance-new-session">New Session</button>
    <input id="attendance-passphrase" type="password">
    <p id="attendance-save-status"></p>
    <button id="shareAttendance">Publish Attendance</button>
    <div id="attendance-today"></div>
    <select id="history-student"></select>
    <button id="history-refresh">Refresh</button>
    <button id="history-more">More</button>
    <p id="history-status"></p>
    <div id="attendance-history"></div>`;
}

function selectDate(value) {
  byId('attendance-date').value = value;
  byId('attendance-date').dispatchEvent(new Event('change'));
}

async function publish(date, expectedStatus = 'Saved 2 records') {
  selectDate(date);
  byId('attendance-passphrase').value = 'synthetic-test-passphrase';
  byId('shareAttendance').click();
  await vi.waitFor(() => expect(byId('attendance-save-status').textContent).toContain(expectedStatus));
}

async function reloadTeacher() {
  vi.resetModules();
  mount();
  await import('../src/Compiler-Folder/validation.js');
}

beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  sockets = [];
  sessions = new Map();
  requests = [];
  failNextSave = false;
  attendance.present = [{ name: 'synthetic_student_a' }];
  attendance.ready = true;
  mount();
  confirm = vi.fn().mockReturnValue(false);
  vi.stubGlobal('confirm', confirm);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  class SyntheticSocket {
    static OPEN = 1;
    readyState = 1;
    sent = [];
    addEventListener() {}
    constructor() { sockets.push(this); }
    send(data) {
      this.sent.push(JSON.parse(data));
      for (const socket of sockets) {
        if (socket !== this) socket.onmessage?.({ data });
      }
    }
  }
  vi.stubGlobal('WebSocket', SyntheticSocket);
  // Synthetic API storage only: no real server, credentials, or Supabase records are used.
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const reply = (body, ok = true) => ({ ok, json: async () => body });
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      requests.push(body);
      if (failNextSave) {
        failNextSave = false;
        return reply({ error: 'Synthetic save failure' }, false);
      }
      const records = body.records.map(record => ({
        ...record, session_id: body.session_id, attendance_date: body.attendance_date,
        published_at: '2026-11-01T10:00:00Z',
      }));
      sessions.set(body.session_id, records);
      return reply({ saved_count: records.length, published_at: records[0].published_at });
    }
    const records = [...sessions.values()].flat();
    const query = new URL(url, 'http://localhost').searchParams;
    if (query.get('students')) return reply({ students: [...new Set(records.map(row => row.student_name))] });
    return reply({ records: records.filter(row => row.student_name === query.get('student')), has_more: false });
  }));
  await import('../src/Compiler-Folder/validation.js');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('published calendar date', () => {
  test('November 1 reaches both Attendance Today and Attendance History unchanged', async () => {
    await import('../src/studentPortal.js');
    await publish('2026-11-01');
    expect(sockets[0].sent[0]).toEqual({
      masterlist: attendance.masterlist, ocrAttendance: attendance.present, attendanceDate: '2026-11-01',
    });
    expect(requests[0].attendance_date).toBe('2026-11-01');
    expect(byId('attendance-today').textContent).toBe(
      '2026-11-01: SYNTHETIC STUDENT A, Present2026-11-01: SYNTHETIC STUDENT B, Absent',
    );
    byId('history-refresh').click();
    await vi.waitFor(() => expect(byId('history-student').options).toHaveLength(3));
    byId('history-student').value = 'SYNTHETIC STUDENT A';
    byId('history-student').dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(byId('attendance-history').textContent).toContain(
      `2026-11-01: SYNTHETIC STUDENT A, Present — Session ${requests[0].session_id}`,
    ));
  });

  test('legacy live messages without attendanceDate retain the local-date fallback', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    await import('../src/studentPortal.js');
    sockets[1].onmessage({ data: JSON.stringify({ masterlist: attendance.masterlist, ocrAttendance: [] }) });
    expect(byId('attendance-today').firstChild.textContent).toBe(
      `${new Date().toLocaleDateString()}: SYNTHETIC STUDENT A, Absent`,
    );
  });

  test.each(['2026-11-01', '2026-10-31', '2026-01-01', '2028-02-29'])(
    'renders calendar date %s without timezone conversion', async date => {
      await import('../src/studentPortal.js');
      sockets[1].onmessage({ data: JSON.stringify({
        attendanceDate: date, masterlist: attendance.masterlist, ocrAttendance: attendance.present,
      }) });
      expect(byId('attendance-today').firstChild.textContent).toBe(`${date}: SYNTHETIC STUDENT A, Present`);
    },
  );

  test('live publishing remains available when history saving fails', async () => {
    await import('../src/studentPortal.js');
    failNextSave = true;
    await publish('2026-11-01', 'History save failed');
    expect(byId('attendance-today').textContent).toContain('2026-11-01: SYNTHETIC STUDENT A, Present');
    expect(sessions.size).toBe(0);
  });
});

describe('session date safeguard', () => {
  test('same-session, same-date corrections reuse the ID and replace the synthetic snapshot', async () => {
    await publish('2026-11-01');
    const id = savedSession().id;
    attendance.present = [{ name: 'SYNTHETIC STUDENT B' }];
    await publish('2026-11-01');
    expect(confirm).not.toHaveBeenCalled();
    expect(requests.map(row => row.session_id)).toEqual([id, id]);
    expect(sessions.size).toBe(1);
    expect(sessions.get(id)).toHaveLength(2);
    expect(sessions.get(id).map(row => row.status)).toEqual(['Absent', 'Present']);
    expect(savedSession().lastSavedDate).toBe('2026-11-01');
  });

  test('cancelling a changed-date publish prevents both the live send and database request', async () => {
    await publish('2026-10-30');
    const id = savedSession().id;
    await publish('2026-11-01', 'Publishing cancelled');
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('would replace the previous session\'s records'));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Start a New Session for 2026-11-01'));
    expect(requests).toHaveLength(1);
    expect(sockets[0].sent).toHaveLength(1);
    expect(savedSession()).toMatchObject({ id, date: '2026-11-01', lastSavedDate: '2026-10-30' });
    expect(sessions.get(id)[0].attendance_date).toBe('2026-10-30');
    await publish('2026-10-30');
    expect(requests[1].session_id).toBe(id);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  test('confirming starts a new ID and retains all three historical dates', async () => {
    await publish('2026-10-30');
    confirm.mockReturnValue(true);
    await publish('2026-10-31');
    await publish('2026-11-01');
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(new Set(requests.map(row => row.session_id)).size).toBe(3);
    expect([...sessions.values()].map(rows => rows[0].attendance_date)).toEqual([
      '2026-10-30', '2026-10-31', '2026-11-01',
    ]);
  });

  test('the existing New Session button preserves the selected date and uses a separate ID', async () => {
    await publish('2026-10-30');
    const previousId = savedSession().id;
    selectDate('2026-11-01');
    byId('attendance-new-session').click();
    expect(savedSession()).toMatchObject({ date: '2026-11-01', lastSavedDate: null });
    expect(savedSession().id).not.toBe(previousId);
    await publish('2026-11-01');
    expect(confirm).not.toHaveBeenCalled();
    expect(sessions.size).toBe(2);
  });

  test('refresh after editing the date cannot bypass the saved-date guard', async () => {
    await publish('2026-10-30');
    const id = savedSession().id;
    selectDate('2026-11-01');
    await reloadTeacher();
    expect(byId('attendance-date').value).toBe('2026-11-01');
    await publish('2026-11-01', 'Publishing cancelled');
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(1);
    expect(savedSession()).toMatchObject({ id, lastSavedDate: '2026-10-30' });
    await publish('2026-10-30');
    expect(requests[1].session_id).toBe(id);
  });

  test('failed initial saves retain the original ID for retries across refreshes', async () => {
    const id = savedSession().id;
    failNextSave = true;
    await publish('2026-11-01', 'History save failed');
    expect(savedSession()).toMatchObject({ id, lastSavedDate: null });
    await reloadTeacher();
    await publish('2026-11-01');
    expect(requests.map(row => row.session_id)).toEqual([id, id]);
    expect(confirm).not.toHaveBeenCalled();
    expect(savedSession().lastSavedDate).toBe('2026-11-01');
  });

  test('a failed correction preserves the saved date and remains retryable', async () => {
    await publish('2026-10-30');
    const id = savedSession().id;
    failNextSave = true;
    await publish('2026-10-30', 'History save failed');
    expect(savedSession()).toMatchObject({ id, lastSavedDate: '2026-10-30' });
    await reloadTeacher();
    await publish('2026-11-01', 'Publishing cancelled');
    await publish('2026-10-30');
    expect(requests.map(row => row.session_id)).toEqual([id, id, id]);
  });

  test('older persisted sessions conservatively protect their restored date across refreshes', async () => {
    const id = savedSession().id;
    localStorage.setItem(storageKey, JSON.stringify({ id, date: '2026-10-30' }));
    await reloadTeacher();
    selectDate('2026-11-01');
    await reloadTeacher();
    await publish('2026-11-01', 'Publishing cancelled');
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('may already have saved records for 2026-10-30'));
    expect(requests).toHaveLength(0);
    await publish('2026-10-30');
    expect(requests[0].session_id).toBe(id);
    expect(savedSession()).toMatchObject({ id, lastSavedDate: '2026-10-30' });
    expect(savedSession()).not.toHaveProperty('legacyDate');
  });

  test('live-only publishing does not mark a session as saved', async () => {
    selectDate('2026-11-01');
    byId('shareAttendance').click();
    expect(byId('attendance-save-status').textContent).toContain('enter the publishing passphrase');
    expect(sockets[0].sent[0].attendanceDate).toBe('2026-11-01');
    expect(requests).toHaveLength(0);
    expect(savedSession().lastSavedDate).toBeNull();
  });

  test('a pending save blocks another publish and retains the captured date', async () => {
    let finish;
    const response = new Promise(resolve => { finish = resolve; });
    fetch.mockReturnValueOnce(response);
    selectDate('2026-11-01');
    byId('attendance-passphrase').value = 'synthetic-test-passphrase';
    byId('shareAttendance').click();
    expect(byId('attendance-date').disabled).toBe(true);
    expect(byId('attendance-new-session').disabled).toBe(true);
    byId('shareAttendance').click();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(sockets[0].sent).toHaveLength(1);
    finish({ ok: true, json: async () => ({ saved_count: 2, published_at: '2026-11-01T10:00:00Z' }) });
    await vi.waitFor(() => expect(savedSession().lastSavedDate).toBe('2026-11-01'));
    expect(byId('attendance-date').disabled).toBe(false);
  });
});
