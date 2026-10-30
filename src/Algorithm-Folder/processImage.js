//Import Functions That Came From The Installed Dependencies
import { createWorker } from "tesseract.js";
import { InvertFilter } from "image-filter-js";

//Import The Extracted Student Name, and Student Name That Came From Ocr
import {
  extractCandidateLabels,
  matchCandidateLabelsToStudents,
} from "./ruleBased.js";
import { getMasterlistData } from "./studentRegister.js";
import { detectAndMatchFaces } from "./faceDetectionPipeline.js";

// DOM
const masterlistFileInput = document.getElementById("masterList");
const screenshotFileInput = document.getElementById("screenShots");
const submitScreenshotBtn = document.getElementById("send-screenShots");

// Shared state
const presentStudents = [];
let faceReviewResults = [];
let ocrRawText;
let latestScreenshotId = 0;
let completedScreenshotId = 0;
let submittedScreenshotFile;
let completedMasterlist;

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
  const screenshotId = ++latestScreenshotId;
  const imageFile = fileInputElement.files[0];
  submittedScreenshotFile = imageFile;
  const fileReader = new FileReader();
  const processingCanvas = document.createElement("canvas");
  const canvasContext = processingCanvas.getContext("2d");
  const imageElement = document.createElement("img");
  fileReader.onload = () => {
    if (screenshotId !== latestScreenshotId) return;

    imageElement.onload = async () => {
      if (screenshotId !== latestScreenshotId) return;
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
      await runOcrAndFaceDetection(processingCanvas, imageElement, screenshotId);
    };
    imageElement.src = fileReader.result;
  };
  fileReader.readAsDataURL(imageFile);
}

// Main OCR + face pipeline
async function runOcrAndFaceDetection(screenshotCanvas, screenshotImage, screenshotId) {
  console.log("OCR processing started.");
  let ocrWorker;

  try {
    ocrWorker = await createWorker("eng");
    if (screenshotId !== latestScreenshotId) return;
    const ocrResult = await ocrWorker.recognize(
      screenshotCanvas,
      {},
      {
        blocks: true,
      },
    );
    if (screenshotId !== latestScreenshotId) return;

    const nextOcrRawText = ocrResult.data.text;
    const ocrBlocks = ocrResult.data.blocks || [];

    // extract OCR words and arrange candidate Zoom name labels
    const candidateLabels = extractCandidateLabels(ocrBlocks);

    // match Zoom labels to official students
    const analysisMasterlist = getMasterlistData();
    const matchedLabels = matchCandidateLabelsToStudents(candidateLabels);

    if (!matchedLabels.length) {
      console.warn("No Zoom participant names matched the masterlist.");
      ocrRawText = nextOcrRawText;
      presentStudents.length = 0;
      faceReviewResults = getMasterlistData().map(student => ({
        name: student.name,
        matchStatus: "unmatched",
        reason: "No OCR name matched this student; manual review required"
      }));
      renderCurrentAttendanceTable(presentStudents);
      return;
    }

    const faceAnalysis = await detectAndMatchFaces(screenshotImage, matchedLabels);
    if (screenshotId !== latestScreenshotId) return;
    const matchedNames = new Set(matchedLabels.map(label => label.name));
    const nextFaceReviewResults = [
      ...faceAnalysis.needsReview,
      ...getMasterlistData().filter(student => !matchedNames.has(student.name)).map(student => ({
        name: student.name,
        matchStatus: "unmatched",
        reason: "No OCR name matched this student; manual review required"
      }))
    ];

    // Preserve the existing attendance contract; uncertain results stay in review.
    if (screenshotId !== latestScreenshotId) return;
    ocrRawText = nextOcrRawText;
    faceReviewResults = nextFaceReviewResults;
    presentStudents.length = 0;
    faceAnalysis.results.forEach((result) => {
      if (!result.faceDetected || result.matchStatus !== "matched") return;
      presentStudents.push({ name: result.name, score: result.matchScore });
    });

    renderCurrentAttendanceTable(presentStudents);
    completedScreenshotId = screenshotId;
    completedMasterlist = analysisMasterlist;
    console.log("Current attendance:", presentStudents);
  } catch (error) {
    if (screenshotId !== latestScreenshotId) return;
    console.error("Failed to process Zoom screenshot:", error);
    // A failed new analysis must not leave the previous screenshot marked Present.
    presentStudents.length = 0;
    ocrRawText = undefined;
    faceReviewResults = getMasterlistData().map(student => ({
      name: student.name,
      matchStatus: "unmatched",
      reason: "Screenshot processing failed; manual review required"
    }));
    renderCurrentAttendanceTable(presentStudents);
  } finally {
    if (ocrWorker) {
      try {
        await ocrWorker.terminate();
      } catch (error) {
        console.warn("Failed to terminate OCR worker:", error);
      }
    }

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

export function getFaceReviewResults() {
  return faceReviewResults;
}

export function getOcrRawText() {
  return ocrRawText;
}

// Saving history requires a completed analysis of these exact current inputs.
export function isAttendanceReady() {
  return completedScreenshotId > 0 && completedScreenshotId === latestScreenshotId
    && submittedScreenshotFile === screenshotFileInput?.files[0]
    && completedMasterlist === getMasterlistData();
}
