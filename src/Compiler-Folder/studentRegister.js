import { utils, writeFileXLSX, read, writeFile } from "xlsx";

const screenshotFileInput = document.getElementById("screenShots");
const masterlistFileInput = document.getElementById("masterList");
const submitMasterlistBtn = document.getElementById("send-btn");
const masterlistTableBody = document.getElementById("masterData");

let parsedMasterlist = [];

if (submitMasterlistBtn) {
  submitMasterlistBtn.addEventListener("click", () => {
    console.log("The button has been clicked!");

    if (!screenshotFileInput.files[0]) return console.warn("Submit your zoom screenShot.");

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
    const masterlistFile = masterlistFileInput.files[0];
    const fileArrayBuffer = await masterlistFile.arrayBuffer();
    const workbook = read(fileArrayBuffer);
    const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

    // skips only the header row and reads every row that actually has string
    const sheetRows = utils.sheet_to_json(firstWorksheet, {
      header: 2,
      range: 9,
    });
    console.log(sheetRows);

    sheetRows.forEach((sheetRow) => {
      const rawName = sheetRow.Name;
      const trimmedName = rawName !== undefined ? String(rawName.trim()) : "";

      if (trimmedName === "") {
        return;
      } else {
        parsedMasterlist.push({
          name: trimmedName,
        });
      }
    });
     renderStudentList();
  } catch (error) {
    console.error("Failed to process masterlist workbook:", error);
  }
}

function renderStudentList() {
  if (!masterlistTableBody) return;
  masterlistTableBody.replaceChildren();

  parsedMasterlist.forEach((student) => {
    if (student.name === "") return;

    const studentRow = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.textContent = student.name;
    studentRow.append(nameCell);
    masterlistTableBody.appendChild(studentRow);
  });
}

export function getMasterlistData() {
  return parsedMasterlist;
}
