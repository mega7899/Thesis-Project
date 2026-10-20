import { utils, writeFileXLSX, read, writeFile } from "xlsx";

const zoomList = document.getElementById("screenShots");
const masterlistFileInput = document.getElementById("masterList");
const submitMasterlist = document.getElementById("send-btn");
const studentList = document.getElementById("masterData");

let parsedMasterlist = [];

if (submitMasterlist) {
  submitMasterlist.addEventListener("click", () => {
    console.log("The button has been clicked!");

    if (!zoomList.files[0]) return console.warn("Submit your zoom screenShot.");

    processMasterlistWorkbook();
  });
}

async function processMasterlistWorkbook() {
  console.log("data file rendering is processing.");

  if (!masterlistFileInput.files.length) {
    console.warn("No masterlist file selected.");
    return;
  }

  parsedMasterlist = []; // reset deterministically here, not in the click handler

  try {
    const uploadedFile = masterlistFileInput.files[0];
    const fileArrayBuffer = await uploadedFile.arrayBuffer();
    const workbook = read(fileArrayBuffer);
    const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

    // skips only the header row and reads every row that actually has string
    const parsedSheetData = utils.sheet_to_json(firstWorksheet, {
      header: 1,
      range: 1,
    });
    console.log(parsedSheetData);

    // Checks Each row of parsedSheetData() Array For Student Section, LastName, & FirstName
    parsedSheetData.forEach((row) => {
      const section = row[0] !== undefined ? String(row[0]).trim() : "";
      const lastName = row[1] !== undefined ? String(row[1]).trim() : "";
      const firstName = row[2] !== undefined ? String(row[2]).trim() : "";

      // A student must at least have a last name.
      if (!lastName) {
        console.warn("Skipping masterlist row without a last name:", row);
        return;
      }

      // Match the format used by the Zoom names:
      const studentName = firstName ? `${lastName}, ${firstName}` : lastName;

      parsedMasterlist.push({
        name: studentName,
        lastName: lastName,
        firstName: firstName,
        sectionCode: section || "N/A",
      });
    });

    renderStudentList();
    console.table(parsedMasterlist);
  } catch (error) {
    console.error("Failed to process masterlist workbook:", error);
  }
}

function renderStudentList() {
  if (!studentList) return;
  studentList.replaceChildren();

  parsedMasterlist.forEach((student) => {
    const studentRow = document.createElement("tr");
    const sectionCell = document.createElement("td");
    const nameCell = document.createElement("td");

    sectionCell.textContent = student.sectionCode || "N/A";
    nameCell.textContent = student.name;
    studentRow.append(sectionCell, nameCell);
    studentList.appendChild(studentRow);
  });
}

export function getMasterlistData() {
  return parsedMasterlist;
}
