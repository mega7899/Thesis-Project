import { createWorker } from "tesseract.js";
import { InvertFilter } from "image-filter-js";
import { partial_ratio } from 'fuzzball';

// Global Variable
const screenshotFileInput = document.getElementById("screenShots");
const submitScreenshotBtn = document.getElementById("send-screenShots");
const alternativeScreenshotInput = document.getElementById("screenShots");
const studentCount = [];
let rawScannedOcr;
let ocrNames;

//Testing Materials
let extractedOcr;

// Run the program, When the button is clicked
if (submitScreenshotBtn) {
  submitScreenshotBtn.addEventListener("click", () => {
    console.log("The button has been clicked pls wait.");

    let activeImageFile;
    if (screenshotFileInput.files[0]) {
      activeImageFile = prepareImageOnCanvas(screenshotFileInput);
    } else if (alternativeScreenshotInput.files[0]) {
      activeImageFile = prepareImageOnCanvas(alternativeScreenshotInput);
    }
  });
}
// Pre-process image
function prepareImageOnCanvas(fileInputElement) {
  const imageFile = fileInputElement.files[0];
  const fileReader = new FileReader();
  const processingCanvas = document.createElement("canvas");
  const canvasContext = processingCanvas.getContext("2d");
  const imageElement = document.createElement("img");

  fileReader.readAsDataURL(imageFile);
  fileReader.onload = () => {
    imageElement.src = fileReader.result;

    imageElement.onload = () => {
      canvasContext.drawImage(imageElement, 0, 0, 1366, 789);
      let filterInstance = new InvertFilter(processingCanvas);
      filterInstance.process(imageElement);
      runOcrAnalysis(processingCanvas);
    };
  };
}

// invert image file to white and text to black
function runOcrAnalysis(canvasSource) {
  console.log("preprocess is working.");

  (async () => {
    const ocrWorker = await createWorker("eng");
    const ocrResult = await ocrWorker.recognize(canvasSource);
    const extractedText = ocrResult.data.text;
    extractedOcr = extractedText;    
    extractingNames(extractedText);
    await ocrWorker.terminate();
    console.log("the program has stopped.");
  })();
}

function extractingNames(text) {
  console.log(typeof extractedOcr);
  const regexPattern = /[A-Z]\d{3,4}[_\s]+[A-Z]/gi;
  const matchText = [...text.matchAll(regexPattern)];

  if (matchText.length > 0) {
    const startIndex = matchText[0].index; 
    const lastMatchIndex = matchText[matchText.length - 1].index;
    
    const lineEnd = text.indexOf('\n', lastMatchIndex);
    const endIndex = lineEnd !== -1 ? lineEnd : 'There is no student name with the format match';

    const resultBlock = text.slice(startIndex, endIndex);
    rawScannedOcr = resultBlock;
    
    scanStudentName(resultBlock);
  }
}

async function scanStudentName(text) {
  // Dynamically import studentRegister only when OCR processing runs
  const { getMasterlistData } = await import('./studentRegister.js');
  const studentMasterlist = getMasterlistData();
  
  studentCount.length = 0;

  const cleanText = text
  .toUpperCase()
  .replace(/[^A-Z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

  const regPattern = /[a-zA-Z]\d+.[a-zA-Z]+.[a-zA-Z]+/gi;
  ocrNames = cleanText.match(regPattern) || [];

  const candidates = [];
  for (let i = 0; i < studentMasterlist.length; i++) {
    const student = studentMasterlist[i];

    for (let n = 0; n < ocrNames.length; n++) {
      const ocrEntry = ocrNames[n];
      const score = partial_ratio(ocrEntry, student.name);

      if (score >= 50) {
        candidates.push({
          studentIndex: i,
          ocrIndex: n,
          student: student,
          score: score
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const claimedStudentIndices = new Set();
  const claimedOcrIndices = new Set();

  for (const candidate of candidates) {
    if (claimedStudentIndices.has(candidate.studentIndex) || claimedOcrIndices.has(candidate.ocrIndex)) {
      continue;
    }

    claimedStudentIndices.add(candidate.studentIndex);
    claimedOcrIndices.add(candidate.ocrIndex);

    studentCount.push({
      name: candidate.student.name,
      sectionCode: candidate.student.sectionCode,
      score: candidate.score
    });
  }
  renderCombineResult(studentCount);
  console.log(studentCount);
}

// New DOM rendering function
export function renderCombineResult(matchedData) {
  const currentAttendanceTable = document.getElementById("studentData");
  if (!currentAttendanceTable) {
    console.warn("Target element #studentData was not found in the DOM.");
    return;
  }

  currentAttendanceTable.replaceChildren();

  matchedData.forEach(student => {
    const studentRow = document.createElement("tr");
    const sectionCell = document.createElement("td");
    const nameCell = document.createElement("td");
    const statusCell = document.createElement("td");

    sectionCell.textContent = student.sectionCode;
    nameCell.textContent = student.name;
    statusCell.textContent = `Present`;

    studentRow.append(sectionCell, nameCell, statusCell);
    currentAttendanceTable.appendChild(studentRow);
  });
}

// Import Values
export function catchStudenName() {
  return studentCount;
}

export function testingMaterials(){
  return extractedOcr;
}