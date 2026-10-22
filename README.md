# Thesis-Project

# Steps On How To Use The Program:
- Upload Class Masterlist: Import your official student list (.xlsx / .csv) into the system.
- Upload Zoom Screenshot: Select and upload a clear screenshot of your Zoom meeting participants.
- Navigate to Attendance Logs: Open the logs section to initiate background processing.
- Data Extraction & Rendering: Allow the system time to complete face detection (face-api.js) and OCR text parsing (Tesseract.js). The raw data table will render upon completion.
- Compile Attendance: Click "Make Attendance" to aggregate the matched records and generate today's attendance summary.
- Publish or Export:
    - Click "Publish Attendance" to send the verified attendance records directly to the Student Dashboard.
    - Click "Export Table" to download the finalized attendance summary as a spreadsheet.

# System Limitation & Known Issue:
- Static Avatar Recognition: The facial recognition module currently cannot distinguish between a live webcam feed and a static profile picture avatar.
- Severe Name Format Discrepancies: Automatic matching will fail if the display name format on the Zoom screenshot significantly diverges from the schema used in the masterlist (e.g., missing identifiers or mismatched order).
- Data Persistence: The system currently operates without persistent database storage; state persistence across server restarts is in active development.


