import { registry } from "chart.js";
import { getMasterlistData } from "../Compiler-Folder/studentRegister";
import { catchStudenName } from "../Ocr-Folder/processImage";
import { sendToServer } from "../webSocket-folder/socket";
import { utils, writeFile } from "xlsx";

const combineBtn = document.getElementById("combineTable");
const combinedAttendanceTable = document.getElementById("combineSheetData");
const exportExcelBtn = document.getElementById("exportTable");
const shareData = document.getElementById("shareAttendance");

const studentList = getMasterlistData() || [];
const currentAttendance = catchStudenName() || [];

combineBtn?.addEventListener("click", () => {
  valueChecker();
  validatingData();
});

exportExcelBtn?.addEventListener("click", () => {
  valueChecker();
  const newWorkbook = utils.table_to_book(combinedAttendanceTable);
  writeFile(newWorkbook, "SheetJSTable.xlsx");
});

shareData.addEventListener("click", () => {
  valueChecker();

  const data = {
    masterlist: studentList,
    OcrList: currentAttendance,
  };

  console.log(studentList);
  console.log(currentAttendance);

  sendToServer(JSON.stringify(data));
});

function normalizeName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[_,-]/g, " ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function valueChecker() {
  if (studentList.length === 0 && currentAttendance.length === 0) {
    console.warn("There is no attendance created yet.");
    return;
  }
}

function validatingData() {
  combinedAttendanceTable.replaceChildren();

  console.log(currentAttendance);
  console.log(studentList);

  const presentNames = new Set(
    currentAttendance.map((student) => normalizeName(student.name)),
  );

  //students in masterlist gets either present or absent
  studentList.forEach((student) => {
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
