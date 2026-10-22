import * as faceapi from 'face-api.js';

let modelLoaded = false;

//Loads the Tiny Face Detector model.
export async function loadFaceDetectionModel() {
  if (modelLoaded) return;
  await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
  modelLoaded = true;
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

        sourceX: sourceX,
        sourceY: sourceY,
        tileWidth: tileWidth,
        tileHeight: tileHeight,

        faceCount: detections.length,
        hasFace: detections.length > 0
      });
    }
  }

  return results;
}

export async function detectFacesInRegions(
  imageSource,
  participantRegions
) {

  await loadFaceDetectionModel();


  const detectorOptions =
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.25
    });


  const canvas =
    document.createElement("canvas");

  const context =
    canvas.getContext("2d");


  const results = [];


  for (const region of participantRegions) {

    
     //shrink the participant region.
    const horizontalPadding =
      region.width * 0.08;

    const topPadding =
      region.height * 0.05;

    
     //remove more space from the bottom where name label is placed.
    const bottomPadding =
      region.height * 0.18;


    const safeX =
      region.sourceX +
      horizontalPadding;

    const safeY =
      region.sourceY +
      topPadding;


    const safeWidth =
      region.width -
      (horizontalPadding * 2);

    const safeHeight =
      region.height -
      topPadding -
      bottomPadding;


     //prevent invalid canvas sizes.
    if (
      safeWidth <= 0 ||
      safeHeight <= 0
    ) {

      results.push({
        ...region,

        faceCount: 0,
        hasFace: false
      });

      continue;
    }


    canvas.width =
      Math.max(
        1,
        Math.round(safeWidth)
      );

    canvas.height =
      Math.max(
        1,
        Math.round(safeHeight)
      );


    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    context.drawImage(
      imageSource,

      safeX,
      safeY,
      safeWidth,
      safeHeight,

      0,
      0,
      canvas.width,
      canvas.height
    );


    const detections =
      await faceapi.detectAllFaces(
        canvas,
        detectorOptions
      );


    results.push({
      ...region,

      faceCount:
        detections.length,

      hasFace:
        detections.length > 0,

       //temporary for debugging, use for checking if participant crop is correct.
      detectionX:
        safeX,

      detectionY:
        safeY,

      detectionWidth:
        safeWidth,

      detectionHeight:
        safeHeight
    });

  }


  return results;
}
