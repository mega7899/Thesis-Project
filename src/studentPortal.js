//Dom Id
const attendanceToday = document.getElementById("attendance-today");
const attendanceHistory = document.getElementById("attendance-history");
const logoutBtn = document.getElementById("logout-btn");

//Establishing Connection With The WebSocket Server Made Inside Vite.
const protocol = location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${protocol}://${location.host}/ws`);

//Checking Whenever The Websocket Server Has Opened
socket.addEventListener("open", () => console.log("Client's connected"));

//Run This Code Block Whenever A Message Came From The Websocket Server
socket.onmessage = (event) => {
  try {
    const atData = JSON.parse(event.data);
    console.log(atData.masterlist);
    //After Parsing Pass It To Render The Attendance Table
    renderAttendance(atData);
  } catch {
    return;
  }
};

logoutBtn?.addEventListener("click", () => {
  console.log("Logout clicked");
});

//Render The Attendance Materials That Came From Teacher DashBoard
function renderAttendance(data) {
  const masterlist = data.masterlist || [];
  const ocr = data.ocrAttendance || [];

  // cleaned names of everyone the camera/OCR found
  const pres = new Set(ocr.map((students) => normalizeName(students.name)));

  const today = new Date().toLocaleDateString();

  attendanceToday.replaceChildren();

  masterlist.forEach((student) => {
    const isPresent = pres.has(normalizeName(student.name));
    const status = isPresent ? "Present" : "Absent";

    const p = document.createElement("p");
    p.textContent = `${today}: ${student.name}, ${student.sectionCode || "N/A"}, ${status}`;
    attendanceToday.appendChild(p);
  });
}

//Clean Student Name So It can Match With The Extracted OCR Student Name
function normalizeName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[_,-]/g, " ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

//Run This Code Whenever The Websocket Serve Closes
socket.addEventListener("close", () => console.log("Client's disconnected"));
