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


  const detectorOptions =
    new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.25
    });


  const cropCanvas =
    document.createElement("canvas");

  const cropContext =
    cropCanvas.getContext("2d");


  const regionResults = [];


  for (const region of participantRegions) {

    
     //shrink the participant region.
    const horizontalPadding =
      region.width * 0.08;

    const topPadding =
      region.height * 0.05;

    
     //remove more space from the bottom where name label is placed.
    const bottomPadding =
      region.height * 0.18;


    const cropX =
      region.sourceX +
      horizontalPadding;

    const cropY =
      region.sourceY +
      topPadding;


    const cropWidth =
      region.width -
      (horizontalPadding * 2);

    const cropHeight =
      region.height -
      topPadding -
      bottomPadding;


     //prevent invalid canvas sizes.
    if (
      cropWidth <= 0 ||
      cropHeight <= 0
    ) {

      regionResults.push({
        ...region,

        faceCount: 0,
        hasFace: false
      });

      continue;
    }


    cropCanvas.width =
      Math.max(
        1,
        Math.round(cropWidth)
      );

    cropCanvas.height =
      Math.max(
        1,
        Math.round(cropHeight)
      );


    cropContext.clearRect(
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    );


    cropContext.drawImage(
      imageSource,

      cropX,
      cropY,
      cropWidth,
      cropHeight,

      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    );


    const detectedFaces =
      await faceapi.detectAllFaces(
        cropCanvas,
        detectorOptions
      );


    regionResults.push({
      ...region,

      faceCount:
        detectedFaces.length,

      hasFace:
        detectedFaces.length > 0,

       //temporary for debugging, use for checking if participant crop is correct.
      detectionX:
        cropX,

      detectionY:
        cropY,

      detectionWidth:
        cropWidth,

      detectionHeight:
        cropHeight
    });

  }


  return regionResults;
}
