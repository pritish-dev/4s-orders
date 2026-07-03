// ============================================================
//  4S Interiors — Google Apps Script backend  (Code.gs)
//  OPS Sheet ID : 12RtOVqlOicoGlF2oLRBv3wB9eeludiz08AFKbhPcNqs
// ============================================================
//
//  DEPLOY STEPS (every time you update this file):
//   1. Paste this entire file into your Apps Script project (code.gs)
//   2. Run → ensureSheets   (only needed once; sets up Orders_Master, etc.)
//   3. Deploy → Manage deployments → click pencil (Edit) on the existing deployment
//      → Version: "New version" → Deploy
//      *** The same URL is reused — no change needed in the app ***
//
//  LOGIN SHEET IN OPS (APP_ORDERING_CREDS tab):
//   Columns (row 1 = header, data from row 2):
//     A: Sales Person Name   B: username   C: Password
//     D: password_hash       E: Active
//   • Active must be TRUE / Yes / 1 for the user to be allowed to log in
//   • password_hash is optional; if set, it must be the MD5 hex of the password
//
//  PRICE LIST TABS IN OPS:
//   All tabs in the OPS sheet are scanned automatically EXCEPT:
//     Stock, APP_ORDERING_CREDS, Staff, Orders_Master, Change_Log, Sheet1-3
//   Two formats are auto-detected per tab:
//     1. Normalized CSV  → header row: CATEGORY|ITEM_GROUP|ITEM_CODE|DESCRIPTION|CPL|EXTRA_INFO
//     2. Raw Godrej XLSX → header row contains "LN Code" or "LN CODE"
//
// ============================================================

// ─── IDs ─────────────────────────────────────────────────────────────────────
var OPS_SHEET_ID = '12RtOVqlOicoGlF2oLRBv3wB9eeludiz08AFKbhPcNqs';

// Tabs in OPS sheet that are NOT price-list data
var PRICE_SKIP = [
  'Stock', 'APP_ORDERING_CREDS', 'Staff',
  'Orders_Master', 'Change_Log',
  'Sheet1', 'Sheet2', 'Sheet3', 'Sheet4', 'Sheet5',
];

// ─── Column indexes (0-based) ─────────────────────────────────────────────────
var COL_ORD = {
  TS:0, INTERNAL_NO:1, ORDER_NO:2, WON:3, STATUS:4,
  CUSTOMER:5, PHONE:6, ALT:7, EMAIL:8,
  BILLING:9, DELIVERY:10, LIFT:11, CUST_CODE:12,
  PO_REF:13, SOURCE:14, DISCOUNT:15, PLANNED_DLY:16,
  INSTALL_NOTE:17, PAYMENT_MODE:18, EARNEST:19, RECEIPT_NO:20,
  FOLLOW_UP:21, SALES_EXEC:22, ORDER_TYPE:23, ITEMS_JSON:24,
  SUBTOTAL:25, CGST:26, SGST:27, TOTAL_WITH_TAX:28, DATE:29
};
var COL_USR = { USERNAME:0, PASSWORD:1, NAME:2, CODE:3, ROLE:4 };
var COL_LOG = { TS:0, USER:1, ORDER_NO:2, ACTION:3, DETAIL:4 };

// ─── OPS sheet opener (never throws — returns null on failure) ────────────────
function _openOPS() {
  try { return SpreadsheetApp.openById(OPS_SHEET_ID); } catch(e) { return null; }
}

// ─── Master spreadsheet helpers ───────────────────────────────────────────────
function _getMasterSS() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('MASTER_SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch(e) {}
  }
  // Auto-setup: creates Orders_Master, Staff, Change_Log tabs in a new spreadsheet
  ensureSheets();
  id = props.getProperty('MASTER_SHEET_ID');
  if (!id) throw new Error('Master sheet not configured. Run ensureSheets() from the Apps Script editor.');
  return SpreadsheetApp.openById(id);
}

function _getSheet(name) { return _getMasterSS().getSheetByName(name); }

// ─── Response helpers ─────────────────────────────────────────────────────────
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

// ─── Entry points ─────────────────────────────────────────────────────────────
function doGet(e) {
  var p        = (e && e.parameter) ? e.parameter : {};
  var callback = p.callback || 'cb';
  var result;
  try {
    switch (p.action || '') {
      case 'ping':           result = handlePing();             break;
      case 'login':          result = handleLogin(p);           break;
      case 'stock':          result = handleStock();            break;
      case 'priceList':      result = handlePriceList();        break;
      case 'orders':         result = handleOrders(p);          break;
      case 'debugPriceList': result = handleDebugPriceList();   break;
      default:               result = { ok: false, error: 'Unknown action: ' + (p.action || '(none)') };
    }
  } catch(err) {
    result = { ok: false, error: err.message, stack: err.stack ? err.stack.slice(0,400) : '' };
  }
  return _jsonOut(callback, result);
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch(ex) { return _jsonPost({ ok: false, error: 'Bad JSON body' }); }
  var result;
  try {
    switch (body.action || '') {
      case 'saveOrder':  result = handleSaveOrder(body.order); break;
      case 'updateWON':  result = handleUpdateWON(body);       break;
      default:           result = { ok: false, error: 'Unknown action: ' + body.action };
    }
  } catch(err) {
    result = { ok: false, error: err.message };
  }
  return _jsonPost(result);
}

// ─── PING ─────────────────────────────────────────────────────────────────────
// Tests connectivity. Does NOT touch master sheet — safe to call before ensureSheets.
function handlePing() {
  var opsInfo    = { ok: false };
  var masterInfo = { note: 'Not configured yet — run ensureSheets() once' };

  var opsSS = _openOPS();
  if (opsSS) {
    opsInfo = {
      ok:     true,
      name:   opsSS.getName(),
      url:    opsSS.getUrl(),
      sheets: opsSS.getSheets().map(function(s){ return s.getName(); }),
    };
  } else {
    opsInfo = { ok: false, error: 'Cannot open OPS sheet (ID: ' + OPS_SHEET_ID + '). Check the sheet is shared with the script owner.' };
  }

  try {
    var props    = PropertiesService.getScriptProperties();
    var masterId = props.getProperty('MASTER_SHEET_ID');
    if (masterId) {
      var masterSS = SpreadsheetApp.openById(masterId);
      masterInfo = { ok: true, name: masterSS.getName(), url: masterSS.getUrl() };
    }
  } catch(e) {
    masterInfo = { ok: false, error: e.message };
  }

  return { ok: true, message: 'Connected', opsSheet: opsInfo, masterSheet: masterInfo };
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
// Priority order:
//   1. OPS sheet → "APP_ORDERING_CREDS" tab  (primary)
//   2. OPS sheet → "Staff" tab               (fallback)
//   3. Master spreadsheet → "Staff" tab      (legacy fallback)
//
// APP_ORDERING_CREDS column headers (row 1):
//   "Sales Person Name" | "username" | "Password" | "password_hash" | "Active"
function handleLogin(p) {
  var username = (p.username || '').toLowerCase().trim();
  var password = (p.password || '').trim();
  if (!username || !password) return { ok: false, error: 'Username and password are required.' };

  // 1. Try APP_ORDERING_CREDS in OPS sheet
  var opsSS = _openOPS();
  if (opsSS) {
    var credsSh = opsSS.getSheetByName('APP_ORDERING_CREDS');
    if (credsSh) {
      var result = _loginWithCreds(credsSh, username, password);
      if (result !== null) return result;   // found the username (matched or rejected)
    }

    // 2. Try Staff tab in OPS sheet
    var staffSh = opsSS.getSheetByName('Staff');
    if (staffSh) {
      var r2 = _loginWithStaff(staffSh, username, password);
      if (r2 !== null) return r2;
    }
  }

  // 3. Try Staff in master spreadsheet (legacy)
  try {
    var masterStaff = _getSheet('Staff');
    if (masterStaff) {
      var r3 = _loginWithStaff(masterStaff, username, password);
      if (r3 !== null) return r3;
    }
  } catch(e) {}

  return { ok: false, error: 'Username not found. Check your credentials or contact your manager.' };
}

// Login against APP_ORDERING_CREDS sheet.
// Returns { ok, user } if username matched (even if wrong password),
// or null if username not present in this sheet (try next sheet).
function _loginWithCreds(sh, username, password) {
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return null;

  // Map headers (case-insensitive)
  var hdr = rows[0].map(function(c){ return String(c || '').toLowerCase().trim(); });
  var cName  = _hdrIdx(hdr, ['sales person name', 'salesperson name', 'name', 'sales person']);
  var cUser  = _hdrIdx(hdr, ['username', 'user name', 'user']);
  var cPass  = _hdrIdx(hdr, ['password']);
  var cHash  = _hdrIdx(hdr, ['password_hash', 'passwordhash', 'hash']);
  var cActive = _hdrIdx(hdr, ['active', 'status', 'enabled']);

  // Positional defaults if headers not recognised
  if (cName   < 0) cName   = 0;
  if (cUser   < 0) cUser   = 1;
  if (cPass   < 0) cPass   = 2;
  if (cHash   < 0) cHash   = 3;
  if (cActive < 0) cActive = 4;

  for (var i = 1; i < rows.length; i++) {
    var r           = rows[i];
    var rowUser     = String(r[cUser]   || '').toLowerCase().trim();
    var activeRaw   = cActive < r.length ? String(r[cActive] || '').toLowerCase().trim() : 'true';

    if (!rowUser || rowUser !== username) continue;

    // Found the username row — check active flag
    if (activeRaw && activeRaw !== 'true' && activeRaw !== 'yes' && activeRaw !== '1') {
      return { ok: false, error: 'Your account is inactive. Please contact your manager.' };
    }

    // Check password
    var storedPass = cPass  < r.length ? String(r[cPass]  || '').trim() : '';
    var storedHash = cHash  < r.length ? String(r[cHash]  || '').trim() : '';
    var nameVal    = cName  < r.length ? String(r[cName]  || '').trim() : '';

    var matched = false;
    if (storedHash) {
      // Bcrypt hashes ($2b$/$2a$) cannot be verified in Apps Script — fall through to plaintext
      var isBcrypt = storedHash.slice(0, 4) === '$2b$' || storedHash.slice(0, 4) === '$2a$';
      if (!isBcrypt) {
        // MD5 hex check (32 chars)
        matched = (_md5(password) === storedHash.toLowerCase());
      }
    }
    if (!matched && storedPass) {
      matched = (storedPass === password);
    }

    if (matched) {
      return {
        ok:   true,
        user: {
          name:   nameVal || username,
          code:   rowUser,
          role:   'sales',
          branch: 'Patia',
        },
      };
    }
    return { ok: false, error: 'Incorrect password. Please try again.' };
  }

  return null; // username not in this sheet
}

// Login against legacy Staff sheet (username | password | name | code | role).
// Returns result object or null (to try next sheet).
function _loginWithStaff(sh, username, password) {
  var rows = sh.getDataRange().getValues().slice(1)
                .filter(function(r){ return String(r[COL_USR.USERNAME]||'').trim(); });
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[COL_USR.USERNAME]).toLowerCase().trim() !== username) continue;
    if (String(r[COL_USR.PASSWORD]).trim() !== password) {
      return { ok: false, error: 'Incorrect password.' };
    }
    return {
      ok: true,
      user: {
        name:   String(r[COL_USR.NAME] || ''),
        code:   String(r[COL_USR.CODE] || ''),
        role:   String(r[COL_USR.ROLE] || 'sales'),
        branch: 'Patia',
      },
    };
  }
  return null;
}

// MD5 hex digest using Apps Script Utilities
function _md5(input) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, input, Utilities.Charset.UTF_8
  );
  return raw.map(function(b){ return ('0' + (b + 256).toString(16)).slice(-2); }).join('');
}

// ─── STOCK ─────────────────────────────────────────────────────────────────────
// Reads OPS sheet → "Stock" tab.
// Expected columns (header row 1):
//   Code | Name | Category | CPL | MRP | KB_Qty | B2CB_Qty | PTA_Qty | CTC_Qty
// Column positions are detected from the header; positional fallback if headers differ.
function handleStock() {
  var sh = null;
  var opsSS = _openOPS();
  if (opsSS) sh = opsSS.getSheetByName('Stock');

  // Fallback: master sheet Stock_Master
  if (!sh) {
    try { sh = _getSheet('Stock_Master'); } catch(e) {}
  }
  if (!sh) {
    return { ok: false, error: 'Stock sheet not found. Add a "Stock" tab to the OPS spreadsheet (' + OPS_SHEET_ID + ').' };
  }

  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return { ok: true, items: [], syncedAt: new Date().toISOString() };

  // Auto-detect columns from header row
  var hdr = rows[0].map(function(c){ return String(c||'').toUpperCase().trim(); });
  var cCode = _hdrIdx(hdr, ['CODE', 'ITEM CODE', 'LN CODE', 'ITEM_CODE']);
  var cName = _hdrIdx(hdr, ['NAME', 'ITEM NAME', 'DESCRIPTION', 'LN DESCRIPTION']);
  var cCat  = _hdrIdx(hdr, ['CATEGORY', 'CAT', 'TYPE']);
  var cCPL  = _hdrIdx(hdr, ['CPL', 'BASIC PRICE', 'CONSUMER BASIC']);
  var cMRP  = _hdrIdx(hdr, ['MRP', 'PRICE', 'SELLING PRICE']);
  var cKB   = _hdrIdx(hdr, ['KB_QTY', 'KB', 'KB QTY']);
  var cB2CB = _hdrIdx(hdr, ['B2CB_QTY', 'B2CB', 'B2CB QTY']);
  var cPTA  = _hdrIdx(hdr, ['PTA_QTY', 'PTA', 'PTA QTY']);
  var cCTC  = _hdrIdx(hdr, ['CTC_QTY', 'CTC', 'CTC QTY']);

  // Positional defaults
  if (cCode < 0) cCode = 0;
  if (cName < 0) cName = 1;
  if (cCat  < 0) cCat  = 2;
  if (cCPL  < 0) cCPL  = 3;
  if (cMRP  < 0) cMRP  = 4;
  if (cKB   < 0) cKB   = 5;
  if (cB2CB < 0) cB2CB = 6;
  if (cPTA  < 0) cPTA  = 7;
  if (cCTC  < 0) cCTC  = 8;

  var BRANCHES = ['KB', 'B2CB', 'PTA', 'CTC'];
  var bCols    = [cKB, cB2CB, cPTA, cCTC];
  var syncedAt = new Date().toISOString();
  // Optional sync-timestamp in J1 (col 9)
  if (rows[0][9]) { var d = new Date(rows[0][9]); if (!isNaN(d)) syncedAt = d.toISOString(); }

  var items = [];
  for (var i = 1; i < rows.length; i++) {
    var r    = rows[i];
    var code = String(r[cCode] || '').toUpperCase().trim();
    var name = String(r[cName] || '').trim();
    if (!code && !name) continue;

    var cpl  = _numVal(r[cCPL]);
    var mrp  = _numVal(r[cMRP]) || cpl;
    var cat  = String(r[cCat]  || '').trim();
    var stock = BRANCHES.map(function(b, bi){
      return { b: b, q: parseInt(String(r[bCols[bi]] || 0).replace(/[^\d]/g,''), 10) || 0 };
    });

    items.push({ code: code, name: name, cat: cat, mrp: mrp, cpl: cpl, stock: stock });
  }
  return { ok: true, items: items, syncedAt: syncedAt };
}

// ─── PRICE LIST ───────────────────────────────────────────────────────────────
// Reads every tab in the OPS sheet that isn't in PRICE_SKIP.
// Auto-detects tab format:
//   • Normalized CSV  (header has ITEM_CODE + DESCRIPTION)
//   • Raw Godrej XLSX furniture (header has LN Code but not MODEL)
//   • Raw Godrej XLSX mattress  (header has LN Code AND MODEL)
function handlePriceList() {
  var opsSS = _openOPS();
  if (!opsSS) return { ok: false, error: 'Cannot open OPS spreadsheet (ID: ' + OPS_SHEET_ID + '). Ensure the script owner has access.' };

  var all    = [];
  var counts = {};
  var errors = [];

  var sheets = opsSS.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sh      = sheets[i];
    var tabName = sh.getName();
    if (_inSkipList(tabName)) continue;

    try {
      var tabItems = _parsePriceTab(sh, tabName);
      if (tabItems.length > 0) {
        all    = all.concat(tabItems);
        counts[tabName] = tabItems.length;
      }
    } catch(e) {
      errors.push(tabName + ': ' + e.message);
    }
  }

  var result = { ok: true, items: all, counts: counts, totalTabs: Object.keys(counts).length };
  if (errors.length) result.tabErrors = errors;
  return result;
}

function _inSkipList(name) {
  var n = name.trim();
  for (var i = 0; i < PRICE_SKIP.length; i++) {
    if (PRICE_SKIP[i].toLowerCase() === n.toLowerCase()) return true;
  }
  return false;
}

// ─── Tab format detector + dispatcher ────────────────────────────────────────
function _parsePriceTab(sh, tabName) {
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return [];

  var headerRow = -1;
  var format    = '';

  for (var i = 0; i < Math.min(10, rows.length); i++) {
    var cells  = rows[i].map(function(c){ return String(c||'').toUpperCase().trim(); });
    var joined = '|' + cells.join('|') + '|';

    // Normalized format: has ITEM_CODE (or ITEM CODE) + DESCRIPTION
    if ((joined.indexOf('|ITEM_CODE|') !== -1 || joined.indexOf('|ITEM CODE|') !== -1)
        && joined.indexOf('DESCRIPTION') !== -1) {
      headerRow = i; format = 'normalized'; break;
    }

    // Raw Godrej: has LN CODE somewhere
    if (joined.indexOf('LN CODE') !== -1) {
      headerRow = i;
      format    = (joined.indexOf('|MODEL|') !== -1) ? 'raw-mattress' : 'raw-furniture';
      break;
    }
  }

  if (headerRow < 0) return [];   // unrecognised tab — silently skip
  if (format === 'normalized')    return _parseNormTab(rows, headerRow, tabName);
  if (format === 'raw-furniture') return _parseFurnitureTab(rows, headerRow, tabName);
  if (format === 'raw-mattress')  return _parseMattressTab(rows, headerRow, tabName);
  return [];
}

// ─── Normalized tab parser ────────────────────────────────────────────────────
// Header: CATEGORY | ITEM_GROUP | ITEM_CODE | DESCRIPTION | CPL | EXTRA_INFO
function _parseNormTab(rows, headerRow, tabName) {
  var hdr    = rows[headerRow].map(function(c){ return String(c||'').toUpperCase().trim(); });
  var cCat   = _hdrIdx(hdr, ['CATEGORY', 'CAT']);    if (cCat   < 0) cCat   = 0;
  var cGroup = _hdrIdx(hdr, ['ITEM_GROUP', 'ITEM GROUP', 'GROUP', 'SUB CATEGORY', 'SUBCATEGORY']); if (cGroup < 0) cGroup = 1;
  var cCode  = _hdrIdx(hdr, ['ITEM_CODE', 'ITEM CODE', 'LN CODE', 'LN_CODE', 'CODE']); if (cCode  < 0) cCode  = 2;
  var cDesc  = _hdrIdx(hdr, ['DESCRIPTION', 'LN DESCRIPTION', 'LN_DESCRIPTION', 'ITEM DESCRIPTION', 'PRODUCT NAME']); if (cDesc  < 0) cDesc  = 3;
  var cCPL   = _hdrIdx(hdr, ['CPL', 'PRICE', 'UNIT CONSUMER BASIC', 'CONSUMER BASIC', 'CONSUMER PRICE', 'MRP', 'RATE']); if (cCPL   < 0) cCPL   = 4;
  var cExtra = _hdrIdx(hdr, ['EXTRA_INFO', 'EXTRA', 'REMARKS', 'NOTES']); if (cExtra < 0) cExtra = 5;

  var items = [];
  for (var r = headerRow + 1; r < rows.length; r++) {
    var row   = rows[r];
    var code  = String(row[cCode]  || '').trim();
    var desc  = String(row[cDesc]  || '').trim();
    if (!code && !desc) continue;

    var cat   = String(row[cCat]   || tabName).trim() || tabName;
    var group = String(row[cGroup] || '').trim();
    var cpl   = _numVal(row[cCPL]);
    var extra = cExtra < row.length ? String(row[cExtra] || '').trim() : '';

    items.push(_makeItem(tabName, cat, group, code, desc, cpl, extra));
  }
  return items;
}

// ─── Raw Godrej furniture tab parser ─────────────────────────────────────────
// Header row: [blank] | HSN CODE | LN Code | LN Description | Unit Consumer Basic [| extras]
// Sub-category markers appear in two forms:
//   • Home Storage style : col before LN Code has text, LN Code column is empty
//   • Living Room style  : LN Code column has the sub-cat name, Description + Price are empty
function _parseFurnitureTab(rows, headerRow, tabName) {
  var hdr   = rows[headerRow].map(function(c){ return String(c||'').toUpperCase().trim(); });
  var cCode = _hdrIdx(hdr, ['LN CODE', 'ITEM CODE', 'LN_CODE']);
  var cDesc = _hdrIdx(hdr, ['LN DESCRIPTION', 'ITEM DESCRIPTION', 'DESCRIPTION', 'LN_DESCRIPTION']);
  var cCPL  = _hdrIdx(hdr, ['UNIT CONSUMER BASIC', 'CONSUMER BASIC', 'CPL', 'PRICE']);
  if (cCode < 0 || cDesc < 0) return [];

  var items        = [];
  var currentGroup = '';

  for (var r = headerRow + 1; r < rows.length; r++) {
    var row    = rows[r];
    var code   = String(row[cCode] || '').trim();
    var desc   = String(row[cDesc] || '').trim();
    var price  = cCPL >= 0 ? row[cCPL] : 0;
    var priceFl = _numVal(price);

    // Completely blank row — check column before code for HS-style sub-cat marker
    if (!code && !desc) {
      if (cCode > 0) {
        var pre = String(row[cCode - 1] || '').trim();
        if (pre && isNaN(parseFloat(pre))) currentGroup = pre;
      }
      continue;
    }

    // LR-style sub-cat: code has text, description is empty, price is 0
    if (code && !desc && priceFl === 0) { currentGroup = code; continue; }

    // Data row
    if (code && desc) {
      var extraParts = [];
      var eMax = Math.min(cCPL + 3, row.length);
      for (var ec = cCPL + 1; ec < eMax; ec++) {
        var ev = String(row[ec] || '').trim();
        if (ev) extraParts.push(ev);
      }
      items.push(_makeItem(tabName, tabName, currentGroup, code, desc, priceFl, extraParts.join(' | ')));
    }
  }
  return items;
}

// ─── Raw Godrej mattress tab parser ──────────────────────────────────────────
// Header: [blank] | HSN | Reference | Model | LN Code | LN Description | Thickness(in) | Thickness(cm) | CPL
function _parseMattressTab(rows, headerRow, tabName) {
  var hdr    = rows[headerRow].map(function(c){ return String(c||'').toUpperCase().trim(); });
  var cCode  = _hdrIdx(hdr, ['LN CODE']);
  var cDesc  = _hdrIdx(hdr, ['LN DESCRIPTION', 'DESCRIPTION']);
  var cModel = _hdrIdx(hdr, ['MODEL']);
  var cRef   = _hdrIdx(hdr, ['REFERENCE']);
  var cTin   = _hdrIdx(hdr, ['REFERENCE (THICKNESS IN INCH)', 'THICKNESS IN INCH']);
  var cTcm   = _hdrIdx(hdr, ['THICKNESS IN CM']);
  var cCPL   = _hdrIdx(hdr, ['UNIT CONSUMER BASIC', 'CONSUMER BASIC', 'CPL', 'PRICE']);
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

    var cpl   = cCPL  >= 0 ? _numVal(row[cCPL])                      : 0;
    var ref   = cRef  >= 0 ? String(row[cRef]  || '').trim()          : '';
    var tin   = cTin  >= 0 ? String(row[cTin]  || '').trim()          : '';
    var tcm   = cTcm  >= 0 ? String(row[cTcm]  || '').trim()          : '';
    var extra = tin   ? (tin + '"' + (tcm ? ' / ' + tcm + 'cm' : '')) : ref;

    items.push(_makeItem('Mattress', 'Mattress', currentModel, code, desc, cpl, extra));
  }
  return items;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function _hdrIdx(headers, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var key = candidates[i].toUpperCase();
    for (var j = 0; j < headers.length; j++) {
      if (headers[j].toUpperCase() === key) return j;
    }
  }
  return -1;
}

function _numVal(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  // Strip currency symbols, spaces, commas (thousands separators) — keep digits and one decimal point
  var s = String(v).replace(/[^\d.]/g, '');
  // If multiple dots (e.g. European "1.000.00"), keep only the last one
  var parts = s.split('.');
  if (parts.length > 2) s = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  return parseFloat(s) || 0;
}

function _makeItem(tabName, cat, group, code, desc, cpl, extra) {
  var name       = desc || group || cat;
  var searchName = [tabName, cat, group, desc, code, extra].filter(Boolean).join(' ');
  return {
    code:       code.toUpperCase(),
    name:       name,
    searchName: searchName,
    cat:        cat,
    item:       group  || '',
    mrp:        cpl,
    cpl:        cpl,
    extra:      extra  || '',
    stock:      [],
    sheet:      tabName,
  };
}

// ─── ORDERS ───────────────────────────────────────────────────────────────────
function handleOrders(p) {
  var sh = _getSheet('Orders_Master');
  if (!sh) return { ok: false, error: 'Orders_Master sheet not found. Run ensureSheets().' };

  var rows   = sh.getDataRange().getValues();
  var exec   = (p.exec || '').trim().toLowerCase();
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  var orders = [];
  for (var i = rows.length - 1; i >= 1; i--) {
    var r  = rows[i];
    var ts = r[COL_ORD.TS];
    if (!ts) continue;
    var rowDate = ts instanceof Date ? ts : new Date(ts);
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

// ─── SAVE ORDER ───────────────────────────────────────────────────────────────
function handleSaveOrder(o) {
  if (!o) throw new Error('No order data provided.');
  var sh = _getSheet('Orders_Master');
  if (!sh) throw new Error('Orders_Master sheet not found. Run ensureSheets().');

  var lastRow    = sh.getLastRow();
  var internalNo = lastRow;
  var receiptNo  = String(o.receiptNo || '').trim();
  var orderNo    = receiptNo ? (internalNo + '/' + receiptNo) : String(internalNo);

  var now      = new Date();
  var dateStr  = now.toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'2-digit' }).replace(/\//g,'.');
  var subtotal = o.items ? o.items.reduce(function(s,i){ return s + (i.total||0); }, 0) : 0;
  var cgst     = Math.round(subtotal * 0.09);
  var sgst     = Math.round(subtotal * 0.09);
  var total    = subtotal + cgst + sgst;

  sh.appendRow([
    now, internalNo, orderNo,
    String(o.won          || ''), 'pending-won',
    String(o.customer     || ''), String(o.phone       || ''), String(o.alt          || ''), String(o.email        || ''),
    String(o.billing      || ''), String(o.delivery    || ''), String(o.liftAvailable|| ''), String(o.customerCode || ''),
    String(o.poRef        || ''), String(o.source      || ''), String(o.discountCode || ''), String(o.plannedDly   || ''),
    String(o.installNote  || ''), String(o.paymentMode || ''), Number(o.earnest      || 0),  receiptNo,
    String(o.followUp     || ''), String(o.salesExec   || ''), String(o.orderType    || 'B2C'),
    JSON.stringify(o.items || []),
    subtotal, cgst, sgst, total, dateStr,
  ]);

  _appendLog(String(o.salesExec||''), orderNo, 'CREATE',
    'Customer: ' + (o.customer||'') + ' | Items: ' + (o.items ? o.items.length : 0));

  return { ok: true, orderNo: orderNo, internalNo: internalNo };
}

// ─── UPDATE WON ───────────────────────────────────────────────────────────────
function handleUpdateWON(body) {
  var orderNo    = String(body.orderNo    || '');
  var internalNo = Number(body.internalNo || 0);
  var won        = String(body.won        || '').trim().toUpperCase();
  var updatedBy  = String(body.updatedBy  || '');
  if (!won) return { ok: false, error: 'WON number is required.' };

  var sh = _getSheet('Orders_Master');
  if (!sh) return { ok: false, error: 'Orders_Master not found.' };

  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (Number(rows[i][COL_ORD.INTERNAL_NO]) === internalNo ||
        String(rows[i][COL_ORD.ORDER_NO])    === orderNo) {
      sh.getRange(i + 1, COL_ORD.WON    + 1).setValue(won);
      sh.getRange(i + 1, COL_ORD.STATUS + 1).setValue('billed');
      _appendLog(updatedBy, orderNo, 'UPDATE_WON', 'WON: ' + won);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Order not found: ' + orderNo };
}

// ─── CHANGE LOG ───────────────────────────────────────────────────────────────
function _appendLog(user, orderNo, action, detail) {
  try {
    var sh = _getSheet('Change_Log');
    if (sh) sh.appendRow([new Date(), user, orderNo, action, detail]);
  } catch(e) { Logger.log('Change_Log error: ' + e.message); }
}

// ─── DEBUG PRICE LIST ─────────────────────────────────────────────────────────
// Call via ?action=debugPriceList to see exactly what the script finds in OPS sheet.
function handleDebugPriceList() {
  var opsSS = _openOPS();
  if (!opsSS) return { ok: false, error: 'Cannot open OPS sheet: ' + OPS_SHEET_ID };

  var allTabs   = opsSS.getSheets().map(function(s){ return s.getName(); });
  var priceTabs = allTabs.filter(function(n){ return !_inSkipList(n); });
  var tabInfo   = {};

  priceTabs.forEach(function(tabName) {
    var sh   = opsSS.getSheetByName(tabName);
    var rows = sh.getDataRange().getValues();
    tabInfo[tabName] = {
      totalRows: rows.length,
      header:    rows[0] ? rows[0].slice(0,8).map(String) : [],
      sample:    rows.slice(1,4).map(function(r){ return r.slice(0,6).map(String); }),
    };
  });

  return {
    ok:          true,
    opsName:     opsSS.getName(),
    opsUrl:      opsSS.getUrl(),
    allTabs:     allTabs,
    priceTabs:   priceTabs,
    skippedTabs: PRICE_SKIP,
    tabInfo:     tabInfo,
  };
}

// ─── ensureSheets ─────────────────────────────────────────────────────────────
// Run ONCE from Apps Script editor to create the master spreadsheet.
// The OPS sheet (price lists + stock + APP_ORDERING_CREDS) is managed separately.
function ensureSheets() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('MASTER_SHEET_ID');
  var ss;

  if (id) {
    try { ss = SpreadsheetApp.openById(id); Logger.log('Using existing master: ' + ss.getUrl()); }
    catch(e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('4S Interiors — Orders Master');
    props.setProperty('MASTER_SHEET_ID', ss.getId());
    Logger.log('Created master: ' + ss.getUrl());
  }

  // Staff
  if (!ss.getSheetByName('Staff')) {
    var staff = ss.insertSheet('Staff');
    staff.appendRow(['username','password','name','code','role']);
    staff.appendRow(['manager','manager123','Shaktiman','MG-01','manager']);
    staff.appendRow(['pritish','pritish123','Pritish','PK-07','admin']);
    _boldRow1(staff);
    Logger.log('Staff tab created (add users here or use APP_ORDERING_CREDS in OPS sheet)');
  }

  // Stock_Master (fallback if OPS Stock tab doesn't exist)
  if (!ss.getSheetByName('Stock_Master')) {
    var stock = ss.insertSheet('Stock_Master');
    stock.appendRow(['Code','Name','Category','CPL','MRP','KB_Qty','B2CB_Qty','PTA_Qty','CTC_Qty','Updated_At']);
    _boldRow1(stock);
    Logger.log('Stock_Master tab created — paste Godrej stock data here, or use "Stock" tab in OPS sheet');
  }

  // Orders_Master
  if (!ss.getSheetByName('Orders_Master')) {
    var orders = ss.insertSheet('Orders_Master');
    orders.appendRow([
      'Timestamp','InternalNo','OrderNo','WON','Status',
      'Customer','Phone','Alt','Email',
      'Billing','Delivery','LiftAvailable','CustomerCode',
      'PORef','Source','DiscountCode','PlannedDly',
      'InstallNote','PaymentMode','Earnest','ReceiptNo',
      'FollowUp','SalesExec','OrderType','Items_JSON',
      'Subtotal','CGST','SGST','TotalWithTax','Date',
    ]);
    _boldRow1(orders);
    Logger.log('Orders_Master tab created');
  }

  // Change_Log
  if (!ss.getSheetByName('Change_Log')) {
    var log = ss.insertSheet('Change_Log');
    log.appendRow(['Timestamp','User','OrderNo','Action','Detail']);
    _boldRow1(log);
    Logger.log('Change_Log tab created');
  }

  // Remove default Sheet1
  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && ss.getSheets().length > 1) ss.deleteSheet(s1);

  Logger.log('');
  Logger.log('============================================');
  Logger.log('Master sheet ready: ' + ss.getUrl());
  Logger.log('');
  Logger.log('OPS sheet (price lists + stock + login):');
  Logger.log('  https://docs.google.com/spreadsheets/d/' + OPS_SHEET_ID);
  Logger.log('  → Add tab "APP_ORDERING_CREDS" for login credentials');
  Logger.log('  → Add tab "Stock" for stock data');
  Logger.log('  → Price list tabs are already imported from CSVs');
  Logger.log('');
  Logger.log('Next: Deploy → New deployment → Web App');
  Logger.log('  Execute as: Me | Who has access: Anyone');
  Logger.log('============================================');
}

function _boldRow1(sheet) {
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
}

// ─── setMasterSheet ───────────────────────────────────────────────────────────
// Run from Apps Script editor to point to an existing master spreadsheet.
function setMasterSheet() {
  var id = 'YOUR_SPREADSHEET_ID_HERE';   // ← paste your spreadsheet ID here
  if (!id || id === 'YOUR_SPREADSHEET_ID_HERE') {
    Logger.log('ERROR: Paste your spreadsheet ID first.');
    return;
  }
  try {
    var ss = SpreadsheetApp.openById(id.trim());
    PropertiesService.getScriptProperties().setProperty('MASTER_SHEET_ID', id.trim());
    Logger.log('Master sheet set: ' + ss.getName() + ' | ' + ss.getUrl());
  } catch(e) {
    Logger.log('ERROR: ' + e.message);
  }
}

// ─── importPriceListsFromDrive ────────────────────────────────────────────────
// Optional: Run this to import XLSX files from Drive into OPS sheet tabs.
// Only needed if you did NOT manually import the CSVs.
// BEFORE RUNNING:
//   1. Upload both XLSX files to Google Drive
//   2. Enable Drive API v2: Services (+) → Drive API → Add
//   3. Run → importPriceListsFromDrive
function importPriceListsFromDrive() {
  var opsSS = _openOPS();
  if (!opsSS) { Logger.log('ERROR: Cannot open OPS sheet'); return; }

  _importXLSXToOPS(opsSS, 'CPL - HF HS - April 2026.xlsx',              'furniture');
  _importXLSXToOPS(opsSS, 'Mattress CPL Price List WEF 14 04 2026.xlsx', 'mattress');

  Logger.log('Import complete. OPS sheet: ' + opsSS.getUrl());
}

function _importXLSXToOPS(opsSS, fileName, fileType) {
  var files = DriveApp.getFilesByName(fileName);
  if (!files.hasNext()) { Logger.log('File not found: ' + fileName); return; }

  var file = files.next();
  Logger.log('Converting: ' + fileName);

  var tempFile;
  try {
    tempFile = Drive.Files.insert(
      { title: '_4s_tmp_' + fileType, mimeType: MimeType.GOOGLE_SHEETS },
      file.getBlob(), { convert: true }
    );
  } catch(e) {
    Logger.log('Drive API error: ' + e.message + '. Enable Drive API v2 in Services.');
    return;
  }

  var tempSS = SpreadsheetApp.openById(tempFile.id);
  tempSS.getSheets().forEach(function(sh) {
    var tabName = sh.getName();
    var rows    = sh.getDataRange().getValues();
    var items   = _extractItemsFromRawSheet(rows, tabName, fileType === 'mattress' ? 'raw-mattress' : 'raw-furniture');
    if (fileType === 'mattress') tabName = 'Mattress';
    if (items.length > 0) {
      _writeNormalizedTab(opsSS, tabName, items);
      Logger.log('  ' + tabName + ': ' + items.length + ' items');
    }
  });

  try { DriveApp.getFileById(tempFile.id).setTrashed(true); } catch(e) {}
}

function _extractItemsFromRawSheet(rows, tabName, format) {
  var headerRow = -1;
  for (var i = 0; i < Math.min(10, rows.length); i++) {
    var cells = rows[i].map(function(c){ return String(c||'').toUpperCase().trim(); });
    if (cells.indexOf('LN CODE') !== -1) { headerRow = i; break; }
  }
  if (headerRow < 0) return [];
  if (format === 'raw-furniture') return _parseFurnitureTab(rows, headerRow, tabName);
  if (format === 'raw-mattress')  return _parseMattressTab(rows, headerRow, tabName);
  return [];
}

function _writeNormalizedTab(ss, tabName, items) {
  var sh = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
  sh.clearContents();
  var rows = [['CATEGORY','ITEM_GROUP','ITEM_CODE','DESCRIPTION','CPL','EXTRA_INFO']];
  items.forEach(function(it){
    rows.push([it.cat||'', it.item||'', it.code||'', it.name||'', it.cpl||0, it.extra||'']);
  });
  sh.getRange(1, 1, rows.length, 6).setValues(rows);
  _boldRow1(sh);
}
