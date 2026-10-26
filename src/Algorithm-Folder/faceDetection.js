import * as faceapi from 'face-api.js';

let isFaceModelLoaded = false;

//Loads the Tiny Face Detector model.
export async function loadFaceDetectionModel() {
  if (isFaceModelLoaded) return;
  await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
  isFaceModelLoaded = true;
  console.log('Face detection model loaded.');
}

//Detects every visible face inside an image.
export async function detectFaces(imageSource) {
  await loadFaceDetectionModel();

  const detectorOptions =
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.5
    });

  const detectedFaces =
    await faceapi.detectAllFaces(
      imageSource,
      detectorOptions
    );

  console.log(
    `Detected ${detectedFaces.length} face(s).`
  );

  return detectedFaces;
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

  const tileResults = [];

  const tileCanvas = document.createElement('canvas');
  const tileContext = tileCanvas.getContext('2d');

  tileCanvas.width = tileWidth;
  tileCanvas.height = tileHeight;

  const detectorOptions =
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.25
    });

  for (let rowIndex = 0; rowIndex < rows; rowIndex++) {

    for (let columnIndex = 0; columnIndex < columns; columnIndex++) {

      const sourceX = startX + (columnIndex * tileWidth);
      const sourceY = startY + (rowIndex * tileHeight);

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

      const detectedFaces =
        await faceapi.detectAllFaces(
          tileCanvas,
          detectorOptions
        );

      tileResults.push({
        row: rowIndex,
        column: columnIndex,
        tileNumber: (rowIndex * columns) + columnIndex + 1,

        sourceX: sourceX,
        sourceY: sourceY,
        tileWidth: tileWidth,
        tileHeight: tileHeight,

        faceCount: detectedFaces.length,
        hasFace: detectedFaces.length > 0
      });
    }
  }

  return tileResults;
}

export async function detectFacesInRegions(
  imageSource,
  participantRegions
) {


  await loadFaceDetectionModel();


  // Use a larger detector input and a modest threshold because Zoom tiles
  // often contain small, dim faces. A camera-off tile still produces zero faces.
  const detectorOptions =
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.2
    });


  // Detect on the original screenshot once. Cropping each tile first made the
  // inferred regions too sensitive to OCR grouping and often cut faces off.
  const fullImageFaces = await faceapi.detectAllFaces(
    imageSource,
    detectorOptions,
  );

  const regionResults = [];

  for (const region of participantRegions) {
    const regionFaces = fullImageFaces.filter((face) => {
      const box = face.box;
      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const regionRight = region.sourceX + region.width;
      const regionBottom = region.sourceY + region.height;

      return (
        faceCenterX >= region.sourceX &&
        faceCenterX <= regionRight &&
        faceCenterY >= region.sourceY &&
        faceCenterY <= regionBottom
      );
    });

    regionResults.push({
      ...region,
      faceCount: regionFaces.length,
      hasFace: regionFaces.length > 0,
      detectionX: region.sourceX,
      detectionY: region.sourceY,
      detectionWidth: region.width,
      detectionHeight: region.height,
    });

  }


  return regionResults;
}
