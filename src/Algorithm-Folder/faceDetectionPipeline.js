import * as faceapi from "face-api.js";
import { detectFacesMultiRegion } from "./globalFaceDetection.js";
import { matchFacesToNames } from "./faceNameMatching.js";

function isEligible(result) {
  return !result.faceDetected && result.matchStatus === "unmatched" &&
    result.diagnostics?.geometryReliable === true &&
    result.diagnostics.candidates.length === 0;
}

function withinArea(face, area) {
  return [face.x, face.y, face.width, face.height, face.confidence].every(Number.isFinite) &&
    face.width > 0 && face.height > 0 &&
    face.x >= area.left && face.y >= area.top &&
    face.x + face.width <= area.right && face.y + face.height <= area.bottom;
}

/**
 * Run the existing detector/matcher, then try each reliable empty region once.
 * Fallback uses the same regional TinyFaceDetector settings and at most 3 crops.
 * It can fill an unmatched result but cannot replace any existing association.
 * This returns review evidence; callers decide when to integrate attendance.
 */
export async function detectAndMatchFaces(
  imageSource,
  labels,
  { maxFallbackRegions = 3 } = {}
) {
  const imageWidth = imageSource.naturalWidth || imageSource.width;
  const imageHeight = imageSource.naturalHeight || imageSource.height;
  let faces = [...await detectFacesMultiRegion(imageSource)];
  const match = candidateFaces => matchFacesToNames(
    labels, candidateFaces, imageWidth, imageHeight, { includeDiagnostics: true }
  );
  let results = match(faces);
  const initiallyEligible = results.map((result, labelIndex) => ({ result, labelIndex }))
    .filter(({ result }) => isEligible(result));
  const budget = Math.min(3, Math.max(0, Math.floor(Number(maxFallbackRegions) || 0)));
  const fallbackAttempts = [];
  let options;

  for (const { result: initial, labelIndex } of initiallyEligible) {
    if (fallbackAttempts.length >= budget) break;
    if (results[labelIndex].faceDetected) continue;
    const { assignmentArea: area, rowY, rowHeight, textHeight } = initial.diagnostics;
    const crop = {
      x: Math.max(0, area.left),
      y: Math.max(0, rowY - rowHeight),
      right: Math.min(imageWidth, area.right),
      bottom: Math.min(imageHeight, rowY)
    };
    crop.width = crop.right - crop.x;
    crop.height = crop.bottom - crop.y;
    // use a small target area to spot face centers, 
    // but the whole bounding box needs to stay inside the video frame and its name label.
    
    const validationArea = {
      left: crop.x, right: crop.right, top: crop.y,
      bottom: Math.min(imageHeight, rowY + textHeight)
    };
    const attempt = { name: initial.name, labelIndex, crop, validationArea, status: "pending" };
    fallbackAttempts.push(attempt);
    try {
      if (![crop.x, crop.y, crop.width, crop.height, textHeight].every(Number.isFinite) ||
        crop.width <= 0 || crop.height <= 0 || textHeight <= 0) throw new Error("Invalid fallback region");
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(crop.width));
      canvas.height = Math.max(1, Math.round(crop.height));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to initialize fallback canvas");
      context.drawImage(imageSource, crop.x, crop.y, crop.width, crop.height,
        0, 0, canvas.width, canvas.height);
      options ||= new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 });
      const start = performance.now();
      const detections = await faceapi.detectAllFaces(canvas, options);
      attempt.elapsedMs = performance.now() - start;
      attempt.detectedCount = detections.length;
      if (detections.length !== 1) {
        attempt.status = detections.length ? "ambiguous" : "no-face";
        attempt.reason = detections.length
          ? "Multiple fallback detections; manual review required"
          : "No face detected in fallback crop; manual review required";
        continue;
      }
      const detection = detections[0];
      const scaleX = crop.width / canvas.width;
      const scaleY = crop.height / canvas.height;
      const face = {
        id: Math.max(0, ...faces.map(item => Number.isFinite(item.id) ? item.id : 0)) + 1,
        x: crop.x + detection.box.x * scaleX,
        y: crop.y + detection.box.y * scaleY,
        width: detection.box.width * scaleX,
        height: detection.box.height * scaleY,
        confidence: detection.score,
        source: "fallback"
      };
      face.centerX = face.x + face.width / 2;
      face.centerY = face.y + face.height / 2;
      attempt.candidate = face;
      // A clipped portrait can predict past its video crop into its own name
      // strip. Normal matching below still checks the original center gate.
      if (!withinArea(face, validationArea)) {
        attempt.status = "rejected";
        attempt.reason = "Fallback box is outside its reliable row area; manual review required";
        continue;
      }
      const candidateFaces = [...faces, face];
      const candidateResults = match(candidateFaces);
      const preserved = results.every((result, index) => !result.faceDetected ||
        candidateResults[index]?.faceDetected && candidateResults[index].faceId === result.faceId);
      if (!preserved || !candidateResults[labelIndex]?.faceDetected ||
        candidateResults[labelIndex].faceId !== face.id) {
        attempt.status = "rejected";
        attempt.reason = "Fallback cannot preserve existing associations; manual review required";
        continue;
      }
      faces = candidateFaces;
      results = candidateResults;
      attempt.status = "accepted";
      attempt.faceId = face.id;
    } catch (error) {
      attempt.status = "error";
      attempt.reason = `Fallback failed: ${error.message || String(error)}`;
    }
  }

  const needsReview = results.flatMap((result, labelIndex) => {
    if (result.faceDetected && result.matchStatus === "matched") return [];
    const attempt = fallbackAttempts.find(item => item.labelIndex === labelIndex);
    return [{ name: result.name, matchStatus: result.matchStatus,
      reason: attempt?.reason || "No reliable face-to-name association; manual review required" }];
  });
  return { faces, results, needsReview, fallbackAttempts };
}
