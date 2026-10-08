// main.js
import "../styles/style.scss";
import "../src/chart";
import "../src/processImage";
import '../src/studentRegister';
import "../src/validation";

// INTERACTABILITY
// Menu button navigation
const navigationButtons = document.querySelectorAll(".menu-btn");
const applicationViews = document.querySelectorAll(".view");
const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
const categoryMenu = document.querySelector(".category-menu");

const setMobileMenuOpen = (isOpen) => {
  if (!mobileMenuToggle || !categoryMenu) return;
  categoryMenu.classList.toggle("is-open", isOpen);
  mobileMenuToggle.setAttribute("aria-expanded", String(isOpen));
};

navigationButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetViewId = btn.getAttribute("data-target");
    applicationViews.forEach((view) => (view.style.display = "none"));
    document.getElementById(targetViewId).style.display = "block";
    setMobileMenuOpen(false);
  });
});

mobileMenuToggle?.addEventListener("click", () => {
  setMobileMenuOpen(!categoryMenu?.classList.contains("is-open"));
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
