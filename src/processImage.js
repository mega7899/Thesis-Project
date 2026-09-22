import { createWorker } from "tesseract.js";
import { InvertFilter } from "image-filter-js";
import { getMasterlistData } from "./studentRegister";

//Global Variable
const screenshotFileInput = document.getElementById("screenShots");
const submitScreenshotBtn = document.getElementById("send-screenShots");
const alternativeScreenshotInput = document.getElementById("screenShots");
const matchedSectionCodes = [];
const matchedStudentNames = [];


//Run the program, When the button is cliked
submitScreenshotBtn.addEventListener("click", () => {
  console.log("The button has been clicked pls wait.");

  let activeImageFile;
  if (screenshotFileInput.files[0]) {
    activeImageFile = prepareImageOnCanvas(screenshotFileInput);
  } else if (alternativeScreenshotInput.files[0]) {
    activeImageFile = prepareImageOnCanvas(alternativeScreenshotInput);
  }
});

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
      const filterInstance = new InvertFilter(processingCanvas);
      filterInstance.process(processingCanvas);
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
    matchOcrNamesWithMasterlist(extractedText);
    await ocrWorker.terminate();
    console.log("the program has stopped.");
  })();
}

//Working on progress
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchOcrNamesWithMasterlist(rawOcrText) {
  const masterlistCriteria = getMasterlistData();
  const liveAttendanceTableBody = document.getElementById("studentData");
  const masterlistValues = masterlistCriteria.studentName;
  const masterNames = masterlistValues.filter((_, index) => index % 2 === 0);
  const masterSections = masterlistValues.filter((_, index) => index % 2 === 1);

  // Escape punctuation such as commas, then test longer names first. This is
  // important for names like "AREVALO, JHON CRIST G".
  const regexNamePattern = masterNames
    .filter(Boolean)
    .sort((a, b) => String(b).length - String(a).length)
    .map((name) => escapeRegex(String(name).trim()))
    .join("|");

  if (!regexNamePattern) return;

  const searchRegex = new RegExp(`(?<![A-Za-z])(?:${regexNamePattern})(?![A-Za-z])`, "gi");
  const identifiedMatches = rawOcrText.match(searchRegex) ?? [];
  const matchedNames = [];
  const matchedSections = [];

  identifiedMatches.forEach((matchedString) => {
    const matchedIndex = masterNames.findIndex(
      (name) => String(name).trim().toLowerCase() === matchedString.trim().toLowerCase()
    );

    if (matchedIndex !== -1 && !matchedNames.includes(masterNames[matchedIndex])) {
      matchedNames.push(masterNames[matchedIndex]);
      matchedSections.push(masterSections[matchedIndex] ?? "");
    }
  });

  matchedStudentNames.push(...matchedNames);
  matchedSectionCodes.push(...matchedSections);

  for (let i = 0; i < matchedNames.length; i++) {
    const newRow = document.createElement("tr");
    newRow.innerHTML = `<td>${matchedSections[i]}</td><td>${matchedNames[i]}</td><td>Present</td>`;
    liveAttendanceTableBody.insertAdjacentElement("beforebegin", newRow);
  }

  console.log("OCR matches:", matchedNames);
  return getExtractedStudentNames();
}

export function getExtractedStudentNames(){
  const exportedStudentPayload = {
    student: matchedStudentNames
  }

  return exportedStudentPayload;
}
