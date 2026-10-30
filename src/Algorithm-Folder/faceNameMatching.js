
/**
 * Associate detected faces with OCR-matched student names.
 *
 * Input:
 * labels: [{ name, bbox, matchScore, ... }]
 * faces:  [{ id, x, y, width, height,
 *            centerX, centerY, confidence }]
 *
 * Output:
 * [{ name, faceDetected, faceId, confidence,
 *    matchScore, matchStatus }]
 * Pass { includeDiagnostics: true } to inspect the existing assignment areas
 * and candidate scores without changing how faces are assigned.
 */

function median(values) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function hasNameEvidence(label) {
  // Older direct callers may omit OCR text. When supplied, a weak fuzzy
  // resemblance alone must not turn video details into participant anchors.
  if (label.ocrText === undefined) return true;
  const tokens = text => String(text || "").toUpperCase().match(/[\p{L}\p{N}]+/gu) || [];
  const official = tokens(label.name);
  const recognized = new Set(tokens(label.ocrText));
  const distinctive = official.filter(token => token.length >= 3);
  return distinctive.length
    ? distinctive.some(token => recognized.has(token))
    : official.length > 0 && official.every(token => recognized.has(token));
}

function groupLabelsIntoRows(labels) {
  const heights = labels
    .map(label => label.bbox.y1 - label.bbox.y0)
    .filter(height => Number.isFinite(height) && height > 0);

  const typicalTextHeight = median(heights);
  const tolerance = Math.max(14, typicalTextHeight * 2);
  const normalHeight = label => {
    const height = label.bbox.y1 - label.bbox.y0;
    return Number.isFinite(height) && height > 0 && height <= typicalTextHeight * 2 &&
      Number.isFinite(label.bbox.y0);
  };

  // Tall OCR rectangles can begin in the video above a name or extend into
  // another row. Let ordinary text establish row anchors first.
  const sorted = labels.filter(normalHeight).sort(
    (a, b) => a.bbox.y0 - b.bbox.y0
  );

  const rows = [];

  for (const label of sorted) {
    const row = rows.find(
      existing =>
        Math.abs(existing.y - label.bbox.y0) <= tolerance
    );

    if (row) {
      row.labels.push(label);
      row.y = median(row.labels.map(item => item.bbox.y0));
    } else {
      rows.push({
        y: label.bbox.y0,
        labels: [label]
      });
    }
  }

  for (const label of labels.filter(item => !normalHeight(item))) {
    const nearTop = rows.filter(row => Math.abs(row.y - label.bbox.y0) <= tolerance)
      .sort((a, b) => Math.abs(a.y - label.bbox.y0) - Math.abs(b.y - label.bbox.y0));
    const spanned = rows.filter(row => row.y >= label.bbox.y0 && row.y <= label.bbox.y1);
    // Preserve the existing top-Y behavior whenever an established row
    // supports it. Otherwise require one supported row within the box.
    const row = nearTop[0] || (spanned.length === 1 ? spanned[0] : null);
    if (row) row.labels.push(label);
    // An unplaceable tall label remains ambiguous; it cannot create or move
    // an anchor that would change other participants' vertical areas.
  }

  return rows.sort((a, b) => a.y - b.y);
}

/**
 * A face must be spatially plausible for a label:
 * - Located above the label
 * - Approximately aligned with its horizontal region
 * - Not clearly in a different participant row
 */
export function matchFacesToNames(
  labels,
  faces,
  imageWidth,
  imageHeight,
  { includeDiagnostics = false } = {}
) {
  if (!labels.length) return [];

  const supportedLabels = labels.filter(hasNameEvidence);
  const rows = groupLabelsIntoRows(supportedLabels);
  const textHeight = median(supportedLabels.map(label => label.bbox.y1 - label.bbox.y0)
    .filter(height => Number.isFinite(height) && height > 0));
  const results = labels.map(label => ({
    name: label.name,
    matchScore: label.matchScore,
    faceDetected: false,
    faceId: null,
    confidence: null,
    matchStatus: "unmatched"
  }));

  // Estimate the vertical distance between participant rows.
  const rowDistances = [];

  for (let index = 1; index < rows.length; index++) {
    rowDistances.push(rows[index].y - rows[index - 1].y);
  }

  const typicalRowHeight = rowDistances.length
    ? median(rowDistances)
    : imageHeight;

  // Label starts are approximate left edges, not tile centers. A shared pitch
  // estimates size only; each row retains its own origin for centered rows.
  const horizontalGaps = rows.flatMap(row => {
    const ordered = [...row.labels].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    return ordered.slice(1).map((label, index) =>
      label.bbox.x0 - ordered[index].bbox.x0
    ).filter(gap => gap > 0);
  });
  const typicalPitch = median(horizontalGaps);
  const widestAnchorSpan = Math.max(...rows.map(row => {
    const starts = row.labels.map(label => label.bbox.x0);
    return Math.max(...starts) - Math.min(...starts);
  }));
  // OCR starts include varying label padding. Count whole slot gaps, as we
  // already do below, before checking whether the inferred row fits the image.
  // Sparse anchors must still imply a row that fits within the screenshot.
  const trustworthyPitch = !typicalPitch ||
    (Math.round(widestAnchorSpan / typicalPitch) + 1) * typicalPitch <= imageWidth;
  const proposals = [];

  for (let labelIndex = 0; labelIndex < labels.length; labelIndex++) {
    const label = labels[labelIndex];

    const rowIndex = rows.findIndex(
      row => row.labels.includes(label)
    );

    if (rowIndex < 0) {
      results[labelIndex].matchStatus = "ambiguous";
      if (includeDiagnostics) {
        results[labelIndex].diagnostics = {
          labelIndex,
          geometryReliable: false,
          pitch: typicalPitch || imageWidth,
          rowY: null,
          rowHeight: typicalRowHeight,
          textHeight,
          assignmentArea: null,
          candidates: [],
          rejectionReason: hasNameEvidence(label)
            ? "OCR box has no supported row; manual review required"
            : "OCR text lacks recognizable official-name evidence; manual review required"
        };
      }
      continue;
    }

    const rowY = rows[rowIndex].y;
    const previousRowY = rowIndex > 0
      ? rows[rowIndex - 1].y
      : rowY - typicalRowHeight;

    // Face center should lie above the name label.
    const upperLimit = Math.max(
      0,
      (previousRowY + rowY) / 2
    );

    const lowerLimit = Math.min(
      imageHeight,
      rowY + typicalRowHeight * 0.12
    );

    // Compare with other name labels in the same row.
    const rowLabels = [...rows[rowIndex].labels].sort(
      (a, b) => a.bbox.x0 - b.bbox.x0
    );

    const pitch = typicalPitch || imageWidth;
    // OCR fragments can begin inside a tile. The least-shifted row anchor
    // avoids treating the width or center of a short fragment as a tile edge.
    const slots = [0];
    for (let index = 1; index < rowLabels.length; index++) {
      const gap = rowLabels[index].bbox.x0 - rowLabels[index - 1].bbox.x0;
      // A skipped OCR label leaves its slot empty instead of widening a
      // neighbor's region or shifting all subsequent names by one tile.
      slots.push(slots[index - 1] + (gap > 0 ? Math.round(gap / pitch) : 0));
    }
    const origin = typicalPitch
      ? Math.min(...rowLabels.map((item, index) => item.bbox.x0 - slots[index] * pitch))
      : 0;
    const slot = slots[rowLabels.indexOf(label)];
    const occupiedSlots = slots.filter(item => item === slot);
    const leftLimit = Math.max(0, origin + slot * pitch);
    const rightLimit = Math.min(imageWidth, origin + (slot + 1) * pitch);
    const ambiguousGeometry = !trustworthyPitch || occupiedSlots.length > 1;
    if (ambiguousGeometry) results[labelIndex].matchStatus = "ambiguous";

    if (includeDiagnostics) {
      results[labelIndex].diagnostics = {
        labelIndex,
        geometryReliable: !ambiguousGeometry && typicalPitch > 0,
        pitch,
        rowY,
        rowHeight: typicalRowHeight,
        textHeight,
        assignmentArea: {
          left: leftLimit,
          right: rightLimit,
          top: upperLimit,
          bottom: lowerLimit
        },
        candidates: []
      };
    }

    if (ambiguousGeometry) continue;

    // A cell estimate alone is insufficient near an uncertain OCR edge.
    // Require agreement with the nearest text center in this same row.
    // Cap OCR width by the pitch so an oversized box cannot move its center
    // across multiple participant cells. This check only rejects conflicts;
    // it never loans the face to the other label.
    const textCenters = rowLabels.map(item => {
      const width = item.bbox.x1 - item.bbox.x0;
      return Number.isFinite(width) && width > 0
        ? item.bbox.x0 + Math.min(width, pitch) / 2
        : NaN;
    });
    let ownershipConflict = false;
    let candidateCount = 0;
    for (let faceIndex = 0; faceIndex < faces.length; faceIndex++) {
      const face = faces[faceIndex];

      if (
        ![face.x, face.y, face.width, face.height, face.centerX, face.centerY, face.confidence].every(Number.isFinite) ||
        face.width <= 0 || face.height <= 0 ||
        face.width >= rightLimit - leftLimit ||
        face.centerX < leftLimit ||
        face.centerX >= rightLimit ||
        face.centerY < upperLimit ||
        face.centerY > lowerLimit
      ) {
        continue;
      }

      const distances = textCenters.map(center => Math.abs(face.centerX - center));
      const nearest = Math.min(...distances);
      const ownDistance = distances[rowLabels.indexOf(label)];
      if (!Number.isFinite(nearest) || ownDistance !== nearest ||
        distances.filter(distance => distance === nearest).length !== 1) {
        ownershipConflict = true;
        continue;
      }
      // A lone OCR label does not establish participant width. Do not claim
      // a horizontally disconnected face from somewhere else in the image.
      if (!typicalPitch && (face.x > label.bbox.x1 ||
        face.x + face.width < label.bbox.x0)) {
        ownershipConflict = true;
        continue;
      }

      const labelCenterX = (leftLimit + rightLimit) / 2;

      // Prefer faces close to the name horizontally.
      const horizontalDistance = Math.abs(
        face.centerX - labelCenterX
      );

      const rowWidth = Math.max(1, rightLimit - leftLimit);

      const alignmentScore =
        1 - Math.min(1, horizontalDistance / rowWidth);

      const score =
        alignmentScore * 0.65 +
        face.confidence * 0.35;

      proposals.push({
        labelIndex,
        faceIndex,
        score
      });
      candidateCount++;
    }
    if (ownershipConflict && candidateCount === 0) {
      results[labelIndex].matchStatus = "ambiguous";
      if (includeDiagnostics) {
        results[labelIndex].diagnostics.rejectionReason =
          "Cell ownership conflicts with the nearest OCR label; manual review required";
      }
    }
  }

  // Best candidates get first claim on a label and face.
  proposals.sort((a, b) => b.score - a.score);

  if (includeDiagnostics) {
    for (const proposal of proposals) {
      results[proposal.labelIndex].diagnostics.candidates.push({
        faceId: faces[proposal.faceIndex].id,
        score: proposal.score
      });
    }
  }

  const usedLabels = new Set();
  const usedFaces = new Set();

  for (const proposal of proposals) {
    if (
      usedLabels.has(proposal.labelIndex) ||
      usedFaces.has(faces[proposal.faceIndex].id)
    ) {
      continue;
    }

    const face = faces[proposal.faceIndex];

    usedLabels.add(proposal.labelIndex);
    usedFaces.add(face.id);

    results[proposal.labelIndex] = {
      ...results[proposal.labelIndex],
      faceDetected: true,
      faceId: face.id,
      confidence: face.confidence,
      matchStatus: "matched"
    };
  }

  return results;
}
