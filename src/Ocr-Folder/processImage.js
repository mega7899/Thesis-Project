//Import Functions That Came From The Installed Dependencies
import { createWorker } from "tesseract.js";
import { InvertFilter } from "image-filter-js";
import { partial_ratio } from "fuzzball";

//Import The Extracted Student Name, and Student Name That Came From Ocr
import { getMasterlistData } from "../Compiler-Folder/studentRegister.js";
import { detectFacesInRegions } from "../Face-Recognition-Folder/faceDetection.js";
import { buildParticipantRegions } from "../Face-Recognition-Folder/layoutDetection.js";

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

// OCR word extraction
function extractOcrWords(ocrBlocks) {
  const words = [];

  ocrBlocks.forEach((block) => {
    block.paragraphs?.forEach((paragraph) => {
      paragraph.lines?.forEach((line) => {
        line.words?.forEach((word) => {
          const text = word.text?.trim();

          if (!text || !word.bbox) return;

          words.push({
            text: text,
            bbox: word.bbox,
            centerY: (word.bbox.y0 + word.bbox.y1) / 2,
            height: word.bbox.y1 - word.bbox.y0,
          });
        });
      });
    });
  });

  return words;
}

// Group OCR words into visual rows
function groupWordsIntoRows(words) {
  if (!words.length) return [];

  const sortedWords = [...words].sort(
    (a, b) => a.centerY - b.centerY || a.bbox.x0 - b.bbox.x0,
  );

  const rows = [];

  sortedWords.forEach((word) => {
    let targetRow = null;

    for (const row of rows) {
      const rowTolerance = Math.max(12, word.height * 1.5);

      if (Math.abs(word.centerY - row.centerY) <= rowTolerance) {
        targetRow = row;
        break;
      }
    }

    if (!targetRow) {
      rows.push({
        centerY: word.centerY,
        words: [word],
      });

      return;
    }

    targetRow.words.push(word);

    targetRow.centerY =
      targetRow.words.reduce((sum, rowWord) => sum + rowWord.centerY, 0) /
      targetRow.words.length;
  });

  return rows;
}

// Split each OCR row into separate Zoom labels
function splitRowIntoLabels(row) {
  const rowWords = [...row.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);

  if (!rowWords.length) return [];

  const averageHeight =
    rowWords.reduce((sum, word) => sum + word.height, 0) / rowWords.length;

  const labelGapThreshold = Math.max(35, averageHeight * 3);
  const labelGroups = [];
  let currentLabelWords = [rowWords[0]];

  for (let wordIndex = 1; wordIndex < rowWords.length; wordIndex++) {
    const previousWord = rowWords[wordIndex - 1];
    const currentWord = rowWords[wordIndex];
    const horizontalGap = currentWord.bbox.x0 - previousWord.bbox.x1;

    if (horizontalGap > labelGapThreshold) {
      labelGroups.push(currentLabelWords);
      currentLabelWords = [currentWord];
    } else {
      currentLabelWords.push(currentWord);
    }
  }

  labelGroups.push(currentLabelWords);

  return labelGroups.map((labelWords) => ({
    text: labelWords
      .map((word) => word.text)
      .join(" ")
      .trim(),

    bbox: {
      x0: Math.min(...labelWords.map((word) => word.bbox.x0)),
      y0: Math.min(...labelWords.map((word) => word.bbox.y0)),
      x1: Math.max(...labelWords.map((word) => word.bbox.x1)),
      y1: Math.max(...labelWords.map((word) => word.bbox.y1)),
    },
  }));
}

// Candidate Zoom labels
function extractCandidateLabels(ocrBlocks) {
  const ocrWords = extractOcrWords(ocrBlocks);
  const ocrRows = groupWordsIntoRows(ocrWords);
  return ocrRows.flatMap((row) => splitRowIntoLabels(row));
}

function normalizeName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[_,-]/g, " ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Match candidate Zoom labels to masterlist
function matchCandidateLabelsToStudents(labels) {
  const masterlist = getMasterlistData();
  const matchCandidates = [];

  labels.forEach((label, labelIndex) => {
    const normalizedLabelText = normalizeName(label.text);

    if (normalizedLabelText.length < 3) return;

    masterlist.forEach((student, studentIndex) => {
      const normalizedStudentName = normalizeName(student.name);

      const normalizedSectionAndName = normalizeName(
        `${student.name}`,
      );

      const nameScore = partial_ratio(
        normalizedLabelText,
        normalizedStudentName,
      );
      const sectionAndNameScore = partial_ratio(
        normalizedLabelText,
        normalizedSectionAndName,
      );
      const bestScore = Math.max(nameScore, sectionAndNameScore);

      if (bestScore >= 60) {
        matchCandidates.push({
          labelIndex: labelIndex,
          studentIndex: studentIndex,
          label: label,
          student: student,
          score: bestScore,
        });
      }
    });
  });

  // Strongest matches get first claim on both the OCR label and student.
  matchCandidates.sort((a, b) => b.score - a.score);

  const claimedLabelIndexes = new Set();
  const claimedStudentIndexes = new Set();
  const bestMatches = [];

  for (const candidate of matchCandidates) {
    if (
      claimedLabelIndexes.has(candidate.labelIndex) ||
      claimedStudentIndexes.has(candidate.studentIndex)
    ) {
      continue;
    }

    claimedLabelIndexes.add(candidate.labelIndex);
    claimedStudentIndexes.add(candidate.studentIndex);

    bestMatches.push({
      name: candidate.student.name,
      matchScore: candidate.score,
      ocrText: candidate.label.text,
      bbox: candidate.label.bbox,
    });
  }
  return bestMatches;
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
