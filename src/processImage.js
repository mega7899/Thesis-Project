import { createWorker } from "tesseract.js";
import { InvertFilter } from "image-filter-js";
import { partial_ratio} from 'fuzzball';
import { getMasterlistData } from './studentRegister';

//Global Variable
const screenshotFileInput = document.getElementById("screenShots");
const submitScreenshotBtn = document.getElementById("send-screenShots");
const alternativeScreenshotInput = document.getElementById("screenShots");
const studentCount = [];
let rawScannedOcr;
let ocrNames;

//Run the program, When the button is cliked
if (submitScreenshotBtn) {
  submitScreenshotBtn.addEventListener("click", () => {
    console.log("The button has been clicked pls wait.");

    let activeImageFile;

    if (screenshotFileInput?.files[0]) {
      activeImageFile = prepareImageOnCanvas(screenshotFileInput);
    } else if (alternativeScreenshotInput?.files[0]) {
      activeImageFile = prepareImageOnCanvas(alternativeScreenshotInput);
    }
  });
}

//Pre-process image
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

//invert image file to white and text to black
function runOcrAnalysis(canvasSource) {
  console.log("preprocess is working.");

  (async () => {
    const ocrWorker = await createWorker("eng");
    const ocrResult = await ocrWorker.recognize(canvasSource);
    const extractedText = ocrResult.data.text;
    extractingNames(extractedText);
    await ocrWorker.terminate();
    console.log("the program has stopped.");
  })();
}

function extractingNames(text){
  const regexPattern = /[A-Z]\d{3,4}[_\s]+[A-Z]/gi;
  const matchText = [...text.matchAll(regexPattern)];

  if (matchText.length > 0) {
    const startIndex = matchText[0].index; // First detected ID (e.g., A049)
    const lastMatchIndex = matchText[matchText.length - 1].index; // Last detected ID
    
    const lineEnd = text.indexOf('\n', lastMatchIndex);
    const endIndex = lineEnd !== -1 ? lineEnd : 'There is no student name with the format match';

    const resultBlock = text.slice(startIndex, endIndex);
    rawScannedOcr = resultBlock;
    
    scanStudentName(resultBlock);
  }
}

function scanStudentName(text) {
  const studentMasterlist = getMasterlistData();
  
  // 1. Reset results array
  studentCount.length = 0;

  const cleanText = text
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const regPattern = /[a-zA-Z]\d+.[a-zA-Z]+.[a-zA-Z]+/gi;
  ocrNames = cleanText.match(regPattern) || [];

  // Collect ALL possible candidate pairs with score >= 60
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

  // Sort pairs by highest confidence first (98% match gets picked over 65%)
  candidates.sort((a, b) => b.score - a.score);

  // Filter out duplicates using Sets
  const claimedStudentIndices = new Set();
  const claimedOcrIndices = new Set();

  for (const candidate of candidates) {
    // Skip if this student OR this OCR string was already claimed by a better match
    if (claimedStudentIndices.has(candidate.studentIndex) || claimedOcrIndices.has(candidate.ocrIndex)) {
      continue;
    }

    // Lock both indices so they cannot be reused
    claimedStudentIndices.add(candidate.studentIndex);
    claimedOcrIndices.add(candidate.ocrIndex);

    // Save final unique match
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
    console.warn("Target element #combineData was not found in the DOM.");
    return;
  }

  // Clear existing table rows before appending new results
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
    console.log(studentCount);
  });
}

export function catchStudenName() {
  return studentCount;
}

export function testingMaterials() {
  return rawScannedOcr;
}