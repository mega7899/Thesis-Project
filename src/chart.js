import Chart from "chart.js/auto";

// Chart.js line chart
const lineCtx = document.getElementById("lineChart")?.getContext("2d");
Chart.defaults.font.size = 20;
if (lineCtx) {
  new Chart(lineCtx, {
    type: "line",
    data: {
      labels: ["M", "T", "W", "T", "F"],
      datasets: [{ 
        label: "Attendance", 
        data: [12, 19, 3, 5, 2],
        backgroundColor: '#001149',
      }],
    },
  });
}

// Chart.js bar chart
const barCtx = document.getElementById("barChart")?.getContext("2d");
if (barCtx) {
  new Chart(barCtx, {
    type: "bar",
    data: {
      labels: ["A", "B", "C"],
      datasets: [{ 
        label: "Sections", 
        data: [5, 10, 7], 
        backgroundColor: '#001149',
        }],
    },
  });
}
