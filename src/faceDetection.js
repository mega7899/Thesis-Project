import * as faceapi from 'face-api.js';

let modelLoaded = false;


/**
 * Loads the Tiny Face Detector model.
 */
export async function loadFaceDetectionModel() {
  if (modelLoaded) {
    return;
  }

  await faceapi.nets.tinyFaceDetector.loadFromUri('/models');

  modelLoaded = true;

  console.log('Face detection model loaded.');
}


/**
 * Detects every visible face inside an image.
 *
 * @param {HTMLImageElement | HTMLCanvasElement} imageSource
 * @returns {Promise<Array>}
 */
export async function detectFaces(imageSource) {
  await loadFaceDetectionModel();

  const detectorOptions =
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.5
    });

  const detections =
    await faceapi.detectAllFaces(
      imageSource,
      detectorOptions
    );

  console.log(
    `Detected ${detections.length} face(s).`
  );

  return detections;
}

export async function detectFacesInGrid(imageSource, gridConfig) {
  await loadFaceDetectionModel();

  const {
    startX,
    startY,
    width,
    height,
    rows,
    columns
  } = gridConfig;

  const tileWidth = width / columns;
  const tileHeight = height / rows;

  const results = [];

  const tileCanvas = document.createElement('canvas');
  const tileContext = tileCanvas.getContext('2d');

  tileCanvas.width = tileWidth;
  tileCanvas.height = tileHeight;

  const detectorOptions =
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.25
    });

  for (let row = 0; row < rows; row++) {

    for (let column = 0; column < columns; column++) {

      const sourceX = startX + (column * tileWidth);
      const sourceY = startY + (row * tileHeight);

      tileContext.clearRect(
        0,
        0,
        tileCanvas.width,
        tileCanvas.height
      );

      tileContext.drawImage(
        imageSource,

        sourceX,
        sourceY,
        tileWidth,
        tileHeight,

        0,
        0,
        tileCanvas.width,
        tileCanvas.height
      );

      const detections =
        await faceapi.detectAllFaces(
          tileCanvas,
          detectorOptions
        );

      results.push({
        row: row,
        column: column,
        tileNumber: (row * columns) + column + 1,
        faceCount: detections.length,
        hasFace: detections.length > 0
      });
    }
  }

  return results;
}