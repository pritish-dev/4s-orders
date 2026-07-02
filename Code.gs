// ============================================================
//  4S Interiors — Google Apps Script backend  (Code.gs)
// ============================================================
//
//  SETUP STEPS (first time):
//   1. Paste this file into script.google.com → your 4S Orders project
//   2. Enable "Drive API v2":
//        Apps Script editor → left sidebar "Services" (+) → Drive API → Add
//   3. Run → ensureSheets          (creates Orders_Master, Staff, etc.)
//   4. Upload both XLSX price list files to your Google Drive (any folder):
//        • "CPL - HF HS - April 2026.xlsx"
//        • "Mattress CPL Price List WEF 14 04 2026.xlsx"
//   5. Run → importPriceListsFromDrive  (imports XLSX data into OPS sheet)
//   6. Deploy → New deployment → Web App
//        Execute as : Me  |  Who has access : Anyone
//   7. Copy the deployment URL → paste in the app Settings screen
//
//  UPDATING (new data / new version):
//   1. Edit this file in Apps Script editor
//   2. For price list refresh: re-upload XLSX → run importPriceListsFromDrive
//   3. Deploy → Manage deployments → edit existing → New version → Deploy
//        (URL stays the same — no change needed in the app)
//
// ============================================================

// ── IDs ──────────────────────────────────────────────────────────────────────
// OPS Spreadsheet: holds price list tabs + "Stock" tab
var OPS_SHEET_ID = '12RtOVqlOicoGlF2oLRBv3wB9eeludiz08AFKbhPcNqs';

// OPS sheet tabs to skip when scanning for price list data
var PRICE_SKIP = ['Stock', 'Staff', 'Orders_Master', 'Change_Log', 'Sheet1', 'Sheet2', 'Sheet3'];

// ── Column indexes (0-based) ──────────────────────────────────────────────────
// Stock tab: A=Code  B=Name  C=Category  D=CPL  E=MRP  F=KB_Qty  G=B2CB_Qty  H=PTA_Qty  I=CTC_Qty
var COL_ST = { CODE:0, NAME:1, CAT:2, CPL:3, MRP:4, KB:5, B2CB:6, PTA:7, CTC:8 };

// Orders_Master columns: A=Timestamp  B=InternalNo  C=OrderNo  D=WON  E=Status
//   F=Customer  G=Phone  H=Alt  I=Email  J=Billing  K=Delivery  L=Lift  M=CustCode
//   N=PORef  O=Source  P=Discount  Q=PlannedDly  R=InstallNote  S=PaymentMode
//   T=Earnest  U=ReceiptNo  V=FollowUp  W=SalesExec  X=OrderType  Y=Items_JSON
//   Z=Subtotal  AA=CGST  AB=SGST  AC=TotalWithTax  AD=Date
var COL_ORD = {
  TS:0, INTERNAL_NO:1, ORDER_NO:2, WON:3, STATUS:4,
  CUSTOMER:5, PHONE:6, ALT:7, EMAIL:8,
  BILLING:9, DELIVERY:10, LIFT:11, CUST_CODE:12,
  PO_REF:13, SOURCE:14, DISCOUNT:15, PLANNED_DLY:16,
  INSTALL_NOTE:17, PAYMENT_MODE:18, EARNEST:19, RECEIPT_NO:20,
  FOLLOW_UP:21, SALES_EXEC:22, ORDER_TYPE:23, ITEMS_JSON:24,
  SUBTOTAL:25, CGST:26, SGST:27, TOTAL_WITH_TAX:28, DATE:29
};

// Staff: A=username  B=password  C=name  D=code  E=role
var COL_USR = { USERNAME:0, PASSWORD:1, NAME:2, CODE:3, ROLE:4 };

// Change_Log: A=Timestamp  B=User  C=OrderNo  D=Action  E=Detail
var COL_LOG = { TS:0, USER:1, ORDER_NO:2, ACTION:3, DETAIL:4 };

// ── Master spreadsheet helper ─────────────────────────────────────────────────
// Auto-creates the master spreadsheet on first use.
function _getMasterSS() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('MASTER_SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch(e) {
      Logger.log('Could not open saved master sheet (' + e.message + ') — recreating.');
    }
  }
  ensureSheets();
  id = props.getProperty('MASTER_SHEET_ID');
  if (!id) throw new Error('Auto-setup failed. Run ensureSheets() manually from Apps Script editor.');
  return SpreadsheetApp.openById(id);
}

function _getSheet(name) { return _getMasterSS().getSheetByName(name); }

function _jsonOut(callback, obj) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(obj) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function _jsonPost(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Entry points ──────────────────────────────────────────────────────────────
function doGet(e) {
  var p        = (e && e.parameter) ? e.parameter : {};
  var callback = p.callback || 'cb';
  var result;
  try {
    var action = p.action || '';
    if      (action === 'login')          result = handleLogin(p);
    else if (action === 'stock')          result = handleStock();
    else if (action === 'priceList')      result = handlePriceList();
    else if (action === 'orders')         result = handleOrders(p);
    else if (action === 'ping')           result = handlePing();
    else if (action === 'debugPriceList') result = handleDebugPriceList();
    else result = { ok: false, error: 'Unknown action: ' + action };
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  return _jsonOut(callback, result);
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (ex) { return _jsonPost({ ok: false, error: 'Bad JSON body' }); }
  var result;
  try {
    var action = body.action || '';
    if      (action === 'saveOrder')  result = handleSaveOrder(body.order);
    else if (action === 'updateWON')  result = handleUpdateWON(body);
    else result = { ok: false, error: 'Unknown action: ' + action };
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  return _jsonPost(result);
}

// ── PING / CONNECTION TEST ────────────────────────────────────────────────────
function handlePing() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('MASTER_SHEET_ID');
  if (!id) { ensureSheets(); id = props.getProperty('MASTER_SHEET_ID'); }
  var ss = SpreadsheetApp.openById(id);

  var opsSheets = [];
  try {
    var opsSS = SpreadsheetApp.openById(OPS_SHEET_ID);
    opsSheets = opsSS.getSheets().map(function(s){ return s.getName(); });
  } catch(e) {}

  return {
    ok:           true,
    message:      'Connected ✓',
    spreadsheetUrl: ss.getUrl(),
    spreadsheetId:  id,
    sheets:         ss.getSheets().map(function(s){ return s.getName(); }),
    opsSheetId:     OPS_SHEET_ID,
    opsSheets:      opsSheets,
  };
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function handleLogin(p) {
  var username = (p.username || '').toLowerCase().trim();
  var password = (p.password || '').trim();
  if (!username || !password) return { ok: false, error: 'Username and password required.' };

  var sh = _findStaffSheet();
  if (!sh) {
    return {
      ok: false,
      error: 'Staff sheet not found.\n\n' +
             'Fix: Ensure a tab named exactly "Staff" (capital S) exists in the master ' +
             'or OPS spreadsheet with columns: username, password, name, code, role.'
    };
  }

  var rows     = sh.getDataRange().getValues();
  var dataRows = rows.slice(1).filter(function(r) {
    return String(r[COL_USR.USERNAME] || '').trim() !== '';
  });

  if (dataRows.length === 0) {
    return { ok: false, error: 'Staff sheet exists but has no data rows.' };
  }

  for (var i = 0; i < dataRows.length; i++) {
    var r = dataRows[i];
    if (String(r[COL_USR.USERNAME]).toLowerCase().trim() === username &&
        String(r[COL_USR.PASSWORD]).trim() === password) {
      return {
        ok:   true,
        user: {
          name:   String(r[COL_USR.NAME] || ''),
          code:   String(r[COL_USR.CODE] || ''),
          role:   String(r[COL_USR.ROLE] || 'sales'),
          branch: 'Patia',
        },
      };
    }
  }
  return { ok: false, error: 'Invalid username or password.' };
}

// Tries: 1) master sheet "Staff", 2) OPS sheet "Staff"
function _findStaffSheet() {
  try { var sh = _getSheet('Staff'); if (sh) return sh; } catch(e) {}
  try {
    var opsSS = SpreadsheetApp.openById(OPS_SHEET_ID);
    var sh2   = opsSS.getSheetByName('Staff');
    if (sh2) {
      // Auto-save OPS sheet as master for future calls
      PropertiesService.getScriptProperties().setProperty('MASTER_SHEET_ID', OPS_SHEET_ID);
      Logger.log('Staff found in OPS sheet — auto-set as master.');
      return sh2;
    }
  } catch(e) {}
  return null;
}

// ── STOCK ─────────────────────────────────────────────────────────────────────
// Reads from OPS sheet → "Stock" tab.
// Falls back to master sheet → "Stock_Master".
//
// Expected columns (either tab):
//   Code | Name | Category | CPL | MRP | KB_Qty | B2CB_Qty | PTA_Qty | CTC_Qty
// Column names are auto-detected from the header row; positional fallback if not found.
function handleStock() {
  var sh = null;

  // Try OPS sheet first
  try {
    var opsSS = SpreadsheetApp.openById(OPS_SHEET_ID);
    sh = opsSS.getSheetByName('Stock');
  } catch(e) {}

  // Fall back to master sheet
  if (!sh) sh = _getSheet('Stock_Master');
  if (!sh) return { ok: false, error: 'Stock sheet not found. Add a "Stock" tab to the OPS spreadsheet.' };

  var rows     = sh.getDataRange().getValues();
  var syncedAt = new Date().toISOString();

  // Column detection from header
  var colCode = COL_ST.CODE, colName = COL_ST.NAME, colCat  = COL_ST.CAT;
  var colCPL  = COL_ST.CPL,  colMRP  = COL_ST.MRP;
  var colBr   = [COL_ST.KB, COL_ST.B2CB, COL_ST.PTA, COL_ST.CTC];

  if (rows.length > 0) {
    var hdr = rows[0].map(function(c){ return String(c||'').toUpperCase().trim(); });
    for (var hj = 0; hj < hdr.length; hj++) {
      var h = hdr[hj];
      if (h === 'CODE' || h === 'ITEM CODE' || h === 'LN CODE')         colCode  = hj;
      else if (h === 'NAME' || h === 'ITEM NAME' || h === 'DESCRIPTION') colName  = hj;
      else if (h === 'CATEGORY' || h === 'CAT')                          colCat   = hj;
      else if (h === 'CPL' || h === 'BASIC PRICE' || h === 'D')          colCPL   = hj;
      else if (h === 'MRP' || h === 'PRICE' || h === 'E')                colMRP   = hj;
      else if (h === 'KB_QTY' || h === 'KB')   colBr[0] = hj;
      else if (h === 'B2CB_QTY' || h === 'B2CB') colBr[1] = hj;
      else if (h === 'PTA_QTY' || h === 'PTA')   colBr[2] = hj;
      else if (h === 'CTC_QTY' || h === 'CTC')   colBr[3] = hj;
    }
    // Optional: check col J (index 9) for last-sync timestamp
    if (rows[0][9]) {
      var d = new Date(rows[0][9]);
      if (!isNaN(d.getTime())) syncedAt = d.toISOString();
    }
  }

  var BRANCHES = ['KB', 'B2CB', 'PTA', 'CTC'];
  var items = [];

  for (var i = 1; i < rows.length; i++) {
    var r    = rows[i];
    var code = String(r[colCode] || '').toUpperCase().trim();
    var name = String(r[colName] || '').trim();
    if (!code && !name) continue;

    var cpl   = parseFloat(String(r[colCPL] || 0).replace(/[^\d.]/g, '')) || 0;
    var mrp   = parseFloat(String(r[colMRP] || 0).replace(/[^\d.]/g, '')) || cpl;
    var cat   = String(r[colCat] || '').trim();
    var stock = [];

    for (var b = 0; b < BRANCHES.length; b++) {
      var qty = parseInt(String(r[colBr[b]] || 0).replace(/[^\d]/g, ''), 10) || 0;
      stock.push({ b: BRANCHES[b], q: qty });
    }

    items.push({ code: code, name: name, cat: cat, mrp: mrp, cpl: cpl, stock: stock });
  }

  return { ok: true, items: items, syncedAt: syncedAt };
}

// ── PRICE LIST ────────────────────────────────────────────────────────────────
// Reads ALL non-system tabs from the OPS spreadsheet and returns a unified item list.
//
// Supported tab formats (auto-detected):
//   1. Normalized  — header: CATEGORY | ITEM_GROUP | ITEM_CODE | DESCRIPTION | CPL | EXTRA_INFO
//   2. Raw XLSX (furniture) — header: [blank] | HSN CODE | LN Code | LN Description | Unit Consumer Basic
//   3. Raw XLSX (mattress)  — header: [blank] | HSN | Reference | Model | LN Code | LN Description | ... | CPL
//
// This allows the OPS sheet to be populated either by running importPriceListsFromDrive()
// or by manually importing XLSX / CSV files into individual tabs.
function handlePriceList() {
  var ss  = SpreadsheetApp.openById(OPS_SHEET_ID);
  var all = [];
  var counts = {};

  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sh      = sheets[i];
    var tabName = sh.getName();
    if (PRICE_SKIP.indexOf(tabName) !== -1) continue;

    var tabItems = _parsePriceTab(sh, tabName);
    if (tabItems.length > 0) {
      all    = all.concat(tabItems);
      counts[tabName] = tabItems.length;
    }
  }

  return {
    ok:        true,
    items:     all,
    counts:    counts,
    totalTabs: Object.keys(counts).length,
  };
}

// Detect the tab format and parse accordingly
function _parsePriceTab(sh, tabName) {
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return [];

  var headerRow = -1;
  var format    = '';

  for (var i = 0; i < Math.min(10, rows.length); i++) {
    var cells  = rows[i].map(function(c) { return String(c || '').toUpperCase().trim(); });
    var joined = '|' + cells.join('|') + '|';

    // Normalized format: has ITEM_CODE + DESCRIPTION in header
    if (joined.indexOf('|ITEM_CODE|') !== -1 || joined.indexOf('|ITEM CODE|') !== -1) {
      if (joined.indexOf('DESCRIPTION') !== -1) {
        headerRow = i; format = 'normalized'; break;
      }
    }

    // Raw XLSX format: has LN CODE somewhere in the row
    if (joined.indexOf('|LN CODE|') !== -1 || joined.indexOf('LN CODE') !== -1) {
      headerRow = i;
      // Mattress format additionally has MODEL column
      format = (joined.indexOf('|MODEL|') !== -1) ? 'raw-mattress' : 'raw-furniture';
      break;
    }
  }

  if (headerRow === -1) return [];
  if (format === 'normalized')    return _parseNormalizedTab(rows, headerRow, tabName);
  if (format === 'raw-furniture') return _parseRawFurnitureTab(rows, headerRow, tabName);
  if (format === 'raw-mattress')  return _parseRawMattressTab(rows, headerRow, tabName);
  return [];
}

// ── Parser: normalized tab ────────────────────────────────────────────────────
// Header: CATEGORY | ITEM_GROUP | ITEM_CODE | DESCRIPTION | CPL | EXTRA_INFO
function _parseNormalizedTab(rows, headerRow, tabName) {
  var hdr    = rows[headerRow].map(function(c){ return String(c||'').toUpperCase().trim(); });
  var cCat   = hdr.indexOf('CATEGORY');   if (cCat   < 0) cCat   = 0;
  var cGroup = hdr.indexOf('ITEM_GROUP'); if (cGroup < 0) cGroup = 1;
  var cCode  = hdr.indexOf('ITEM_CODE');  if (cCode  < 0) cCode  = 2;
  var cDesc  = hdr.indexOf('DESCRIPTION'); if (cDesc < 0) cDesc  = 3;
  var cCPL   = hdr.indexOf('CPL');        if (cCPL   < 0) cCPL   = 4;
  var cExtra = hdr.indexOf('EXTRA_INFO'); if (cExtra < 0) cExtra = 5;

  var items = [];
  for (var r = headerRow + 1; r < rows.length; r++) {
    var row  = rows[r];
    var code = String(row[cCode]  || '').trim();
    var desc = String(row[cDesc]  || '').trim();
    if (!code && !desc) continue;

    var cat   = String(row[cCat]   || tabName).trim() || tabName;
    var group = String(row[cGroup] || '').trim();
    var cpl   = parseFloat(String(row[cCPL] || 0).replace(/[^\d.]/g, '')) || 0;
    var extra = cExtra < row.length ? String(row[cExtra] || '').trim() : '';

    items.push(_makeItem(tabName, cat, group, code, desc, cpl, extra));
  }
  return items;
}

// ── Parser: raw XLSX furniture tab ───────────────────────────────────────────
// Header row (row 5 in XLSX): [blank] | HSN CODE | LN Code | LN Description | Unit Consumer Basic [| extra...]
// Sub-category markers come in two forms:
//   • Home Storage style  : col before code = sub-cat text,  code column = empty
//   • Living Room style   : code column = sub-cat text, description column = empty, price = 0
function _parseRawFurnitureTab(rows, headerRow, tabName) {
  var hdr   = rows[headerRow].map(function(c){ return String(c||'').toUpperCase().trim(); });
  var cCode = _findCol(hdr, ['LN CODE', 'ITEM CODE']);
  var cDesc = _findCol(hdr, ['LN DESCRIPTION', 'ITEM DESCRIPTION', 'DESCRIPTION']);
  var cCPL  = _findCol(hdr, ['UNIT CONSUMER BASIC', 'CPL', 'PRICE', 'CONSUMER BASIC']);
  if (cCode < 0 || cDesc < 0) return [];

  var items        = [];
  var currentGroup = '';

  for (var r = headerRow + 1; r < rows.length; r++) {
    var row   = rows[r];
    var code  = String(row[cCode] || '').trim();
    var desc  = String(row[cDesc] || '').trim();
    var price = cCPL >= 0 ? row[cCPL] : 0;
    var priceFlt = parseFloat(String(price || 0).replace(/[^\d.]/g, '')) || 0;

    // Completely empty row — also check the column before code (sub-cat in HS style)
    if (!code && !desc) {
      if (cCode > 0) {
        var preCode = String(row[cCode - 1] || '').trim();
        if (preCode && isNaN(parseFloat(preCode))) currentGroup = preCode;
      }
      continue;
    }

    // Sub-category marker (Living Room style): code has text, desc empty, price 0
    if (code && !desc && priceFlt === 0) {
      currentGroup = code;
      continue;
    }

    // Data row
    if (code && desc) {
      // Collect any extra columns (upholstery, material, etc.)
      var extraParts = [];
      for (var ec = cCPL + 1; ec < Math.min(cCPL + 3, row.length); ec++) {
        var ev = String(row[ec] || '').trim();
        if (ev) extraParts.push(ev);
      }
      items.push(_makeItem(tabName, tabName, currentGroup, code, desc, priceFlt, extraParts.join(' | ')));
    }
  }
  return items;
}

// ── Parser: raw XLSX mattress tab ────────────────────────────────────────────
// Header: [blank] | HSN | Reference | Model | LN Code | LN Description | Thickness(in) | Thickness(cm) | CPL | ...
function _parseRawMattressTab(rows, headerRow, tabName) {
  var hdr    = rows[headerRow].map(function(c){ return String(c||'').toUpperCase().trim(); });
  var cCode  = _findCol(hdr, ['LN CODE']);
  var cDesc  = _findCol(hdr, ['LN DESCRIPTION', 'DESCRIPTION']);
  var cModel = _findCol(hdr, ['MODEL']);
  var cRef   = _findCol(hdr, ['REFERENCE']);
  var cTin   = _findCol(hdr, ['REFERENCE (THICKNESS IN INCH)', 'THICKNESS IN INCH', 'THICKNESS(IN)']);
  var cTcm   = _findCol(hdr, ['THICKNESS IN CM', 'THICKNESS(CM)']);
  var cCPL   = _findCol(hdr, ['UNIT CONSUMER BASIC', 'CPL', 'PRICE']);
  if (cCode < 0 || cDesc < 0) return [];

  var items        = [];
  var currentModel = '';

  for (var r = headerRow + 1; r < rows.length; r++) {
    var row   = rows[r];
    var model = cModel >= 0 ? String(row[cModel] || '').trim() : '';
    var code  = String(row[cCode] || '').trim();
    var desc  = String(row[cDesc] || '').trim();
    if (!code && !desc && !model) continue;
    if (model) currentModel = model;
    if (!code || !desc) continue;

    var cpl   = cCPL  >= 0 ? (parseFloat(String(row[cCPL]  || 0).replace(/[^\d.]/g, '')) || 0) : 0;
    var ref   = cRef  >= 0 ? String(row[cRef]  || '').trim() : '';
    var tin   = cTin  >= 0 ? String(row[cTin]  || '').trim() : '';
    var tcm   = cTcm  >= 0 ? String(row[cTcm]  || '').trim() : '';
    var extra = tin   ? (tin + '"' + (tcm ? ' / ' + tcm + 'cm' : '')) : ref;

    items.push(_makeItem('Mattress', 'Mattress', currentModel, code, desc, cpl, extra));
  }
  return items;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _findCol(headers, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var idx = headers.indexOf(candidates[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

function _makeItem(tabName, cat, group, code, desc, cpl, extra) {
  var name       = desc || group || cat;
  // searchName includes all fields so fuzzy search works across category, group, description, code, size
  var searchName = [tabName, cat, group, desc, code, extra].filter(Boolean).join(' ');
  return {
    code:       code.toUpperCase(),
    name:       name,
    searchName: searchName,
    cat:        cat,
    item:       group || '',
    mrp:        cpl,
    cpl:        cpl,
    extra:      extra || '',
    stock:      [],
    sheet:      tabName,
  };
}

// ── IMPORT PRICE LISTS FROM DRIVE ────────────────────────────────────────────
// Run this from the Apps Script editor after uploading the XLSX files to Drive.
//
// PREREQUISITES:
//   1. Upload these two files to your Google Drive (any folder):
//        • "CPL - HF HS - April 2026.xlsx"
//        • "Mattress CPL Price List WEF 14 04 2026.xlsx"
//   2. Enable Advanced Drive Service in this project:
//        Left sidebar → Services (+) → Drive API → Version 2 → Add
//   3. Click Run → importPriceListsFromDrive
//
// WHAT IT DOES:
//   • Converts each XLSX to a temporary Google Sheet via Drive API
//   • Reads and normalizes all price tabs (18 furniture + 1 mattress)
//   • Writes normalized data to the OPS spreadsheet (OPS_SHEET_ID)
//   • Cleans up temporary files
//   • Expected format output in OPS sheet tabs:
//       CATEGORY | ITEM_GROUP | ITEM_CODE | DESCRIPTION | CPL | EXTRA_INFO
function importPriceListsFromDrive() {
  var opsSS = SpreadsheetApp.openById(OPS_SHEET_ID);
  Logger.log('Importing price lists to OPS sheet: ' + opsSS.getName());
  Logger.log('OPS sheet URL: ' + opsSS.getUrl());
  Logger.log('');

  var results = [];
  results.push(_importXLSXToOPS(opsSS, 'CPL - HF HS - April 2026.xlsx',              'furniture'));
  results.push(_importXLSXToOPS(opsSS, 'Mattress CPL Price List WEF 14 04 2026.xlsx', 'mattress'));

  Logger.log('');
  Logger.log('=== Import Summary ===');
  for (var i = 0; i < results.length; i++) Logger.log(results[i]);
  Logger.log('');
  Logger.log('OPS sheet URL: ' + opsSS.getUrl());
  Logger.log('Next step: Deploy → Manage deployments → New version → Deploy');
}

function _importXLSXToOPS(opsSS, fileName, fileType) {
  // Locate file in Drive
  var files = DriveApp.getFilesByName(fileName);
  if (!files.hasNext()) {
    var notFound = '✗ File not found in Drive: "' + fileName + '". Upload it first.';
    Logger.log(notFound);
    return notFound;
  }

  var file = files.next();
  Logger.log('Converting: ' + fileName + ' (' + fileType + ')');

  // Convert XLSX → temporary Google Sheet (requires Drive API v2)
  var tempFile;
  try {
    tempFile = Drive.Files.insert(
      { title: '_4s_import_tmp_' + fileType, mimeType: MimeType.GOOGLE_SHEETS },
      file.getBlob(),
      { convert: true }
    );
  } catch(e) {
    var apiErr = '✗ Drive API error: ' + e.message +
                 '\n  → Make sure "Drive API v2" is added under Services in Apps Script.';
    Logger.log(apiErr);
    return apiErr;
  }

  var tempSS     = SpreadsheetApp.openById(tempFile.id);
  var sheets     = tempSS.getSheets();
  var tabsDone   = 0;
  var itemsDone  = 0;

  for (var i = 0; i < sheets.length; i++) {
    var sh      = sheets[i];
    var tabName = sh.getName();
    var rows    = sh.getDataRange().getValues();
    var items;

    if (fileType === 'furniture') {
      items = _extractItemsFromRawSheet(rows, tabName, 'raw-furniture');
    } else {
      items   = _extractItemsFromRawSheet(rows, tabName, 'raw-mattress');
      tabName = 'Mattress';
    }

    if (items.length > 0) {
      _writeNormalizedTab(opsSS, tabName, items);
      Logger.log('  ✓ ' + tabName + ': ' + items.length + ' items');
      tabsDone++;
      itemsDone += items.length;
    }
  }

  // Delete temporary file
  try { DriveApp.getFileById(tempFile.id).setTrashed(true); } catch(e) {}

  var summary = '✓ ' + fileName + ' → ' + tabsDone + ' tabs, ' + itemsDone + ' total items';
  Logger.log(summary);
  return summary;
}

// Find header row and parse the temp sheet using the appropriate raw format parser
function _extractItemsFromRawSheet(rows, tabName, format) {
  var headerRow = -1;
  for (var i = 0; i < Math.min(10, rows.length); i++) {
    var cells  = rows[i].map(function(c){ return String(c||'').toUpperCase().trim(); });
    if (cells.indexOf('LN CODE') !== -1) { headerRow = i; break; }
  }
  if (headerRow === -1) return [];
  if (format === 'raw-furniture') return _parseRawFurnitureTab(rows, headerRow, tabName);
  if (format === 'raw-mattress')  return _parseRawMattressTab(rows, headerRow, tabName);
  return [];
}

// Write normalized data to an OPS sheet tab
// Output columns: CATEGORY | ITEM_GROUP | ITEM_CODE | DESCRIPTION | CPL | EXTRA_INFO
function _writeNormalizedTab(ss, tabName, items) {
  var sh = ss.getSheetByName(tabName);
  if (!sh) {
    sh = ss.insertSheet(tabName);
  } else {
    sh.clearContents();
  }

  var batchRows = [['CATEGORY', 'ITEM_GROUP', 'ITEM_CODE', 'DESCRIPTION', 'CPL', 'EXTRA_INFO']];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    batchRows.push([
      it.cat   || '',
      it.item  || '',
      it.code  || '',
      it.name  || '',
      it.cpl   || 0,
      it.extra || '',
    ]);
  }

  sh.getRange(1, 1, batchRows.length, 6).setValues(batchRows);
  sh.getRange(1, 1, 1, 6).setFontWeight('bold');
}

// ── ORDERS LIST ───────────────────────────────────────────────────────────────
// Returns orders (newest first, last 60 days).
// If exec is provided, filters to that salesperson's orders.
function handleOrders(p) {
  var sh = _getSheet('Orders_Master');
  if (!sh) return { ok: false, error: 'Orders_Master sheet not found.' };

  var rows   = sh.getDataRange().getValues();
  var exec   = (p.exec || '').trim().toLowerCase();
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  var orders = [];
  for (var i = rows.length - 1; i >= 1; i--) {
    var r  = rows[i];
    var ts = r[COL_ORD.TS];
    if (!ts) continue;
    var rowDate = (ts instanceof Date) ? ts : new Date(ts);
    if (rowDate < cutoff) break;

    var salesExec = String(r[COL_ORD.SALES_EXEC] || '');
    if (exec && salesExec.toLowerCase().indexOf(exec) === -1) continue;

    orders.push({
      no:         String(r[COL_ORD.ORDER_NO]      || ''),
      internalNo: Number(r[COL_ORD.INTERNAL_NO]   || 0),
      won:        String(r[COL_ORD.WON]            || ''),
      customer:   String(r[COL_ORD.CUSTOMER]       || ''),
      phone:      String(r[COL_ORD.PHONE]          || ''),
      date:       String(r[COL_ORD.DATE]           || ''),
      amt:        Number(r[COL_ORD.TOTAL_WITH_TAX] || 0),
      status:     String(r[COL_ORD.STATUS]         || 'draft'),
      salesExec:  salesExec,
    });
  }
  return { ok: true, orders: orders };
}

// ── SAVE ORDER ────────────────────────────────────────────────────────────────
function handleSaveOrder(o) {
  if (!o) throw new Error('No order data provided.');
  var sh = _getSheet('Orders_Master');
  if (!sh) throw new Error('Orders_Master sheet not found.');

  var lastRow    = sh.getLastRow();
  var internalNo = lastRow;

  var receiptNo = String(o.receiptNo || '').trim();
  var orderNo   = receiptNo ? (internalNo + '/' + receiptNo) : String(internalNo);

  var now      = new Date();
  var dateStr  = now.toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'2-digit' }).replace(/\//g, '.');
  var subtotal = Number(o.items ? o.items.reduce(function(s,i){ return s + (i.total||0); }, 0) : 0);
  var cgst     = Math.round(subtotal * 0.09);
  var sgst     = Math.round(subtotal * 0.09);
  var total    = subtotal + cgst + sgst;

  sh.appendRow([
    now,
    internalNo,
    orderNo,
    String(o.won         || ''),
    'pending-won',
    String(o.customer    || ''),
    String(o.phone       || ''),
    String(o.alt         || ''),
    String(o.email       || ''),
    String(o.billing     || ''),
    String(o.delivery    || ''),
    String(o.liftAvailable || ''),
    String(o.customerCode  || ''),
    String(o.poRef         || ''),
    String(o.source        || ''),
    String(o.discountCode  || ''),
    String(o.plannedDly    || ''),
    String(o.installNote   || ''),
    String(o.paymentMode   || ''),
    Number(o.earnest       || 0),
    receiptNo,
    String(o.followUp    || ''),
    String(o.salesExec   || ''),
    String(o.orderType   || 'B2C'),
    JSON.stringify(o.items || []),
    subtotal,
    cgst,
    sgst,
    total,
    dateStr,
  ]);

  _appendLog(String(o.salesExec || ''), orderNo, 'CREATE',
    'Customer: ' + (o.customer || '') + ' | Items: ' + (o.items ? o.items.length : 0));

  return { ok: true, orderNo: orderNo, internalNo: internalNo };
}

// ── UPDATE WON ────────────────────────────────────────────────────────────────
function handleUpdateWON(body) {
  var orderNo    = String(body.orderNo    || '');
  var internalNo = Number(body.internalNo || 0);
  var won        = String(body.won        || '').trim().toUpperCase();
  var updatedBy  = String(body.updatedBy  || '');
  if (!won) return { ok: false, error: 'WON number is required.' };

  var sh = _getSheet('Orders_Master');
  if (!sh) return { ok: false, error: 'Orders_Master sheet not found.' };

  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (Number(rows[i][COL_ORD.INTERNAL_NO]) === internalNo ||
        String(rows[i][COL_ORD.ORDER_NO])    === orderNo) {
      var sheetRow = i + 1;
      sh.getRange(sheetRow, COL_ORD.WON    + 1).setValue(won);
      sh.getRange(sheetRow, COL_ORD.STATUS + 1).setValue('billed');
      _appendLog(updatedBy, orderNo, 'UPDATE_WON', 'WON: ' + won);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Order not found: ' + orderNo };
}

// ── CHANGE LOG ────────────────────────────────────────────────────────────────
function _appendLog(user, orderNo, action, detail) {
  try {
    var sh = _getSheet('Change_Log');
    if (sh) sh.appendRow([new Date(), user, orderNo, action, detail]);
  } catch(e) {
    Logger.log('Change_Log write failed: ' + e.message);
  }
}

// ── DEBUG PRICE LIST ──────────────────────────────────────────────────────────
// Returns diagnostic info about the OPS sheet and its price list tabs.
function handleDebugPriceList() {
  try {
    var ss         = SpreadsheetApp.openById(OPS_SHEET_ID);
    var allSheets  = ss.getSheets().map(function(s){ return s.getName(); });
    var priceTabs  = allSheets.filter(function(n){ return PRICE_SKIP.indexOf(n) === -1; });

    var tabInfo = {};
    for (var i = 0; i < priceTabs.length; i++) {
      var sh   = ss.getSheetByName(priceTabs[i]);
      var rows = sh.getDataRange().getValues();
      tabInfo[priceTabs[i]] = {
        totalRows: rows.length,
        header:    rows[0] ? rows[0].slice(0, 8).map(function(c){ return String(c||''); }) : [],
        sample:    rows.slice(1, 4).map(function(r){ return r.slice(0,6).map(function(c){ return String(c||''); }); }),
      };
    }

    return {
      ok:             true,
      opsSpreadsheet: ss.getName(),
      opsUrl:         ss.getUrl(),
      allTabs:        allSheets,
      priceTabs:      priceTabs,
      tabInfo:        tabInfo,
    };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// ── ensureSheets ──────────────────────────────────────────────────────────────
// Run ONCE from the Apps Script editor.
// Creates the master spreadsheet (Orders, Staff, Change_Log) if it doesn't exist.
// The OPS sheet (price lists + Stock) is managed separately.
function ensureSheets() {
  var props      = PropertiesService.getScriptProperties();
  var existingId = props.getProperty('MASTER_SHEET_ID');
  var ss;

  if (existingId) {
    try { ss = SpreadsheetApp.openById(existingId); Logger.log('Using existing master: ' + ss.getUrl()); }
    catch(e) { ss = null; }
  }

  if (!ss) {
    ss = SpreadsheetApp.create('4S Interiors — Orders Master');
    props.setProperty('MASTER_SHEET_ID', ss.getId());
    Logger.log('Created new master: ' + ss.getUrl());
  }

  // Staff tab
  if (!ss.getSheetByName('Staff')) {
    var staff = ss.insertSheet('Staff');
    staff.appendRow(['username', 'password', 'name', 'code', 'role']);
    staff.appendRow(['soubhagya.patia', 'staff123',   'Soubhagya', 'SO-04', 'sales']);
    staff.appendRow(['archita.patia',   'staff123',   'Archita',   'AR-02', 'sales']);
    staff.appendRow(['nazrin.patia',    'staff123',   'Nazrin',    'NZ-05', 'sales']);
    staff.appendRow(['krupa.patia',     'staff123',   'Krupa',     'KR-06', 'sales']);
    staff.appendRow(['swasti.patia',    'staff123',   'Swasti',    'SW-03', 'sales']);
    staff.appendRow(['saroj.patia',     'staff123',   'Saroj',     'SR-07', 'sales']);
    staff.appendRow(['manager',         'manager123', 'Shaktiman', 'MG-01', 'manager']);
    staff.appendRow(['pritish',         'pritish123', 'Pritish',   'PK-07', 'admin']);
    _boldHeader(staff);
    Logger.log('✓ Staff tab created');
  }

  // Stock_Master tab (fallback if OPS "Stock" tab isn't ready)
  if (!ss.getSheetByName('Stock_Master')) {
    var stock = ss.insertSheet('Stock_Master');
    stock.appendRow(['Code', 'Name', 'Category', 'CPL', 'MRP', 'KB_Qty', 'B2CB_Qty', 'PTA_Qty', 'CTC_Qty', 'Updated_At']);
    _boldHeader(stock);
    Logger.log('✓ Stock_Master tab created — paste Godrej stock data here');
    Logger.log('  Or add a "Stock" tab to the OPS sheet (' + OPS_SHEET_ID + ')');
  }

  // Orders_Master tab
  if (!ss.getSheetByName('Orders_Master')) {
    var orders = ss.insertSheet('Orders_Master');
    orders.appendRow([
      'Timestamp', 'InternalNo', 'OrderNo', 'WON', 'Status',
      'Customer', 'Phone', 'Alt', 'Email',
      'Billing', 'Delivery', 'LiftAvailable', 'CustomerCode',
      'PORef', 'Source', 'DiscountCode', 'PlannedDly',
      'InstallNote', 'PaymentMode', 'Earnest', 'ReceiptNo',
      'FollowUp', 'SalesExec', 'OrderType', 'Items_JSON',
      'Subtotal', 'CGST', 'SGST', 'TotalWithTax', 'Date'
    ]);
    _boldHeader(orders);
    Logger.log('✓ Orders_Master tab created');
  }

  // Change_Log tab
  if (!ss.getSheetByName('Change_Log')) {
    var log = ss.insertSheet('Change_Log');
    log.appendRow(['Timestamp', 'User', 'OrderNo', 'Action', 'Detail']);
    _boldHeader(log);
    Logger.log('✓ Change_Log tab created');
  }

  // Remove default Sheet1
  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1) ss.deleteSheet(sheet1);

  Logger.log('');
  Logger.log('================================================');
  Logger.log('Master sheet setup complete!');
  Logger.log('URL : ' + ss.getUrl());
  Logger.log('ID  : ' + ss.getId());
  Logger.log('');
  Logger.log('OPS sheet (price lists + stock):');
  Logger.log('ID  : ' + OPS_SHEET_ID);
  Logger.log('');
  Logger.log('Next steps:');
  Logger.log('  1. Upload XLSX price list files to Google Drive');
  Logger.log('  2. Run importPriceListsFromDrive()');
  Logger.log('  3. Deploy → New deployment → Web App');
  Logger.log('     Execute as: Me | Anyone can access');
  Logger.log('  4. Copy Web App URL → paste in app Settings');
  Logger.log('================================================');
}

function _boldHeader(sheet) {
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
}

// ── setMasterSheet ────────────────────────────────────────────────────────────
// Run from Apps Script editor to point to an existing master spreadsheet.
// HOW TO USE:
//   1. Get the spreadsheet ID from its URL (between /d/ and /edit)
//   2. Paste it below, replacing YOUR_SPREADSHEET_ID_HERE
//   3. Run → setMasterSheet
function setMasterSheet() {
  var id = 'YOUR_SPREADSHEET_ID_HERE';

  if (id === 'YOUR_SPREADSHEET_ID_HERE' || !id.trim()) {
    Logger.log('ERROR: Paste your spreadsheet ID into setMasterSheet() first.');
    return;
  }

  try {
    var ss = SpreadsheetApp.openById(id.trim());
    PropertiesService.getScriptProperties().setProperty('MASTER_SHEET_ID', id.trim());
    Logger.log('✓ Master sheet set to: ' + ss.getName());
    Logger.log('  URL: ' + ss.getUrl());
    Logger.log('  Tabs: ' + ss.getSheets().map(function(s){ return s.getName(); }).join(', '));
  } catch(e) {
    Logger.log('ERROR: Could not open sheet "' + id + '": ' + e.message);
  }
}
