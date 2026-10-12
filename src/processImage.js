import { createWorker } from "tesseract.js";
import { InvertFilter } from "image-filter-js";
import { partial_ratio } from "fuzzball";

// Global Variable
const screenshotFileInput = document.getElementById("screenShots");
const submitScreenshotBtn = document.getElementById("send-screenShots");
const alternativeScreenshotInput = document.getElementById("screenShots");
const studentCount = [];
let rawScannedOcr;

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
    compareNames(extractedText);
    await ocrWorker.terminate();
    console.log("the program has stopped.");
  })();
}

async function compareNames(uncleanOcr) {
  // Get the students from the masterlist
  const { getMasterlistData } = await import('./studentRegister.js');
  const masterlistStudents = getMasterlistData();

  // Join all the names together so the regex can search for them
  const masterListName = masterlistStudents.map(student => student.name).join('|');

  const studentMasterlist = masterListName;
  const regexPattern = new RegExp(`${studentMasterlist}`, 'gi');
  const ocrText = uncleanOcr;
  const compareBetween = ocrText.match(regexPattern);

  console.log(compareBetween);

  // Give every student a partial ratio score
  const studentScores = [];

  for (let i = 0; i < masterlistStudents.length; i++) {
    const student = masterlistStudents[i];
    const score = partial_ratio(student.name.toLowerCase(), ocrText.toLowerCase());

    studentScores.push({
      name: student.name,
      sectionCode: student.sectionCode,
      score: score
    });
  }

  console.log(studentScores);
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