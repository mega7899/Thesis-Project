# Project Title
# Automatic Student Attendance Recording Imaged-base Face and Name Recognition.

# Tools & Algorithm Used:
# -Javascript
# -Node.js
# -Npm
# -Tesseract.js(OCR)
# -face-api.js(Facial-recognition)
# -SheetJs
# -ChartsJs
# -Rule-Based Algorithm
# -Score-Sorted Greedy Assignment algorithm.

# SYSTEM TEST REPORT

# Project Name: Automated Student Attendance Recording System (Image-Based Face and Name Recognition)

# 06/10/2026 Bug fixes, & Problem

# Module Under Test: OCR Text Extraction, Pattern Matching, and Data Binding

---

## 1. System Configuration & Test Environment

# Core Stack: JavaScript (ES6+), Node.js, npm
# Computer Vision & OCR Engines: `face-api.js` (Facial Recognition), `Tesseract.js` (Optical Character Recognition)
# Data Processing & Visualization: `SheetJS` (Excel/Spreadsheet Export), `Chart.js` (Graphical Analytics)
# Matching Logic: Rule-Based Algorithm, Score-Sorted Greedy Assignment Algorithm
# Standard Identifier Format: `[SECTION_ID_LAST_4]_[LAST_NAME] [FIRST_NAME] [MIDDLE_INITIAL]`
# Sample Identifier: `A122_Septimo Aldrine D`

# 2. Test Execution & Defect Resolution Summary

| Defect ID | Description / Observed Behavior | Root Cause | Status | Resolution / Fix Applied |
| --- | --- | --- | --- | --- |
| **DEF-01** | OCR matching pipeline failed to extract all student names from raw Zoom screenshot scans. | Standard regex patterns failed to parse unclean/noisy text artifacts from screen captures. | **Resolved** | Replaced rigid string matching with a resilient pattern designed to capture names embedded within uncleaned OCR outputs. |
| **DEF-02** | Masterlist comparison failures when processing structural variations in student names. | Regular expressions could not accommodate diverse record formats in input masterlists. | **Resolved** | Integrated a **Score-Sorted Greedy Assignment algorithm** to guarantee deterministic matching between masterlist data and extracted OCR strings. |
| **DEF-03** | Data pre-processing pipeline dropped valid student tokens during scanning. | Absence of standardized input sanitization before text comparison. | **Resolved** | Implemented a dedicated input normalization step to standardize scanned tokens prior to masterlist evaluation. |

# 3. Pending Test Cases & Known Limitations

1. **Multi-Image Batch Execution (Unverified)**:
  **Test Case ID:** `BATCH-01`
  **Status:** Pending
  **Note:** Dual-screenshot processing (evaluating two Zoom screenshots simultaneously) has not yet undergone validation testing.


2. **Analytics Visualization Rendering (Incomplete):**
 **Test Case ID:** `BATCH-02`
 **Status:** Blocked / In Progress
 **Note:** Chart.js integration for visual analytics reporting is built but not yet bound to execution outputs.


3. **Runtime Persistence & Deployment (Pending):**
 **Test Case ID:** `BATCH-03`
 **Status:** Outstanding
 **Note:** Server environment configuration for continuous execution and session state persistence remains unassigned.
