const attendanceToday = document.getElementById('attendance-today');
const attendanceHistory = document.getElementById('attendance-history');
const logoutBtn = document.getElementById('logout-btn');

function renderTodayAttendance() {
  attendanceToday.replaceChildren();

  const date = document.createElement('p');
  const section = document.createElement('p');
  const status = document.createElement('p');

  date.textContent = `Date: ${todayAttendance.date}`;
  section.textContent = `Section: ${todayAttendance.section}`;
  status.textContent = `Status: ${todayAttendance.status}`;

  status.classList.add('attendance-status');

  attendanceToday.append(date, section, status);
}


function renderAttendanceHistory() {
  attendanceHistory.replaceChildren();

  const table = document.createElement('table');

  const headerRow = document.createElement('tr');

  const dateHeader = document.createElement('th');
  const statusHeader = document.createElement('th');

  dateHeader.textContent = 'Date';
  statusHeader.textContent = 'Status';

  headerRow.append(dateHeader, statusHeader);
  table.appendChild(headerRow);


  attendanceRecords.forEach(record => {
    const row = document.createElement('tr');

    const dateCell = document.createElement('td');
    const statusCell = document.createElement('td');

    dateCell.textContent = record.date;
    statusCell.textContent = record.status;

    row.append(dateCell, statusCell);
    table.appendChild(row);
  });

  attendanceHistory.appendChild(table);
}


logoutBtn?.addEventListener('click', () => {
  console.log('Logout clicked');
});


renderTodayAttendance();
renderAttendanceHistory();