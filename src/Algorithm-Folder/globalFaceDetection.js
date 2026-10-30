import * as faceapi from "face-api.js";
import {
  detectFaces,
  loadFaceDetectionModel
} from "./faceDetection.js";

// Converts face-api results into our own coordinate format.
function formatFace(detection, offsetX = 0, offsetY = 0) {
  const box = detection.box;

  return {
    x: box.x + offsetX,
    y: box.y + offsetY,
    width: box.width,
    height: box.height,
    centerX: box.x + offsetX + box.width / 2,
    centerY: box.y + offsetY + box.height / 2,
    confidence: detection.score
  };
}

function getArea(box) {
  return box.width * box.height;
}

// Measures how much of the smaller rectangle is covered.
function calculateOverlapOfSmaller(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  const intersection =
    Math.max(0, right - left) *
    Math.max(0, bottom - top);

  const smallerArea = Math.min(getArea(a), getArea(b));

  return smallerArea > 0 ? intersection / smallerArea : 0;
}

function isSameFace(a, b) {
  const distance = Math.hypot(
    a.centerX - b.centerX,
    a.centerY - b.centerY
  );

  const smallerWidth = Math.min(a.width, b.width);
  const smallerHeight = Math.min(a.height, b.height);

  // Compare center distance relative to face dimensions.
  const closeCenters =
    distance < Math.min(smallerWidth, smallerHeight) * 0.45;

  const significantOverlap =
    calculateOverlapOfSmaller(a, b) > 0.65;

  return closeCenters && significantOverlap;
}

function removeDuplicateFaces(faces) {
  const sorted = [...faces].sort(
    (a, b) => b.confidence - a.confidence
  );

  const unique = [];

  for (const face of sorted) {
    const duplicate = unique.some(
      existing => isSameFace(face, existing)
    );

    if (!duplicate) {
      unique.push(face);
    }
  }

  return unique.map((face, index) => ({
    ...face,
    id: index + 1
  }));
}


// Run the full-image pass before the overlapping regional scans.
export async function detectGlobalFaces(imageSource) {
  const detections = await detectFaces(imageSource);

  return detections.map((detection, index) => ({
    id: index + 1,
    ...formatFace(detection)
  }));
}

// Detect faces using overlapping screenshot regions.
export async function detectFacesMultiRegion(imageSource) {
  await loadFaceDetectionModel();

  const imageWidth =
    imageSource.naturalWidth || imageSource.width;

  const imageHeight =
    imageSource.naturalHeight || imageSource.height;

  // These are detection windows, NOT Zoom participant tiles.
  const scanColumns = 3;
  const scanRows = 2;
  const overlap = 0.25;

  const windowWidth = imageWidth / scanColumns;
  const windowHeight = imageHeight / scanRows;

  const detectedFaces = [];

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to initialize face detection canvas.");
  }

  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.3
  });

  // Include the global pass so larger faces are not missed.
  const globalFaces = await detectGlobalFaces(imageSource);
  detectedFaces.push(...globalFaces);

  for (let row = 0; row < scanRows; row++) {
    for (let column = 0; column < scanColumns; column++) {

      // Expand each detection window so adjacent windows overlap.
      const x = Math.max(
        0,
        Math.floor(column * windowWidth - windowWidth * overlap)
      );

      const y = Math.max(
        0,
        Math.floor(row * windowHeight - windowHeight * overlap)
      );

      const right = Math.min(
        imageWidth,
        Math.ceil((column + 1) * windowWidth + windowWidth * overlap)
      );

      const bottom = Math.min(
        imageHeight,
        Math.ceil((row + 1) * windowHeight + windowHeight * overlap)
      );

      const cropWidth = right - x;
      const cropHeight = bottom - y;

      if (cropWidth <= 0 || cropHeight <= 0) continue;

      canvas.width = cropWidth;
      canvas.height = cropHeight;

      context.drawImage(
        imageSource,
        x, y, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );

      const regionDetections = await faceapi.detectAllFaces(
        canvas,
        detectorOptions
      );

      for (const detection of regionDetections) {
        detectedFaces.push(formatFace(detection, x, y));
      }
    }
  }

  const uniqueFaces = removeDuplicateFaces(detectedFaces);

  return uniqueFaces;
}
