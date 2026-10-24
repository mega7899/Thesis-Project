//Dom Id
const attendanceToday = document.getElementById("attendance-today");
const attendanceHistory = document.getElementById("attendance-history");
const logoutBtn = document.getElementById("logout-btn");

//Establishing Connection With The WebSocket Server Made Inside Vite.
const webSocketProtocol = location.protocol === "https:" ? "wss" : "ws";
const attendanceSocket = new WebSocket(
  `${webSocketProtocol}://${location.host}/ws`,
);

//Checking Whenever The Websocket Server Has Opened
attendanceSocket.addEventListener("open", () =>
  console.log("student's dashboard connected"),
);

//Run This Code Block Whenever A Message Came From The Websocket Server
attendanceSocket.onmessage = (event) => {
  try {
    const attendanceData = JSON.parse(event.data);
    console.log(attendanceData.masterlist);
    //After Parsing Pass It To Render The Attendance Table
    renderAttendance(attendanceData);
  } catch {
    return;
  }
};

logoutBtn?.addEventListener("click", () => {
  console.log("Logout clicked");
});

//Render The Attendance Materials That Came From Teacher DashBoard
function renderAttendance(attendanceData) {
  const masterlist = attendanceData.masterlist || [];
  const presentStudents = attendanceData.ocrAttendance || [];

  // cleaned names of everyone the camera/OCR found
  const presentNames = new Set(
    presentStudents.map((presentStudent) => normalizeName(presentStudent.name)),
  );

  const today = new Date().toLocaleDateString();

  attendanceToday.replaceChildren();

  masterlist.forEach((student) => {
    const isPresent = presentNames.has(normalizeName(student.name));
    const status = isPresent ? "Present" : "Absent";

    const attendanceLine = document.createElement("p");
    attendanceLine.textContent = `${today}: ${student.name}, ${status}`;
    attendanceToday.appendChild(attendanceLine);
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
attendanceSocket.addEventListener("close", () =>
  console.log("Student's DashBoard disconnected"),
);
