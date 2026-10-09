import { getMasterlistData } from "../src/studentRegister";
import { catchStudenName } from "../src/processImage";
import { utils, writeFile } from 'xlsx'

const combineBtn = document.getElementById('combineTable');
const combinedAttendanceTable = document.getElementById('combineSheetData');
const exportExcelBtn = document.getElementById('exportTable');
const candidates = new Map();

combineBtn.addEventListener('click', () => {    
  validatingData();
});

exportExcelBtn.addEventListener('click', ()=>{
  const newWorkbook = utils.table_to_book(combinedAttendanceTable);
  writeFile(newWorkbook, "SheetJSTable.xlsx");
})


function sorterOfArray(array){
if (!Array.isArray(array)) return [];

  // Sorts in-place and returns the array
  return array.sort((a, b) => {
    const nameA = a?.name || '';
    const nameB = b?.name || '';
    return nameA.localeCompare(nameB);
  });
} 

function attendanceChecker(candidate){
  candidate.forEach(student => {
    if(!candidates.has(student.name)){
      candidates.set(student.name, {
        section: student.sectionCode,
        attendance: false
      })
    }else{
      candidates.set(student.name, {
      section: student.sectionCode,
      attendance: true
    })
    }
  });
}

function validatingData(){
  // Clear previous rows to avoid duplicate rendering
  combinedAttendanceTable.innerHTML = '';

  // Checks if getMasterlistData, and catchStudenName have any values
  const studentList = getMasterlistData() || [];
  const catchStudentData = catchStudenName() || [];

  // Sort both arrays of objects by their .name property
  const sortedStudents = sorterOfArray(studentList);
  const sortedOcrData = sorterOfArray(catchStudentData);

  attendanceChecker(sortedStudents);
  attendanceChecker(sortedOcrData);
  console.log(candidates);
  renderTable();
}

function renderTable(){
  for (const [name, data] of candidates) {
    const row = document.createElement('tr');
    const statusText = data.attendance ? 'Present' : 'Absent';

    row.innerHTML = `
      <td>${data.section || 'N/A'}</td>
      <td>${name}</td>
      <td>${statusText}</td>
    `;

    combinedAttendanceTable.appendChild(row);
  }
}
