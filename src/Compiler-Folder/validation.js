import { getMasterlistData } from "../Algorithm-Folder/studentRegister";
import { getPresentStudents, isAttendanceReady } from "../Algorithm-Folder/processImage";
import { initializePublishing } from "../Database-Folder/publishedAttendance.js";
import { utils, writeFile, read } from "xlsx";

const combineTableBtn = document.getElementById("combineTable");
const combinedAttendanceTable = document.getElementById("combineSheetData");
const exportExcelBtn = document.getElementById("exportTable");
const shareAttendanceBtn = document.getElementById("shareAttendance");
const masterlistFileInput = document.getElementById("masterList");

const webSocketProtocol = location.protocol === "https:" ? "wss" : "ws";
const attendanceSocket = new WebSocket(
  `${webSocketProtocol}://${location.host}/ws`,
);

attendanceSocket.addEventListener("open", () =>
  console.log("Teacher's dashboard connected"),
);

combineTableBtn?.addEventListener("click", () => {
  renderCombinedAttendanceTable();
});

exportExcelBtn?.addEventListener("click", () => {
  exportAttendanceSpreadsheet();
});

const { preparePublication, savePublishedAttendance } = initializePublishing();

shareAttendanceBtn.addEventListener("click", () => {
  const publication = preparePublication();
  if (!publication) return;
  const masterlistStudents = getMasterlistData() || [];
  const presentStudents = getPresentStudents() || [];

  function sendAttendanceToServer() {
    if (attendanceSocket.readyState === WebSocket.OPEN) {
      const attendancePayload = {
        masterlist: masterlistStudents,
        ocrAttendance: presentStudents,
        attendanceDate: publication.date,
      };

      attendanceSocket.send(JSON.stringify(attendancePayload));
    }
  }
  sendAttendanceToServer();
  // Preserve live publishing independently of the protected history request.
  const presentNames = new Set(presentStudents.map(student => normalizeName(student.name)));
  const records = masterlistStudents.map(student => ({
    student_name: student.name,
    status: presentNames.has(normalizeName(student.name)) ? "Present" : "Absent",
  }));
  void savePublishedAttendance(records, isAttendanceReady(), publication);
});

function normalizeName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[_,-]/g, " ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderCombinedAttendanceTable() {
  combinedAttendanceTable.replaceChildren();

  const masterlistStudents = getMasterlistData() || [];
  const presentStudents = getPresentStudents() || [];

  console.log(masterlistStudents);
  console.log(presentStudents);

  const presentNames = new Set(
    presentStudents.map((student) => normalizeName(student.name)),
  );

  //students in masterlist gets either present or absent
  masterlistStudents.forEach((student) => {
    const normalizedStudentName = normalizeName(student.name);
    const isPresent = presentNames.has(normalizedStudentName);
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const statusCell = document.createElement("td");

    nameCell.textContent = student.name;
    statusCell.textContent = isPresent ? "Present" : "Absent";
    row.append(nameCell, statusCell);
    combinedAttendanceTable.appendChild(row);
  });
}

async function exportAttendanceSpreadsheet() {
  try {
    const masterlistFile = masterlistFileInput.files[0];
    const fileArrayBuffer = await masterlistFile.arrayBuffer();
    const workbook = read(fileArrayBuffer);
    const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

    const presentStudents = getPresentStudents() || [];

    const presentNames = new Set(
      presentStudents.map((student) => normalizeName(student.name)),
    );

    const sheetRows = utils.sheet_to_json(firstWorksheet, {
      //To-Do: Make This Into Object Instead Of A List Of Array.
      header: 1,
    });

    console.log(sheetRows);

    for (let rowIndex = 10; rowIndex < sheetRows.length; rowIndex++) {
      const sheetRow = sheetRows[rowIndex];

      if (!sheetRow || sheetRow.length <= 1) {
        continue;
      }

      const rawStudentName = sheetRow[2];
      const isPresent = presentNames.has(normalizeName(rawStudentName));

      if (isPresent === false) {
        sheetRow.push("Absent");
      } else {
        sheetRow.push("Present");
      }
    }

    console.log(sheetRows);
    //To-Do: Instead Of Array Of An Array, Use Json to sheet
    const attendanceSheet = utils.aoa_to_sheet(sheetRows);
    const attendanceWorkbook = utils.book_new();
    utils.book_append_sheet(attendanceWorkbook, attendanceSheet, "Sheet1");
    writeFile(attendanceWorkbook, "SheetJSTable.xls");
  } catch (error) {
    console.warn(error);
  }
}

attendanceSocket.addEventListener("close", () =>
  console.log("Teacher's Dashboard disconnected"),
);
