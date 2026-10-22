//Import Functions That Came From The Installed Dependencies
import { createWorker } from "tesseract.js";
import { InvertFilter } from "image-filter-js";
import { partial_ratio } from "fuzzball";

//Import The Extracted Student Name, and Student Name That Came From Ocr
import { getMasterlistData } from "../Compiler-Folder/studentRegister.js";
import { detectFacesInRegions } from "../Face-Recognition-Folder/faceDetection.js";
import { buildParticipantRegions } from "../Face-Recognition-Folder/layoutDetection.js";

// DOM
const masterlistFiles = document.getElementById("masterList");
const screenshotFileInput = document.getElementById("screenShots");
const submitScreenshotBtn = document.getElementById("send-screenShots");

// Shared state
const studentCount = [];
let rawScannedOcr;

// Screenshot upload
if (submitScreenshotBtn) {
  submitScreenshotBtn.addEventListener("click", () => {
    console.log("Screenshot processing started.");

    if (!screenshotFileInput?.files[0])
      return console.warn("No Zoom screenshot selected.");
    if (!masterlistFiles?.files[0])
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

      const filterInstance = new InvertFilter(processingCanvas);
      filterInstance.process(imageElement);
      await runOcrAnalysis(processingCanvas, imageElement);
    };
  };
}

// Main OCR + face pipeline
async function runOcrAnalysis(canvasSource, originalImage) {
  console.log("OCR processing started.");
  const ocrWorker = await createWorker("eng");

  try {
    const ocrResult = await ocrWorker.recognize(
      canvasSource,
      {},
      {
        blocks: true,
      },
    );

    rawScannedOcr = ocrResult.data.text;
    const blocks = ocrResult.data.blocks || [];

    // extract OCR words and arrange candidate Zoom name labels
    const candidateLabels = extractCandidateLabels(blocks);

    // match Zoom labels to official students
    const matchedLabels = matchCandidateLabelsToStudents(candidateLabels);

    //for debugging purposes, if nothing match it won't continue
    if (!matchedLabels.length) {
      console.warn("No Zoom participant names matched the masterlist.");
      studentCount.length = 0;
      renderCombineResult(studentCount);
      return;
    }

    // finalize zoom participant regions dynamically
    const participantRegions = buildParticipantRegions(
      matchedLabels,
      originalImage.naturalWidth,
      originalImage.naturalHeight,
    );

    // run face-api on each participant
    const participants = await detectFacesInRegions(
      originalImage,
      participantRegions,
    );

    //Current Attendance
    studentCount.length = 0;

    participants.forEach((participant) => {
      if (!participant.hasFace) return;

      studentCount.push({
        name: participant.name,
        sectionCode: participant.sectionCode,
        score: participant.matchScore,
      });
    });

    renderCombineResult(studentCount);
    console.log("Current attendance:", studentCount);
  } catch (error) {
    console.error("Failed to process Zoom screenshot:", error);
  } finally {
    await ocrWorker.terminate();

    console.log("OCR processing finished.");
  }
}

// OCR word extraction
function extractOcrWords(blocks) {
  const words = [];

  blocks.forEach((block) => {
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

  const sorted = [...words].sort(
    (a, b) => a.centerY - b.centerY || a.bbox.x0 - b.bbox.x0,
  );

  const rows = [];

  sorted.forEach((word) => {
    let targetRow = null;

    for (const row of rows) {
      const tolerance = Math.max(12, word.height * 1.5);

      if (Math.abs(word.centerY - row.centerY) <= tolerance) {
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
      targetRow.words.reduce((sum, item) => sum + item.centerY, 0) /
      targetRow.words.length;
  });

  return rows;
}

// Split each OCR row into separate Zoom labels
function splitRowIntoLabels(row) {
  const words = [...row.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);

  if (!words.length) return [];

  const averageHeight =
    words.reduce((sum, word) => sum + word.height, 0) / words.length;

  const gapThreshold = Math.max(35, averageHeight * 3);
  const groups = [];
  let currentGroup = [words[0]];

  for (let index = 1; index < words.length; index++) {
    const previous = words[index - 1];
    const current = words[index];
    const horizontalGap = current.bbox.x0 - previous.bbox.x1;

    if (horizontalGap > gapThreshold) {
      groups.push(currentGroup);
      currentGroup = [current];
    } else {
      currentGroup.push(current);
    }
  }

  groups.push(currentGroup);

  return groups.map((group) => ({
    text: group
      .map((word) => word.text)
      .join(" ")
      .trim(),

    bbox: {
      x0: Math.min(...group.map((word) => word.bbox.x0)),
      y0: Math.min(...group.map((word) => word.bbox.y0)),
      x1: Math.max(...group.map((word) => word.bbox.x1)),
      y1: Math.max(...group.map((word) => word.bbox.y1)),
    },
  }));
}

// Candidate Zoom labels
function extractCandidateLabels(blocks) {
  const words = extractOcrWords(blocks);
  const rows = groupWordsIntoRows(words);
  return rows.flatMap((row) => splitRowIntoLabels(row));
}

function normalizedForMatch(name) {
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
  const candidates = [];

  labels.forEach((label, labelIndex) => {
    const normalizedOcr = normalizedForMatch(label.text);

    if (normalizedOcr.length < 3) return;

    masterlist.forEach((student, studentIndex) => {
      const normalizedName = normalizedForMatch(student.name);

      const normalizedFullLabel = normalizedForMatch(
        `${student.sectionCode} ${student.name}`,
      );

      const nameScore = partial_ratio(normalizedOcr, normalizedName);
      const completeScore = partial_ratio(normalizedOcr, normalizedFullLabel);
      const score = Math.max(nameScore, completeScore);

      if (score >= 60) {
        candidates.push({
          labelIndex: labelIndex,
          studentIndex: studentIndex,
          label: label,
          student: student,
          score: score,
        });
      }
    });
  });

   // Strongest matches get first claim on both the OCR label and student.
  candidates.sort((a, b) => b.score - a.score);

  const claimedLabels = new Set();
  const claimedStudents = new Set();
  const results = [];

  for (const candidate of candidates) {
    if (
      claimedLabels.has(candidate.labelIndex) ||
      claimedStudents.has(candidate.studentIndex)
    ) {
      continue;
    }

    claimedLabels.add(candidate.labelIndex);
    claimedStudents.add(candidate.studentIndex);

    results.push({
      name: candidate.student.name,
      sectionCode: candidate.student.sectionCode,
      matchScore: candidate.score,
      ocrText: candidate.label.text,
      bbox: candidate.label.bbox,
    });
  }

  return results;
}

// Render Current Attendance
export function renderCombineResult(matchedData) {
  const currentAttendanceTable = document.getElementById("studentData");

  if (!currentAttendanceTable) {
    console.warn("Target element #studentData was not found.");
    return;
  }

  currentAttendanceTable.replaceChildren();

  matchedData.forEach((student) => {
    const studentRow = document.createElement("tr");
    const sectionCell = document.createElement("td");
    const nameCell = document.createElement("td");
    const statusCell = document.createElement("td");

    sectionCell.textContent = student.sectionCode || "N/A";
    nameCell.textContent = student.name;
    statusCell.textContent = "Present";

    studentRow.append(sectionCell, nameCell, statusCell);
    currentAttendanceTable.appendChild(studentRow);
  });
}
// Existing exports used by validation/tests
export function catchStudentName() {
  return studentCount;
}

export function testingMaterials() {
  return rawScannedOcr;
}
