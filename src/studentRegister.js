import { utils, writeFileXLSX, read, writeFile } from 'xlsx';

const masterlistFileInput = document.getElementById('masterList');
const submitMasterlist = document.getElementById('send-btn');
const studentList = document.getElementById('masterData');
const combinedAttendanceTable = document.getElementById('combineData');

let currentSectionCode = null;
let parsedMasterlist = [];

if (submitMasterlist) {
  submitMasterlist.addEventListener('click', () => {
    console.log('The button has been clicked!');
    processMasterlistWorkbook();
  });
}

async function processMasterlistWorkbook() {
  console.log('data file rendering is processing.');

  if (!masterlistFileInput.files.length) {
    console.warn('No masterlist file selected.');
    return;
  }

  parsedMasterlist = []; // reset deterministically here, not in the click handler

  try {
    const uploadedFile = masterlistFileInput.files[0];
    const fileArrayBuffer = await uploadedFile.arrayBuffer();
    const workbook = read(fileArrayBuffer);
    const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

    // `range: 1` skips only the header row and reads every row that actually has
    // data, however many students there are. The old hardcoded 'A2:B6' assumed
    // exactly 5 rows — any class roster shorter than that (or a blank Section
    // cell inside that range) produced a row with no index [1], which is what
    // crashed on row[1].slice(9). A roster longer than 5 was silently truncated.
    const parsedSheetData = utils.sheet_to_json(firstWorksheet, { header: 1, range: 1 });

    console.log(parsedSheetData);

    // Inside processMasterlistWorkbook() in StudentRegister.js
    parsedSheetData.forEach(row => {
      if (row[0] === undefined || row[1] === undefined) {
        console.warn('Skipping incomplete masterlist row:', row);
        return;
      }

      const studentName = String(row[0]).trim();
      const section = row[1];
      const currentSectionCode = String(row[1]).slice(7).trim();

      // Push an object instead of two flat elements
      parsedMasterlist.push({
        name: studentName,
        section: section,
        sectionCode: currentSectionCode
      });
    });

    renderStudentList();
    console.log(parsedMasterlist);
  } catch (error) {
    console.error('Failed to process masterlist workbook:', error);
  }
}

function renderStudentList() {
  if (!studentList) return;
  studentList.replaceChildren();

  parsedMasterlist.forEach(student => {
    const studentRow = document.createElement('tr');
    const sectionCell = document.createElement('td');
    const nameCell = document.createElement('td');

    sectionCell.textContent = student.section;
    nameCell.textContent = student.name;

    studentRow.append(sectionCell, nameCell);
    studentList.appendChild(studentRow);
  });
}

export function getMasterlistData(){
  return parsedMasterlist
}
