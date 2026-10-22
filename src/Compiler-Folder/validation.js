import { getMasterlistData } from "./studentRegister";
import { catchStudentName } from "../Ocr-Folder/processImage";
import { utils, writeFile } from "xlsx";

const combineBtn = document.getElementById("combineTable");
const combinedAttendanceTable = document.getElementById("combineSheetData");
const exportExcelBtn = document.getElementById("exportTable");
const shareData = document.getElementById("shareAttendance");

const protocol = location.protocol === "https:" ? "wss" : "ws";
const socket = new WebSocket(`${protocol}://${location.host}/ws`);

socket.addEventListener("open", () => console.log("Client's connected"));

combineBtn?.addEventListener("click", () => {
  validatingData();
});

exportExcelBtn?.addEventListener("click", () => {
  const newWorkbook = utils.table_to_book(combinedAttendanceTable);
  writeFile(newWorkbook, "SheetJSTable.xlsx");
});

shareData.addEventListener("click", () => {
  const masterList = getMasterlistData() || [];
  const ocrAttendance = catchStudentName() || [];

  function sendToServer() {
    if (socket.readyState === WebSocket.OPEN) {
      const data = {
        masterlist: masterList,
        ocrAttendance: ocrAttendance,
      };

      socket.send(JSON.stringify(data));
    }
  }

  sendToServer();
});

function normalizeName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[_,-]/g, " ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validatingData() {
  combinedAttendanceTable.replaceChildren();

  const masterList = getMasterlistData() || [];
  const ocrAttendance = catchStudentName() || [];

  console.log(masterList);
  console.log(ocrAttendance);

  const presentNames = new Set(
    ocrAttendance.map((student) => normalizeName(student.name)),
  );

  //students in masterlist gets either present or absent
  masterList.forEach((student) => {
    const studentName = normalizeName(student.name);
    const isPresent = presentNames.has(studentName);
    const row = document.createElement("tr");
    const sectionCell = document.createElement("td");
    const nameCell = document.createElement("td");
    const statusCell = document.createElement("td");

    sectionCell.textContent = student.sectionCode || "N/A";
    nameCell.textContent = student.name;
    statusCell.textContent = isPresent ? "Present" : "Absent";
    row.append(sectionCell, nameCell, statusCell);
    combinedAttendanceTable.appendChild(row);
  });
}

socket.addEventListener("close", () => console.log("Client's disconnected"));
