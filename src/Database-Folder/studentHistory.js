export function initializeStudentHistory() {
  const selector = document.getElementById('history-student');
  const refresh = document.getElementById('history-refresh');
  const more = document.getElementById('history-more');
  const history = document.getElementById('attendance-history');
  const message = document.getElementById('history-status');
  if (!selector || !history) return;
  let generation = 0;
  let offset = 0;

  async function loadHistory(append = false) {
    const selected = selector.value;
    const current = ++generation;
    more.hidden = true;
    if (!append) { offset = 0; history.replaceChildren(); }
    if (!selected) { message.textContent = 'Select a student to view saved attendance.'; return; }
    message.textContent = 'Loading saved attendance…';
    try {
      const query = new URLSearchParams({ student: selected, offset: String(offset) });
      const response = await fetch(`/api/attendance?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'History could not be loaded.');
      if (current !== generation) return;
      for (const record of data.records) {
        const line = document.createElement('p');
        line.textContent = `${record.attendance_date}: ${record.student_name}, ${record.status} — Session ${record.session_id} — Published ${new Date(record.published_at).toLocaleString()}`;
        history.appendChild(line);
      }
      offset += data.records.length;
      more.hidden = !data.has_more;
      message.textContent = offset ? 'Saved records. Student selection is demonstration filtering, not private access.' : 'No saved attendance for this student.';
      try { localStorage.setItem('attendance-history-student', selected); } catch { /* Optional selection preference only. */ }
    } catch (error) {
      if (current === generation) message.textContent = `History unavailable: ${error.message}`;
    }
  }

  async function loadStudents() {
    const current = ++generation;
    refresh.disabled = true;
    more.hidden = true;
    message.textContent = 'Loading saved students…';
    let preferred = selector.value;
    try { preferred ||= localStorage.getItem('attendance-history-student') || ''; } catch { /* Optional. */ }
    try {
      const response = await fetch('/api/attendance?students=1', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Students could not be loaded.');
      if (current !== generation) return;
      selector.replaceChildren();
      const placeholder = document.createElement('option');
      placeholder.value = ''; placeholder.textContent = 'Select a student'; selector.appendChild(placeholder);
      for (const name of data.students) {
        const option = document.createElement('option'); option.value = name; option.textContent = name;
        selector.appendChild(option);
      }
      if (data.students.includes(preferred)) selector.value = preferred;
      await loadHistory();
      if (!data.students.length) message.textContent = 'No published attendance has been saved yet.';
    } catch (error) {
      if (current === generation) message.textContent = `History unavailable: ${error.message}. Attendance Today still uses the live connection.`;
    } finally { refresh.disabled = false; }
  }
  selector.addEventListener('change', () => loadHistory());
  refresh.addEventListener('click', loadStudents);
  more.addEventListener('click', () => loadHistory(true));
  loadStudents();
}
