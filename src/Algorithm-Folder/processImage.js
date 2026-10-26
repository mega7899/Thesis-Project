//Import Functions That Came From The Installed Dependencies
import { createWorker } from "tesseract.js";
import { InvertFilter } from "image-filter-js";

//Import The Extracted Student Name, and Student Name That Came From Ocr
import {
  extractCandidateLabels,
  matchCandidateLabelsToStudents,
} from "./ruleBased.js";
import { detectFacesInRegions } from "./faceDetection.js";
import { buildParticipantRegions } from "./layoutDetection.js";

// DOM
const masterlistFileInput = document.getElementById("masterList");
const screenshotFileInput = document.getElementById("screenShots");
const submitScreenshotBtn = document.getElementById("send-screenShots");

// Shared state
const presentStudents = [];
let ocrRawText;

// Screenshot upload
if (submitScreenshotBtn) {
  submitScreenshotBtn.addEventListener("click", () => {
    console.log("Screenshot processing started.");

    if (!screenshotFileInput?.files[0])
      return console.warn("No Zoom screenshot selected.");
    if (!masterlistFileInput?.files[0])
      return console.warn("Upload Your MasterList First.");

    prepareImageOnCanvas(screenshotFileInput);
  });
}

// Load screenshot
function prepareImageOnCanvas(fileInputElement) {
  const imageFile = fileInputElement.files[0];
  const fileReader = new FileReader();
  const processingCanvas = document.createElement("canvas");
  const canvasContext = processingCanvas.getContext("2d");
  const imageElement = document.createElement("img");
  fileReader.readAsDataURL(imageFile);

  fileReader.onload = () => {
    imageElement.src = fileReader.result;

    imageElement.onload = async () => {
      //keep the original screenshot in memory for face-api and OCR processing.
      processingCanvas.width = imageElement.naturalWidth;
      processingCanvas.height = imageElement.naturalHeight;
      canvasContext.drawImage(
        imageElement,
        0,
        0,
        processingCanvas.width,
        processingCanvas.height,
      );

      const invertFilter = new InvertFilter(processingCanvas);
      invertFilter.process(imageElement);
      await runOcrAndFaceDetection(processingCanvas, imageElement);
    };
  };
}

// Main OCR + face pipeline
async function runOcrAndFaceDetection(screenshotCanvas, screenshotImage) {
  console.log("OCR processing started.");
  const ocrWorker = await createWorker("eng");

  try {
    const ocrResult = await ocrWorker.recognize(
      screenshotCanvas,
      {},
      {
        blocks: true,
      },
    );

    ocrRawText = ocrResult.data.text;
    const ocrBlocks = ocrResult.data.blocks || [];

    // extract OCR words and arrange candidate Zoom name labels
    const candidateLabels = extractCandidateLabels(ocrBlocks);

    // match Zoom labels to official students
    const matchedLabels = matchCandidateLabelsToStudents(candidateLabels);

    //for debugging purposes, if nothing match it won't continue
    if (!matchedLabels.length) {
      console.warn("No Zoom participant names matched the masterlist.");
      presentStudents.length = 0;
      renderCurrentAttendanceTable(presentStudents);
      return;
    }

    // finalize zoom participant regions dynamically
    const participantRegions = buildParticipantRegions(
      matchedLabels,
      screenshotImage.naturalWidth,
      screenshotImage.naturalHeight,
    );

    // run face-api on each participant
    const participantFaceResults = await detectFacesInRegions(
      screenshotImage,
      participantRegions,
    );

    //Current Attendance
    presentStudents.length = 0;

    participantFaceResults.forEach((participant) => {
      if (!participant.hasFace) return;

      presentStudents.push({
        name: participant.name,
        score: participant.matchScore,
      });
    });

    renderCurrentAttendanceTable(presentStudents);
    console.log("Current attendance:", presentStudents);
  } catch (error) {
    console.error("Failed to process Zoom screenshot:", error);
  } finally {
    await ocrWorker.terminate();

    console.log("OCR processing finished.");
  }
}

// Render Current Attendance
export function renderCurrentAttendanceTable(presentStudentList) {
  const currentAttendanceTable = document.getElementById("studentData");

  if (!currentAttendanceTable) {
    console.warn("Target element #studentData was not found.");
    return;
  }

  currentAttendanceTable.replaceChildren();

  presentStudentList.forEach((student) => {
    const studentRow = document.createElement("tr");
    const nameCell = document.createElement("td");
    const statusCell = document.createElement("td");

    nameCell.textContent = student.name;
    statusCell.textContent = "Present";

    studentRow.append(nameCell, statusCell);
    currentAttendanceTable.appendChild(studentRow);
  });
}
// Existing exports used by validation/tests
export function getPresentStudents() {
  return presentStudents;
}

export function getOcrRawText() {
  return ocrRawText;
}
