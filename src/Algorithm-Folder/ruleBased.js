import { partial_ratio } from "fuzzball";
import { getMasterlistData } from "./studentRegister.js";

// STEP 1: Pull every word out of the OCR result.
// OCR gives nested data (block > paragraph > line > word), so we flatten it
// into one simple list of words with their position on the screenshot.
function extractOcrWords(ocrBlocks) {
  const words = [];

  ocrBlocks.forEach((block) => {
    block.paragraphs?.forEach((paragraph) => {
      paragraph.lines?.forEach((line) => {
        line.words?.forEach((word) => {
          const text = word.text?.trim();

          // Skip empty words or words without a position
          if (!text || !word.bbox) return;

          words.push({
            text: text,
            bbox: word.bbox,
            centerY: (word.bbox.y0 + word.bbox.y1) / 2, // vertical middle of the word
            height: word.bbox.y1 - word.bbox.y0,
          });
        });
      });
    });
  });

  return words;
}

// STEP 2: Group words that sit at the same height into rows.
// Words whose vertical middles are close together belong to the same row.
function groupWordsIntoRows(words) {
  if (!words.length) return [];

  // Sort top to bottom, then left to right
  const sortedWords = [...words].sort(
    (a, b) => a.centerY - b.centerY || a.bbox.x0 - b.bbox.x0,
  );

  const rows = [];

  sortedWords.forEach((word) => {
    let targetRow = null;

    // Look for an existing row at about the same height
    for (const row of rows) {
      const rowTolerance = Math.max(12, word.height * 1.5);

      if (Math.abs(word.centerY - row.centerY) <= rowTolerance) {
        targetRow = row;
        break;
      }
    }

    // No row found, so start a new one
    if (!targetRow) {
      rows.push({
        centerY: word.centerY,
        words: [word],
      });

      return;
    }

    // Row found: add the word and update the row's average height
    targetRow.words.push(word);

    targetRow.centerY =
      targetRow.words.reduce((sum, rowWord) => sum + rowWord.centerY, 0) /
      targetRow.words.length;
  });

  return rows;
}

// STEP 3: Split a row into separate Zoom name labels.
// One row can hold several participants side by side, so a big horizontal
// gap between words means "this is a new person's label".
function splitRowIntoLabels(row) {
  // Order the words left to right
  const rowWords = [...row.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);

  if (!rowWords.length) return [];

  const averageHeight =
    rowWords.reduce((sum, word) => sum + word.height, 0) / rowWords.length;

  // How wide a gap must be to count as a new label
  const labelGapThreshold = Math.max(35, averageHeight * 3);
  const labelGroups = [];
  let currentLabelWords = [rowWords[0]];

  for (let wordIndex = 1; wordIndex < rowWords.length; wordIndex++) {
    const previousWord = rowWords[wordIndex - 1];
    const currentWord = rowWords[wordIndex];
    const horizontalGap = currentWord.bbox.x0 - previousWord.bbox.x1;

    if (horizontalGap > labelGapThreshold) {
      // Big gap: close the current label and start a new one
      labelGroups.push(currentLabelWords);
      currentLabelWords = [currentWord];
    } else {
      // Small gap: same label, keep adding words
      currentLabelWords.push(currentWord);
    }
  }

  labelGroups.push(currentLabelWords);

  // Turn each group of words into one label: joined text + one box around it
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

// Runs steps 1-3: OCR result in, list of possible Zoom name labels out
export function extractCandidateLabels(ocrBlocks) {
  const ocrWords = extractOcrWords(ocrBlocks);
  const ocrRows = groupWordsIntoRows(ocrWords);
  return ocrRows.flatMap((row) => splitRowIntoLabels(row));
}

// Clean a name so two spellings can be compared fairly:
// uppercase, remove symbols, and keep single spaces only.
function normalizeName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[_,-]/g, " ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameVariants(name) {
  const normalized = normalizeName(name);
  const parts = normalized.split(" ").filter(Boolean);
  const variants = [normalized];

  // The roster uses "LAST, FIRST" while Zoom may show "FIRST LAST".
  if (parts.length > 1) {
    variants.push([...parts.slice(1), parts[0]].join(" "));
  }

  return [...new Set(variants)];
}

function scoreName(labelText, studentName) {
  const label = normalizeName(labelText);
  return Math.max(
    ...nameVariants(studentName).map((variant) => partial_ratio(label, variant)),
  );
}

// STEP 4: Match each label to a student in the masterlist.
export function matchCandidateLabelsToStudents(labels) {
  const masterlist = getMasterlistData();
  const matchCandidates = [];

  // Compare every label against every student. Matching is deliberately
  // independent of face detection: face detection decides camera state later.
  labels.forEach((label, labelIndex) => {
    const normalizedLabelText = normalizeName(label.text);
    if (normalizedLabelText.length < 3) return;

    masterlist.forEach((student, studentIndex) => {
      const bestScore = scoreName(normalizedLabelText, student.name);

      // 55 allows common OCR errors, but the best unique match still wins.
      if (bestScore >= 55) {
        matchCandidates.push({
          labelIndex,
          studentIndex,
          label,
          student,
          score: bestScore,
        });
      }
    });
  });

  // Strongest matches get first claim on both the OCR label and student.
  matchCandidates.sort((a, b) => b.score - a.score);

  // Track who is already matched so nobody is used twice
  const claimedLabelIndexes = new Set();
  const claimedStudentIndexes = new Set();
  const bestMatches = [];

  for (const candidate of matchCandidates) {
    // Skip if this label or this student was already matched
    if (
      claimedLabelIndexes.has(candidate.labelIndex) ||
      claimedStudentIndexes.has(candidate.studentIndex)
    ) {
      continue;
    }

    claimedLabelIndexes.add(candidate.labelIndex);
    claimedStudentIndexes.add(candidate.studentIndex);

    // Save the final match: the student, how sure we are, and where it appeared
    bestMatches.push({
      name: candidate.student.name,
      matchScore: candidate.score,
      ocrText: candidate.label.text,
      bbox: candidate.label.bbox,
    });
  }
  return bestMatches;
}
