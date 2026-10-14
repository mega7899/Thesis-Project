import { getMasterlistData } from "../src/studentRegister";
import { catchStudenName } from "../src/processImage";
import { utils, writeFile } from "xlsx";


const combineBtn = document.getElementById("combineTable");
const combinedAttendanceTable =
  document.getElementById("combineSheetData");

const exportExcelBtn =
  document.getElementById("exportTable");


combineBtn?.addEventListener("click", () => {
  validatingData();
});


exportExcelBtn?.addEventListener("click", () => {
  const newWorkbook =
    utils.table_to_book(combinedAttendanceTable);

  writeFile(
    newWorkbook,
    "SheetJSTable.xlsx"
  );
});


function normalizeName(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[_,-]/g, " ")
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function validatingData() {

  combinedAttendanceTable.replaceChildren();


  const studentList =
    getMasterlistData() || [];

  const currentAttendance =
    catchStudenName() || [];


  /*
   * current Attendance should contain
   * students detected by OCR + face detection.
   *
   * store their normalized names for
   * quick comparison.
   */
  const presentNames =
    new Set(
      currentAttendance.map(student =>
        normalizeName(student.name)
      )
    );


  //students in masterlist gets either present or absent
  
  studentList.forEach(student => {

    const studentName =
      normalizeName(student.name);

    const isPresent =
      presentNames.has(studentName);


    const row =
      document.createElement("tr");

    const sectionCell =
      document.createElement("td");

    const nameCell =
      document.createElement("td");

    const statusCell =
      document.createElement("td");


    sectionCell.textContent =
      student.sectionCode || "N/A";

    nameCell.textContent =
      student.name;

    statusCell.textContent =
      isPresent
        ? "Present"
        : "Absent";


    row.append(
      sectionCell,
      nameCell,
      statusCell
    );


    combinedAttendanceTable.appendChild(row);
  });
}

function normalizeForMatch(value) {

  return String(value || "")
    .toUpperCase()
    .replace(/[_,-]/g, " ")
    .replace(
      /[^A-Z0-9\s]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function matchOcrLinesToStudents(
  ocrLines
) {

  const masterlist =
    getMasterlistData();


  const candidates = [];


  ocrLines.forEach(
    (line, lineIndex) => {

      const normalizedOcr =
        normalizeForMatch(
          line.text
        );


      masterlist.forEach(
        (
          student,
          studentIndex
        ) => {

          const normalizedName =
            normalizeForMatch(
              student.name
            );


          const normalizedLabel =
            normalizeForMatch(
              `${student.sectionCode} ${student.name}`
            );


          const nameScore =
            partial_ratio(
              normalizedOcr,
              normalizedName
            );


          const labelScore =
            partial_ratio(
              normalizedOcr,
              normalizedLabel
            );


          const score =
            Math.max(
              nameScore,
              labelScore
            );


          if (score >= 70) {

            candidates.push({
              lineIndex:
                lineIndex,

              studentIndex:
                studentIndex,

              student:
                student,

              line:
                line,

              score:
                score
            });

          }

        }
      );

    }
  );


  //highest-confidence matches first.
  candidates.sort(
    (a, b) =>
      b.score -
      a.score
  );


  const claimedLines =
    new Set();

  const claimedStudents =
    new Set();

  const results = [];


  for (
    const candidate of candidates
  ) {

    if (
      claimedLines.has(
        candidate.lineIndex
      ) ||
      claimedStudents.has(
        candidate.studentIndex
      )
    ) {

      continue;

    }


    claimedLines.add(
      candidate.lineIndex
    );

    claimedStudents.add(
      candidate.studentIndex
    );


    results.push({
      name:
        candidate.student.name,

      sectionCode:
        candidate.student.sectionCode,

      matchScore:
        candidate.score,

      ocrText:
        candidate.line.text,

      bbox:
        candidate.line.bbox
    });

  }


  return results;
}