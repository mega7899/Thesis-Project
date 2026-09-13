// main.js
import "../styles/style.scss";
import "../src/chart";
import "../src/processImage";
import '../src/studentRegister';

// INTERACTABILITY
// Menu button navigation
const navigationButtons = document.querySelectorAll(".menu-btn");
const applicationViews = document.querySelectorAll(".view");

navigationButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetViewId = btn.getAttribute("data-target");
    applicationViews.forEach((view) => (view.style.display = "none"));
    document.getElementById(targetViewId).style.display = "block";
  });
});

// Logout button (reload page)
const sessionLogoutBtn = document.querySelector(".logout-btn");
if (sessionLogoutBtn) {
  sessionLogoutBtn.addEventListener("click", () => {
    window.location.reload();
  });
}

// Live clock update
setInterval(() => {
  const liveClockDisplay = document.getElementById("clock");
  if (liveClockDisplay) {
    liveClockDisplay.innerText = new Date().toLocaleTimeString();
  }
}, 1000);