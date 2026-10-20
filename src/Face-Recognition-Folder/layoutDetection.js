function median(values) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (
      sorted[middle - 1] +
      sorted[middle]
    ) / 2;
  }

  return sorted[middle];
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

  const lineHeights =
    labels.map(label =>
      label.bbox.y1 -
      label.bbox.y0
    );

  const rowTolerance =
    Math.max(
      12,
      median(lineHeights) * 2
    );


  const sorted =
    [...labels].sort(
      (a, b) =>
        getCenterY(a) -
        getCenterY(b)
    );


  const rows = [];


  sorted.forEach(label => {

    const centerY =
      getCenterY(label);


    let targetRow = null;


    for (const row of rows) {

      if (
        Math.abs(
          centerY - row.centerY
        ) <= rowTolerance
      ) {

        targetRow = row;
        break;
      }

    }


    if (!targetRow) {

      rows.push({
        centerY: centerY,
        labels: [label]
      });

      return;
    }


    targetRow.labels.push(label);


    targetRow.centerY =
      targetRow.labels.reduce(
        (sum, item) =>
          sum + getCenterY(item),
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
    let i = 1;
    i < rows.length;
    i++
  ) {

    rowGaps.push(
      rows[i].centerY -
      rows[i - 1].centerY
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
    let i = 1;
    i < referenceLabels.length;
    i++
  ) {

    horizontalGaps.push(
      referenceLabels[i].bbox.x0 -
      referenceLabels[i - 1].bbox.x0
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
    
    let columnX =
      label.bbox.x0;


    if (columnAnchors.length) {

      columnX =
        columnAnchors.reduce(
          (closest, anchor) => {

            const currentDifference =
              Math.abs(
                anchor -
                label.bbox.x0
              );

            const closestDifference =
              Math.abs(
                closest -
                label.bbox.x0
              );


            return currentDifference <
              closestDifference
              ? anchor
              : closest;

          },
          columnAnchors[0]
        );

    }


    const textHeight =
      label.bbox.y1 -
      label.bbox.y0;

    const tileBottom =
      Math.min(
        imageHeight,
        label.bbox.y1 +
          Math.max(
            6,
            textHeight * 0.8
          )
      );


    const sourceX =
      Math.max(
        0,
        columnX -
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