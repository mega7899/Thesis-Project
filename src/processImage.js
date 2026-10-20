import { createWorker } from "tesseract.js";
import { InvertFilter } from "image-filter-js";
import { partial_ratio } from "fuzzball";
import { getMasterlistData } from "./studentRegister";
import { detectFacesInRegions } from "./faceDetection";
import { buildParticipantRegions } from "./layoutDetection";

// DOM
const screenshotFileInput =
  document.getElementById("screenShots");

const submitScreenshotBtn =
  document.getElementById("send-screenShots");

// Shared state

const studentCount = [];

let rawScannedOcr;

//Testing Materials
let extractedOcr;

// Run the program, When the button is clicked
if (submitScreenshotBtn) {
  submitScreenshotBtn.addEventListener("click", () => {
    console.log("The button has been clicked pls wait.");

    let activeImageFile;
    if (screenshotFileInput.files[0]) {
      activeImageFile = prepareImageOnCanvas(screenshotFileInput);
    } else if (alternativeScreenshotInput.files[0]) {
      activeImageFile = prepareImageOnCanvas(alternativeScreenshotInput);
    }
  });
}
// Pre-process image
function prepareImageOnCanvas(fileInputElement) {
  const imageFile = fileInputElement.files[0];
  const fileReader = new FileReader();
  const processingCanvas = document.createElement("canvas");
  const canvasContext = processingCanvas.getContext("2d");
  const imageElement = document.createElement("img");

  fileReader.onload = () => {

    imageElement.src =
      fileReader.result;


    imageElement.onload =
      async () => {

        //keep the original screenshot in memory for face-api and OCR processing.
         
        processingCanvas.width =
          imageElement.naturalWidth;

        processingCanvas.height =
          imageElement.naturalHeight;

        canvasContext.drawImage(
          imageElement,
          0,
          0,
          processingCanvas.width,
          processingCanvas.height
        );

        const filterInstance =
          new InvertFilter(
            processingCanvas
          );


        filterInstance.process(
          imageElement
        );

        await runOcrAnalysis(
          processingCanvas,
          imageElement
        );

      };

  };

}

// invert image file to white and text to black
function runOcrAnalysis(canvasSource) {
  console.log("preprocess is working.");

  (async () => {
    const ocrWorker = await createWorker("eng");
    const ocrResult = await ocrWorker.recognize(canvasSource);
    const extractedText = ocrResult.data.text;
    extractedOcr = extractedText;    
    extractingNames(extractedText);
    await ocrWorker.terminate();
    console.log("the program has stopped.");
  })();
}

function extractingNames(text) {
  console.log(typeof extractedOcr);
  const regexPattern = /[A-Z]\d{3,4}[_\s]+[A-Z]/gi;
  const matchText = [...text.matchAll(regexPattern)];

  if (matchText.length > 0) {
    const startIndex = matchText[0].index; 
    const lastMatchIndex = matchText[matchText.length - 1].index;
    
    const candidateLabels =
      extractCandidateLabels(
        blocks
      );

    console.table(
      candidateLabels.map(
        label => ({

          detectedText:
            label.text,

          x:
            Math.round(
              label.bbox.x0
            ),

          y:
            Math.round(
              label.bbox.y0
            )

        })
      )
    );

    // match Zoom labels to official students
   
    const matchedLabels =
      matchCandidateLabelsToStudents(
        candidateLabels
      );

    console.table(
      matchedLabels.map(
        item => ({

          ocrText:
            item.ocrText,

          student:
            item.name,

          section:
            item.sectionCode,

          score:
            item.matchScore,

          x:
            Math.round(
              item.bbox.x0
            ),

          y:
            Math.round(
              item.bbox.y0
            )

        })
      )
    );

    //for debugging purposes, if nothing match it won't continue
     
    if (!matchedLabels.length) {

      console.warn(
        "No Zoom participant names matched the masterlist."
      );

      studentCount.length = 0;

      renderCombineResult(
        studentCount
      );

      return;
    }

    // finalize zoom participant regions dynamically
   
    const participantRegions =
      buildParticipantRegions(
        matchedLabels,
        originalImage.naturalWidth,
        originalImage.naturalHeight
      );

    console.table(
      participantRegions.map(
        participant => ({

          name:
            participant.name,

          x:
            Math.round(
              participant.sourceX
            ),

          y:
            Math.round(
              participant.sourceY
            ),

          width:
            Math.round(
              participant.width
            ),

          height:
            Math.round(
              participant.height
            )

        })
      )
    );

    // run face-api on each participant
    
    const participants =
      await detectFacesInRegions(
        originalImage,
        participantRegions
      );

    console.table(
      participants.map(
        participant => ({

          name:
            participant.name,

          section:
            participant.sectionCode,

          score:
            participant.matchScore,

          hasFace:
            participant.hasFace,

          faceCount:
            participant.faceCount

        })
      )
    );

    //Current Attendance
  
    studentCount.length = 0;

    participants.forEach(
      participant => {

        if (!participant.hasFace) {
          return;
        }

        studentCount.push({

          name:
            participant.name,

          sectionCode:
            participant.sectionCode,

          score:
            participant.matchScore

        });

      }
    );


    renderCombineResult(
      studentCount
    );

    console.log(
      "Current attendance:",
      studentCount
    );

  }

  catch (error) {

    console.error(
      "Failed to process Zoom screenshot:",
      error
    );

  }

  finally {

    await ocrWorker.terminate();

    console.log(
      "OCR processing finished."
    );

  }

}

async function scanStudentName(text) {
  // Dynamically import studentRegister only when OCR processing runs
  const { getMasterlistData } = await import('./studentRegister.js');
  const studentMasterlist = getMasterlistData();
  
  studentCount.length = 0;

  const cleanText = text
  .toUpperCase()
  .replace(/[^A-Z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function matchCandidateLabelsToStudents(
  labels
) {

  const masterlist =
    getMasterlistData();

  const candidates = [];
  for (let i = 0; i < studentMasterlist.length; i++) {
    const student = studentMasterlist[i];

      const normalizedOcr =
        normalizeForMatch(
          label.text
        );

      if (
        normalizedOcr.length < 3
      ) {
        return;
      }

      masterlist.forEach(
        (
          student,
          studentIndex
        ) => {

          const normalizedName =
            normalizeForMatch(
              student.name
            );

          const normalizedFullLabel =
            normalizeForMatch(
              `${student.sectionCode} ${student.name}`
            );

          const nameScore =
            partial_ratio(
              normalizedOcr,
              normalizedName
            );

          const completeScore =
            partial_ratio(
              normalizedOcr,
              normalizedFullLabel
            );

          const score =
            Math.max(
              nameScore,
              completeScore
            );

          if (
            score >= 60
          ) {

            candidates.push({

              labelIndex:
                labelIndex,

              studentIndex:
                studentIndex,

              label:
                label,

              student:
                student,

              score:
                score

            });

          }

        }
      );

    }
  );
  /*
   * Strongest matches get first claim
   * on both the OCR label and student.
   */
  candidates.sort(
    (a, b) =>
      b.score -
      a.score
  );

  const claimedLabels =
    new Set();

  const claimedStudents =
    new Set();

  candidates.sort((a, b) => b.score - a.score);

  const claimedStudentIndices = new Set();
  const claimedOcrIndices = new Set();

  for (const candidate of candidates) {
    if (claimedStudentIndices.has(candidate.studentIndex) || claimedOcrIndices.has(candidate.ocrIndex)) {
      continue;

    }

    claimedStudentIndices.add(candidate.studentIndex);
    claimedOcrIndices.add(candidate.ocrIndex);

    studentCount.push({
      name: candidate.student.name,
      sectionCode: candidate.student.sectionCode,
      score: candidate.score
    });

  }

  return results;
}

// New DOM rendering function
export function renderCombineResult(matchedData) {
  const currentAttendanceTable = document.getElementById("studentData");
  if (!currentAttendanceTable) {
    console.warn("Target element #studentData was not found in the DOM.");
    return;
  }

  currentAttendanceTable.replaceChildren();

  matchedData.forEach(
    student => {

      const studentRow =
        document.createElement(
          "tr"
        );

    studentRow.append(sectionCell, nameCell, statusCell);
    currentAttendanceTable.appendChild(studentRow);
  });
}

// Import Values
export function catchStudenName() {
  return studentCount;
}

export function testingMaterials(){
  return extractedOcr;
}