import { utils, writeFileXLSX, read, writeFile } from 'xlsx';
import { getExtractedStudentNames } from './processImage'

const masterlistFileInput = document.getElementById('masterList');
const submitMasterlistBtn = document.getElementById('send-btn');
const masterlistTableBody = document.getElementById('masterData');
const combinedAttendanceTable = document.getElementById('combineData');
const combinedTableBody = document.getElementById('combineSheetData')
const combineTablesBtn = document.getElementById('combineTable');
const exportExcelBtn = document.getElementById('exportTable');

let currentSectionCode = null;
let parsedMasterlistRows = [];

submitMasterlistBtn.addEventListener('click', ()=>{
  console.log('The button has been clicked!');
  processMasterlistWorkbook();
  parsedMasterlistRows = [];
})

async function processMasterlistWorkbook() {
  console.log('data file rendering is processing.');

  const uploadedFile = masterlistFileInput.files[0];
  const fileArrayBuffer = await uploadedFile.arrayBuffer();
  const workbook = read(fileArrayBuffer);
  const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];
  const parsedSheetData = utils.sheet_to_json(firstWorksheet, {header: 1, range: 'A2:B6' });

  console.log(parsedSheetData);

  parsedSheetData.forEach(row =>{
    currentSectionCode = row[1].slice(9);
    parsedMasterlistRows.push(row[0], currentSectionCode);
  })
  renderAttendanceTable(parsedSheetData, masterlistTableBody);

  combineTablesBtn.addEventListener('click', ()=>{
    renderAttendanceTable(parsedSheetData, combinedTableBody)
  })

  exportExcelBtn.addEventListener('click', ()=>{
    const newWorkbook = utils.table_to_book(combinedAttendanceTable);
    writeFile(newWorkbook, "SheetJSTable.xlsx");
  })

  console.log(parsedMasterlistRows);
}

export function getMasterlistData(){
  const masterlistPayload = {
    studentName: parsedMasterlistRows,
    sectionPattern: currentSectionCode
  }
  return masterlistPayload
}

function renderAttendanceTable(sheetData, tableTargetLocation){
  try{
    const extractedData = getExtractedStudentNames();
    const verifiedStudentNames = extractedData.student;
    console.log(verifiedStudentNames);
    console.log(sheetData);

    for(let i = 0; i < sheetData.length; i++){
      if(sheetData[i][0] === verifiedStudentNames[i]){
        const tableRowHtml = `<td>${sheetData[i][1]}</td><td>${sheetData[i][0]}</td><td>Present</td>`;
        tableTargetLocation.insertAdjacentHTML('afterend', tableRowHtml);
      }else {
        const tableRowHtml = `<td>${sheetData[i][1]}</td><td>${sheetData[i][0]}</td>`;
        tableTargetLocation.insertAdjacentHTML('afterend', tableRowHtml); 
      }
    }
  }catch(error){
    console.log(error);
  }
}