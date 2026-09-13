import { createWorker } from "tesseract.js";
import { InvertFilter } from "image-filter-js";
import { getMasterlistData } from "./studentRegister";

//Global Variable
const screenshotFileInput = document.getElementById("screenShots");
const submitScreenshotBtn = document.getElementById("send-screenShots");
const alternativeScreenshotInput = document.getElementById("screenShots");
const matchedSectionCodes = [];
const matchedStudentNames = [];


//Run the program, When the button is cliked
submitScreenshotBtn.addEventListener("click", () => {
  console.log("The button has been clicked pls wait.");

  let activeImageFile;
  if (screenshotFileInput.files[0]) {
    activeImageFile = prepareImageOnCanvas(screenshotFileInput);
  } else if (alternativeScreenshotInput.files[0]) {
    activeImageFile = prepareImageOnCanvas(alternativeScreenshotInput);
  }
});

//Pre-process image
function prepareImageOnCanvas(fileInputElement) {
  const imageFile = fileInputElement.files[0];
  const fileReader = new FileReader();
  const processingCanvas = document.createElement("canvas");
  const canvasContext = processingCanvas.getContext("2d");
  const imageElement = document.createElement("img");

  fileReader.readAsDataURL(imageFile);
  fileReader.onload = () => {
    imageElement.src = fileReader.result;

    imageElement.onload = () => {
      canvasContext.drawImage(imageElement, 0, 0, 1366, 789);
      let filterInstance = new InvertFilter(processingCanvas);
      filterInstance.process(imageElement);
      runOcrAnalysis(processingCanvas);
    };
  };
}

//invert image file to white and text to black
function runOcrAnalysis(canvasSource) {
  console.log("preprocess is working.");

  (async () => {
    const ocrWorker = await createWorker("eng");
    const ocrResult = await ocrWorker.recognize(canvasSource);
    const extractedText = ocrResult.data.text;
    matchOcrNamesWithMasterlist(extractedText);
    await ocrWorker.terminate();
    console.log("the program has stopped.");
  })();
}

//Working on progress
function matchOcrNamesWithMasterlist(rawOcrText) { 
  const masterlistCriteria = getMasterlistData();
  const liveAttendanceTableBody = document.getElementById("studentData");
  const targetSectionPattern = masterlistCriteria.sectionPattern;
  const regexNamePattern = masterlistCriteria.studentName.join('|');
  const searchRegex =  new RegExp(`${regexNamePattern}`, 'g');
  const identifiedMatches = rawOcrText.match(searchRegex);

  console.log(identifiedMatches);

  identifiedMatches.forEach(matchedString => {
    if(matchedString === targetSectionPattern){
      matchedSectionCodes.push(matchedString);
    }else{
      matchedStudentNames.push(matchedString);
    }
  });

  for(let i = 0; i < matchedStudentNames.length; i++){
    const tableRowHtml = `<td>${matchedSectionCodes[i]}</td> <td>${matchedStudentNames[i]}</td><td>Present</td>`;
    liveAttendanceTableBody.insertAdjacentHTML('afterend', tableRowHtml);
  }

  getExtractedStudentNames();
  console.log("the name formater has finished its function.");
}

export function getExtractedStudentNames(){
  const exportedStudentPayload = {
    student: matchedStudentNames
  }

  return exportedStudentPayload;
}