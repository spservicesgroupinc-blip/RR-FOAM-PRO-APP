/**
 * ============================================================
 *  RFE Foam Pro — User Feedback Google Apps Script
 * ============================================================
 *
 *  HOW TO SET UP (copy-paste into Google Apps Script):
 *  1. Go to https://script.google.com  →  New Project
 *  2. Paste this ENTIRE file into the Code.gs editor
 *  3. Click  Run  →  "setup"  to create the Google Sheet automatically
 *     (Authorize access when prompted)
 *  4. Click  Deploy  →  New Deployment
 *     - Type: "Web app"
 *     - Execute as: "Me"
 *     - Who has access: "Anyone"
 *  5. Click  Deploy  →  copy the Web App URL
 *  6. Paste the URL into your app's constants.ts file:
 *       export const FEEDBACK_SCRIPT_URL = '<YOUR_WEB_APP_URL>';
 *
 *  That's it — the sheet and endpoint are ready.
 * ============================================================
 */

// ─── CONFIG ────────────────────────────────────────────────
var SHEET_NAME = 'RFE Foam Pro Feedback';

// All app areas that have a feedback button
var APP_AREAS = [
  'Dashboard',
  'Calculator',
  'Customers',
  'Warehouse',
  'Material Report',
  'Equipment Tracker',
  'Equipment Maintenance',
  'Settings',
  'Profile',
  'Estimate Stage',
  'Work Order Stage',
  'Invoice Stage',
  'Estimate Detail',
  'User Manual',
  'Crew Dashboard'
];

// ─── AUTO SETUP (run once) ─────────────────────────────────
/**
 * Run this function ONCE from the Apps Script editor to create
 * the feedback spreadsheet with the correct headers.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // If run from the script editor without a bound sheet, create one
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    Logger.log('Created new spreadsheet: ' + ss.getUrl());
  }

  var sheet = ss.getSheetByName('Feedback');
  if (!sheet) {
    sheet = ss.insertSheet('Feedback');
  }

  // Write headers
  var headers = [
    'Timestamp',
    'App Area',
    'Feedback',
    'User Email',
    'Company Name',
    'User Role',
    'Browser / Device'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // Format the header row
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1e293b');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontSize(11);

  // Auto-resize columns
  for (var i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
  // Make the feedback column wider
  sheet.setColumnWidth(3, 500);

  // Create a summary sheet with per-area feedback counts
  var summarySheet = ss.getSheetByName('Summary');
  if (!summarySheet) {
    summarySheet = ss.insertSheet('Summary');
  }

  var summaryHeaders = ['App Area', 'Total Feedback', 'Latest Feedback Date'];
  summarySheet.getRange(1, 1, 1, summaryHeaders.length).setValues([summaryHeaders]);

  var summaryHeaderRange = summarySheet.getRange(1, 1, 1, summaryHeaders.length);
  summaryHeaderRange.setFontWeight('bold');
  summaryHeaderRange.setBackground('#1e293b');
  summaryHeaderRange.setFontColor('#ffffff');
  summaryHeaderRange.setFontSize(11);

  // Pre-populate area names with COUNTIF formulas
  for (var j = 0; j < APP_AREAS.length; j++) {
    var row = j + 2;
    summarySheet.getRange(row, 1).setValue(APP_AREAS[j]);
    // Count feedback entries for this area
    summarySheet.getRange(row, 2).setFormula(
      '=COUNTIF(Feedback!B:B,"' + APP_AREAS[j] + '")'
    );
    // Latest date for this area
    summarySheet.getRange(row, 3).setFormula(
      '=IFERROR(MAXIFS(Feedback!A:A,Feedback!B:B,"' + APP_AREAS[j] + '"),"")'
    );
    summarySheet.getRange(row, 3).setNumberFormat('yyyy-mm-dd hh:mm');
  }

  summarySheet.autoResizeColumn(1);
  summarySheet.setColumnWidth(2, 140);
  summarySheet.setColumnWidth(3, 200);

  // Freeze header rows on both sheets
  sheet.setFrozenRows(1);
  summarySheet.setFrozenRows(1);

  // Remove default "Sheet1" if it exists and is empty
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) { /* ignore */ }
  }

  Logger.log('✅ Setup complete!');
  Logger.log('Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Now deploy as a Web App and paste the URL into your app.');
}


// ─── WEB APP ENDPOINT ──────────────────────────────────────

/**
 * Handles GET requests (health-check / CORS preflight)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'RFE Foam Pro Feedback endpoint is live.'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles POST requests — receives feedback from the app
 *
 * Expected JSON body:
 * {
 *   "area":        "Dashboard",
 *   "feedback":    "I love this feature!",
 *   "email":       "user@example.com",
 *   "companyName": "Acme Insulation",
 *   "role":        "admin",
 *   "device":      "Chrome / Windows"
 * }
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var area      = data.area        || 'Unknown';
    var feedback  = data.feedback    || '';
    var email     = data.email       || 'N/A';
    var company   = data.companyName || 'N/A';
    var role      = data.role        || 'N/A';
    var device    = data.device      || 'N/A';

    if (!feedback.trim()) {
      return ContentService
        .createTextOutput(JSON.stringify({ status: 'error', message: 'Feedback text is required.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Feedback');
    if (!sheet) {
      // Auto-create if someone skipped setup
      setup();
      sheet = ss.getSheetByName('Feedback');
    }

    // Append the feedback row
    sheet.appendRow([
      new Date(),        // Timestamp
      area,              // App Area
      feedback,          // Feedback text
      email,             // User Email
      company,           // Company Name
      role,              // User Role
      device             // Browser / Device
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', message: 'Feedback received. Thank you!' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
