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
