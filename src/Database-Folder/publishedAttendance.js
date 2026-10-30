const storageKey = 'attendance-history-session-v1';
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export function initializePublishing() {
  const date = document.getElementById('attendance-date');
  const sessionLabel = document.getElementById('attendance-session');
  const nextSession = document.getElementById('attendance-new-session');
  const passphrase = document.getElementById('attendance-passphrase');
  const message = document.getElementById('attendance-save-status');
  let session;
  let saving = false;
  try { session = JSON.parse(localStorage.getItem(storageKey)); } catch { /* Storage may be disabled. */ }
  if (!session || !/^[0-9a-f-]{36}$/i.test(session.id || '') || !/^\d{4}-\d{2}-\d{2}$/.test(session.date || '')) {
    session = { id: crypto.randomUUID(), date: localDate(), lastSavedDate: null };
  } else if (!Object.hasOwn(session, 'lastSavedDate')) {
    // Older persisted sessions do not say whether saving succeeded. Protect their date conservatively.
    session.legacyDate = session.date;
    session.lastSavedDate = null;
  }
  const remember = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(session)); }
    catch { message.textContent = 'Session cannot survive refresh in this browser. Keep this page open for retries.'; }
    date.value = session.date;
    sessionLabel.textContent = session.id;
  };
  const startSession = (attendanceDate) => {
    session = { id: crypto.randomUUID(), date: attendanceDate, lastSavedDate: null };
    remember();
    message.textContent = 'New history session started. Existing saved sessions are unchanged.';
  };
  remember();
  date.addEventListener('change', () => { session.date = date.value; remember(); });
  nextSession.addEventListener('click', () => {
    if (saving) return;
    startSession(date.value || localDate());
  });

  function preparePublication() {
    if (saving) return null;
    if (!date.reportValidity()) return null;
    session.date = date.value;
    remember();
    const protectedDate = session.lastSavedDate || session.legacyDate;
    if (protectedDate && protectedDate !== session.date) {
      const explanation = session.lastSavedDate
        ? `This session was last saved for ${protectedDate}.`
        : `This restored session may already have saved records for ${protectedDate}.`;
      const startNew = window.confirm(`${explanation} Publishing ${session.date} under the same session ID would replace the previous session's records.\n\nStart a New Session for ${session.date} instead?\nOK: start a New Session and publish. Cancel: stop publishing; select ${protectedDate} to correct the existing session.`);
      if (!startNew) {
        message.textContent = `Publishing cancelled. Use New Session for ${session.date}, or select ${protectedDate} to update the existing session.`;
        return null;
      }
      startSession(session.date);
    }
    // Use one calendar-date snapshot for both live publishing and history saving.
    return { id: session.id, date: session.date };
  }

  async function savePublishedAttendance(records, ready, publication) {
    const password = passphrase.value;
    passphrase.value = '';
    if (saving) return;
    if (!ready || !records.length) {
      message.textContent = 'History not saved: finish successful processing of the current masterlist and screenshot first.';
      return;
    }
    if (!password) {
      message.textContent = 'History not saved: enter the publishing passphrase and publish again. Live attendance is independent of saving.';
      return;
    }
    saving = true;
    nextSession.disabled = true;
    date.disabled = true;
    message.textContent = 'Saving attendance history…';
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body: JSON.stringify({ session_id: publication.id, attendance_date: publication.date, records }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The session was not saved.');
      session.lastSavedDate = publication.date;
      delete session.legacyDate;
      remember();
      message.textContent = `Saved ${result.saved_count} records at ${new Date(result.published_at).toLocaleString()}. Republishing updates this session.`;
    } catch (error) {
      message.textContent = `History save failed: ${error.message}. Retry the same session; live attendance is independent of saving.`;
    } finally {
      saving = false;
      nextSession.disabled = false;
      date.disabled = false;
    }
  }
  return { preparePublication, savePublishedAttendance };
}
