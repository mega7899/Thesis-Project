import { createWorker } from "tesseract.js";
import { InvertFilter } from "image-filter-js";
import { partial_ratio } from "fuzzball";
import { getMasterlistData } from "./studentRegister";

// Global variables
const screenshotFileInput = document.getElementById("screenShots");
const submitScreenshotBtn = document.getElementById("send-screenShots");
const alternativeScreenshotInput = document.getElementById("screenShots");
const studentCount = [];
let rawScannedOcr;
let ocrNames;

// Run the program when the button is clicked.
submitScreenshotBtn.addEventListener("click", () => {
  console.log("The button has been clicked pls wait.");

  if (screenshotFileInput.files[0]) {
    prepareImageOnCanvas(screenshotFileInput);
  } else if (alternativeScreenshotInput.files[0]) {
    prepareImageOnCanvas(alternativeScreenshotInput);
  }
});

// Pre-process image.
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
      applyImageFilterAndRunOcr(processingCanvas);
    };
  };
}

// Invert the image and run OCR.
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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeName(value) {
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchOcrNamesWithMasterlist(rawOcrText) {
  const masterlist = getMasterlistData();
  const normalizedOcrText = normalizeName(rawOcrText);
  const exactMatches = [];
  const matchedStudentIndices = new Set();

  const regexNamePattern = masterlist
    .map((student) => normalizeName(student.name))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join("|");

  if (regexNamePattern) {
    const searchRegex = new RegExp(`(?<![A-Z])(?:${regexNamePattern})(?![A-Z])`, "g");

    for (const matchedName of normalizedOcrText.match(searchRegex) ?? []) {
      const studentIndex = masterlist.findIndex(
        (student) => normalizeName(student.name) === matchedName
      );

      if (studentIndex !== -1 && !matchedStudentIndices.has(studentIndex)) {
        matchedStudentIndices.add(studentIndex);
        exactMatches.push({
          name: masterlist[studentIndex].name,
          sectionCode: masterlist[studentIndex].sectionCode,
          score: 100,
        });
      }
    }
  }

  return exactMatches;
}

function extractingNames(text) {
  const regexPattern = /[A-Z]\d{3,4}[_\s]+[A-Z]/gi;
  const matchText = [...text.matchAll(regexPattern)];

  if (matchText.length === 0) return;

  const startIndex = matchText[0].index;
  const lastMatchIndex = matchText[matchText.length - 1].index;
  const lineEnd = text.indexOf("\n", lastMatchIndex);
  const endIndex = lineEnd !== -1 ? lineEnd : text.length;
  const resultBlock = text.slice(startIndex, endIndex);

  rawScannedOcr = resultBlock;
  scanStudentName(resultBlock);
}

function scanStudentName(text) {
  const studentMasterlist = getMasterlistData();
  studentCount.length = 0;

  const regexMatches = matchOcrNamesWithMasterlist(text);
  const matchedStudentNames = new Set(regexMatches.map((student) => normalizeName(student.name)));
  studentCount.push(...regexMatches);

  const cleanText = normalizeName(text);
  const regPattern = /[A-Z]\d+[A-Z]+[A-Z]+/gi;
  ocrNames = cleanText.match(regPattern) || [];
  const candidates = [];

  for (let i = 0; i < studentMasterlist.length; i += 1) {
    const student = studentMasterlist[i];
    if (matchedStudentNames.has(normalizeName(student.name))) continue;

    for (let n = 0; n < ocrNames.length; n += 1) {
      const score = partial_ratio(normalizeName(ocrNames[n]), normalizeName(student.name));
      if (score >= 50) {
        candidates.push({ studentIndex: i, ocrIndex: n, student, score });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const claimedStudentIndices = new Set();
  const claimedOcrIndices = new Set();

  for (const candidate of candidates) {
    if (claimedStudentIndices.has(candidate.studentIndex) || claimedOcrIndices.has(candidate.ocrIndex)) continue;

    claimedStudentIndices.add(candidate.studentIndex);
    claimedOcrIndices.add(candidate.ocrIndex);
    studentCount.push({
      name: candidate.student.name,
      sectionCode: candidate.student.sectionCode,
      score: candidate.score,
    });
  }

  renderCombineResult(studentCount);
  console.log(studentCount);
}

export function renderCombineResult(matchedData) {
  const currentAttendanceTable = document.getElementById("studentData");
  if (!currentAttendanceTable) {
    console.warn("Target element #studentData was not found in the DOM.");
    return;
  }

  currentAttendanceTable.replaceChildren();

  matchedData.forEach((student) => {
    const studentRow = document.createElement("tr");
    const sectionCell = document.createElement("td");
    const nameCell = document.createElement("td");
    const statusCell = document.createElement("td");

    sectionCell.textContent = student.sectionCode;
    nameCell.textContent = student.name;
    statusCell.textContent = "Present";

    studentRow.append(sectionCell, nameCell, statusCell);
    currentAttendanceTable.appendChild(studentRow);
  });
}

export function catchStudenName() {
  return studentCount;
}
