import Chart from "chart.js/auto";

// Chart.js line chart
const lineChartContext = document.getElementById("lineChart")?.getContext("2d");
Chart.defaults.font.size = 20;
if (lineChartContext) {
  new Chart(lineChartContext, {
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
const barChartContext = document.getElementById("barChart")?.getContext("2d");
if (barChartContext) {
  new Chart(barChartContext, {
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
