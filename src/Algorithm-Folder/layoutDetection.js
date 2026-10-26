function median(values) {
  if (!values.length) {
    return 0;
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (
      sortedValues[middleIndex - 1] +
      sortedValues[middleIndex]
    ) / 2;
  }

  return sortedValues[middleIndex];
}


function getCenterY(label) {
  return (
    label.bbox.y0 +
    label.bbox.y1
  ) / 2;
}


function clusterIntoRows(labels) {
  if (!labels.length) {
    return [];
  }

  const labelHeights =
    labels.map(label =>
      label.bbox.y1 -
      label.bbox.y0
    );

  const rowTolerance =
    Math.max(
      12,
      median(labelHeights) * 2
    );


  const labelsTopToBottom =
    [...labels].sort(
      (a, b) =>
        getCenterY(a) -
        getCenterY(b)
    );


  const rows = [];


  labelsTopToBottom.forEach(label => {

    const labelCenterY =
      getCenterY(label);


    let targetRow = null;


    for (const row of rows) {

      if (
        Math.abs(
          labelCenterY - row.centerY
        ) <= rowTolerance
      ) {

        targetRow = row;
        break;
      }

    }


    if (!targetRow) {

      rows.push({
        centerY: labelCenterY,
        labels: [label]
      });

      return;
    }


    targetRow.labels.push(label);


    targetRow.centerY =
      targetRow.labels.reduce(
        (sum, rowLabel) =>
          sum + getCenterY(rowLabel),
        0
      ) /
      targetRow.labels.length;

  });


  return rows.sort(
    (a, b) =>
      a.centerY -
      b.centerY
  );
}


export function buildParticipantRegions(
  labels,
  imageWidth,
  imageHeight
) {

  if (!labels.length) {
    return [];
  }


  const rows =
    clusterIntoRows(labels);


  
   //estimate participant height from vertical distance between Zoom labels.
  const rowGaps = [];

  for (
    let rowIndex = 1;
    rowIndex < rows.length;
    rowIndex++
  ) {

    rowGaps.push(
      rows[rowIndex].centerY -
      rows[rowIndex - 1].centerY
    );

  }


  const estimatedTileHeight =
    rowGaps.length
      ? median(rowGaps)
      : imageHeight;


  
    //the row containing the most recognized students gives the best estimate of the Zoom column layout.
  const referenceRow =
    [...rows].sort(
      (a, b) =>
        b.labels.length -
        a.labels.length
    )[0];


  const referenceLabels =
    [...referenceRow.labels].sort(
      (a, b) =>
        a.bbox.x0 -
        b.bbox.x0
    );


  const horizontalGaps = [];

  for (
    let labelIndex = 1;
    labelIndex < referenceLabels.length;
    labelIndex++
  ) {

    horizontalGaps.push(
      referenceLabels[labelIndex].bbox.x0 -
      referenceLabels[labelIndex - 1].bbox.x0
    );

  }


  const estimatedTileWidth =
    horizontalGaps.length
      ? median(horizontalGaps)
      : imageWidth;


  const columnAnchors =
    referenceLabels.map(
      label => label.bbox.x0
    );


  return labels.map(label => {

    // find which inferred column is closest to this name label.
    let closestColumnX =
      label.bbox.x0;


    if (columnAnchors.length) {

      closestColumnX =
        columnAnchors.reduce(
          (closest, anchor) => {

            const anchorDifference =
              Math.abs(
                anchor -
                label.bbox.x0
              );

            const closestDifference =
              Math.abs(
                closest -
                label.bbox.x0
              );


            return anchorDifference <
              closestDifference
              ? anchor
              : closest;

          },
          columnAnchors[0]
        );

    }


    const labelTextHeight =
      label.bbox.y1 -
      label.bbox.y0;

    const tileBottom =
      Math.min(
        imageHeight,
        label.bbox.y1 +
          Math.max(
            6,
            labelTextHeight * 0.8
          )
      );


    const sourceX =
      Math.max(
        0,
        closestColumnX -
          estimatedTileWidth * 0.02
      );


    const sourceY =
      Math.max(
        0,
        tileBottom -
          estimatedTileHeight
      );


    return {
      name:
        label.name,

      sectionCode:
        label.sectionCode,

      matchScore:
        label.matchScore,

      ocrText:
        label.ocrText,

      sourceX:
        sourceX,

      sourceY:
        sourceY,

      width:
        Math.min(
          estimatedTileWidth,
          imageWidth -
            sourceX
        ),

      height:
        Math.min(
          estimatedTileHeight,
          imageHeight -
            sourceY
        )
    };

  });
}
