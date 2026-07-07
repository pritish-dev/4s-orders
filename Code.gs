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

// ─── IDs & version ───────────────────────────────────────────────────────────
var OPS_SHEET_ID    = '12RtOVqlOicoGlF2oLRBv3wB9eeludiz08AFKbhPcNqs';
// CRM spreadsheet ("B2C FRANCHISE APP ORDER DETAILS 26-27") — one row per ordered item
var CRM_SHEET_ID    = '1wFpK-WokcZB6k1vzG7B6JO5TdGHrUwdgvVm_-UQse54';
var CRM_TAB_NAME    = 'B2C FRANCHISE APP ORDER DETAILS 26-27';
var SCRIPT_VERSION  = 'v25';   // bump this whenever you redeploy

// Tabs in OPS sheet that are NOT price-list data
var PRICE_SKIP = [
  'Stock', 'APP_ORDERING_CREDS', 'Staff',
  'Orders_Master', 'Change_Log', 'Price_Lists',
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
// The app no longer uses a master spreadsheet at runtime (the CRM tab is the
// single source of truth). This only opens an EXISTING master if one is still
// configured (e.g. the legacy Staff login fallback) — it never auto-creates one.
function _getMasterSS() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('MASTER_SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch(e) {}
  }
  return null;
}

function _getSheet(name) { var ss = _getMasterSS(); return ss ? ss.getSheetByName(name) : null; }

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
      case 'priceList':      result = handlePriceList(p);       break;
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
      case 'saveOrder':       result = handleSaveOrder(body.order);   break;
      case 'updateWON':       result = handleUpdateWON(body);         break;
      case 'updateDelivery':  result = handleUpdateDelivery(body);    break;
      case 'deleteOrder':     result = handleDeleteOrder(body);       break;
      default:                result = { ok: false, error: 'Unknown action: ' + body.action };
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
  var cRole  = _hdrIdx(hdr, ['role', 'user role', 'access', 'access level', 'designation']);

  // Positional defaults if headers not recognised
  if (cName   < 0) cName   = 0;
  if (cUser   < 0) cUser   = 1;
  if (cPass   < 0) cPass   = 2;
  if (cHash   < 0) cHash   = 3;
  if (cActive < 0) cActive = 4;
  // cRole has NO positional default — if there's no Role column, everyone is 'sales'.

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
      var roleVal = (cRole >= 0 && cRole < r.length) ? String(r[cRole] || '').trim() : '';
      return {
        ok:   true,
        user: {
          name:   nameVal || username,
          code:   rowUser,
          role:   _normRole(roleVal),
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
        role:   _normRole(r[COL_USR.ROLE]),
        branch: 'Patia',
      },
    };
  }
  return null;
}

// Normalise a raw role cell to one of: 'sales' | 'manager' | 'admin'.
// Anything unrecognised (or blank) falls back to 'sales' — the least-privileged
// role — so a typo in the sheet can never accidentally grant elevated access.
function _normRole(raw) {
  var r = String(raw || '').toLowerCase().trim();
  if (r === 'admin' || r === 'administrator' || r === 'owner') return 'admin';
  if (r === 'manager' || r === 'mgr' || r === 'store manager') return 'manager';
  return 'sales';
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
// Current sheet format (ONE row per warehouse × item):
//   Fetched On | Date & Time | Warehouse code | Item code | Item Description | Free Stock | Qty Available For Commitment
// Rows are grouped by Item code; each distinct Warehouse code becomes one stock
// chip. Only the warehouses that actually appear for an item are returned — no
// fixed/placeholder branches. The surfaced quantity is "Qty Available For
// Commitment" (what can be sold), falling back to Free Stock if that's absent.
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

  // Auto-detect columns from the header row
  var hdr = rows[0].map(function(c){ return String(c||'').toUpperCase().trim(); });
  var cWh    = _hdrIdx(hdr, ['WAREHOUSE CODE', 'WAREHOUSE', 'WH CODE', 'WH']);
  var cCode  = _hdrIdx(hdr, ['ITEM CODE', 'CODE', 'ITEM_CODE', 'LN CODE']);
  var cName  = _hdrIdx(hdr, ['ITEM DESCRIPTION', 'DESCRIPTION', 'ITEM NAME', 'NAME']);
  var cAvail = _hdrIdx(hdr, ['QTY AVAILABLE FOR COMMITMENT', 'QTY AVAILABLE', 'AVAILABLE FOR COMMITMENT', 'AVAILABLE QTY', 'AVAILABLE']);
  var cFree  = _hdrIdx(hdr, ['FREE STOCK', 'FREESTOCK']);
  var cFetch = _hdrIdx(hdr, ['FETCHED ON', 'DATE & TIME', 'DATE AND TIME']);

  // Positional fallback matching the documented column order
  if (cWh    < 0) cWh    = 2;
  if (cCode  < 0) cCode  = 3;
  if (cName  < 0) cName  = 4;
  if (cFree  < 0) cFree  = 5;
  if (cAvail < 0) cAvail = 6;

  // Quantity to surface: available-for-commitment, else free stock.
  var cQty = cAvail >= 0 ? cAvail : cFree;

  var byCode = {}, order = [], syncedAt = null;
  for (var i = 1; i < rows.length; i++) {
    var r    = rows[i];
    var code = String(r[cCode] || '').toUpperCase().trim();
    if (!code) continue;
    var wh   = String(r[cWh]   || '').toUpperCase().trim();
    var name = String(r[cName] || '').trim();
    var qty  = parseInt(String(r[cQty] != null ? r[cQty] : 0).replace(/[^\d-]/g, ''), 10) || 0;

    if (cFetch >= 0 && !syncedAt) { var d = new Date(r[cFetch]); if (!isNaN(d.getTime())) syncedAt = d.toISOString(); }

    if (!byCode[code]) { byCode[code] = { code: code, name: name, mrp: 0, cpl: 0, stock: [], _wh: {} }; order.push(code); }
    var it = byCode[code];
    if (name && !it.name) it.name = name;
    if (wh) {
      if (it._wh[wh] === undefined) { it._wh[wh] = it.stock.length; it.stock.push({ b: wh, q: qty }); }
      else { it.stock[it._wh[wh]].q += qty; }   // same warehouse listed twice → sum
    }
  }

  var items = order.map(function(code){ var it = byCode[code]; delete it._wh; return it; });
  return { ok: true, items: items, syncedAt: syncedAt || new Date().toISOString() };
}

// ─── PRICE LIST ───────────────────────────────────────────────────────────────
// Reads ONLY the tabs listed in the 'Price_Lists' config sheet.
// If Price_Lists sheet is missing or empty, returns a SETUP_NEEDED error
// instead of guessing — prevents stock/admin sheets from being read as prices.
function handlePriceList(p) {
  // Serve from the fast server-side cache unless the app asked for fresh data
  // (manual "Sync" passes fresh=1). Cache is versioned so a redeploy busts it.
  var wantFresh = p && (p.fresh === '1' || p.fresh === 'true' || p.fresh === 1);
  var cacheKey  = 'pricelist_' + SCRIPT_VERSION;
  if (!wantFresh) {
    var hit = _cacheGet(cacheKey);
    if (hit && hit.ok && hit.items && hit.items.length) { hit.cached = true; return hit; }
  }

  var opsSS = _openOPS();
  if (!opsSS) return { ok: false, error: 'Cannot open OPS spreadsheet (ID: ' + OPS_SHEET_ID + '). Ensure the script owner has access.' };

  var priceCfg = _getPriceListConfig(opsSS);

  // No Price_Lists config sheet → fall back to auto-scanning every tab that is
  // not in PRICE_SKIP. Tabs without a recognised price header are skipped
  // silently inside _parsePriceTab, so admin/stock tabs never pollute prices.
  var usedFallback = false;
  if (priceCfg.length === 0) {
    usedFallback = true;
    priceCfg = opsSS.getSheets()
      .map(function(s){ return s.getName(); })
      .filter(function(n){ return !_inSkipList(n); })
      .map(function(n){ return { tab: n, cat: n }; });
  }

  var all    = [];
  var counts = {};
  var errors = [];

  for (var i = 0; i < priceCfg.length; i++) {
    var cfg = priceCfg[i];
    var sh  = opsSS.getSheetByName(cfg.tab);
    if (!sh) { errors.push(cfg.tab + ': tab not found in OPS sheet'); continue; }
    try {
      var tabItems = _parsePriceTab(sh, cfg.tab, cfg.cat);
      if (tabItems.length > 0) {
        all = all.concat(tabItems);
        counts[cfg.tab] = tabItems.length;
      } else {
        errors.push(cfg.tab + ': 0 items parsed (check tab format — needs ITEM_CODE/LN CODE header)');
      }
    } catch(e) {
      errors.push(cfg.tab + ': ' + e.message);
    }
  }

  // Annotate items using the "Discontinued Products" tab (matched by item code):
  //   REMARKS "Discontinued" → item.discontinued + item.discSince (date)
  //   Any row that carries an Alt item code → item.altCode, which the order
  //   form / PDF / CRM use in place of the (old) price-list code. The alt code
  //   is applied whenever it exists, regardless of the exact REMARKS wording.
  var annDiscontinued = 0, annAltCode = 0;
  try {
    var discMap = _getDiscontinuedMap(opsSS);
    if (discMap) {
      for (var d = 0; d < all.length; d++) {
        var info = discMap[all[d].code];
        if (!info) continue;
        if (info.remarks.indexOf('discontinu') !== -1) {
          all[d].discontinued = true;
          all[d].discSince    = info.date || '';
          annDiscontinued++;
        }
        if (info.altCode) {
          all[d].altCode = info.altCode;
          if (info.altName) all[d].altName = info.altName;
          annAltCode++;
        }
      }
    }
  } catch (e) { /* discontinued annotation is non-fatal */ }

  if (all.length === 0) {
    return {
      ok:        false,
      errorCode: 'SETUP_NEEDED',
      scriptVersion: SCRIPT_VERSION,
      error:     'No price items could be read from the OPS spreadsheet.\n\n' +
                 (usedFallback
                   ? 'No "Price_Lists" config tab was found, so all tabs were scanned automatically ' +
                     'but none had a recognised price header (needs ITEM_CODE / ITEM CODE / LN CODE + DESCRIPTION).\n\n'
                   : 'The tabs listed in "Price_Lists" were read but none had a recognised price header ' +
                     '(needs ITEM_CODE / ITEM CODE / LN CODE + DESCRIPTION).\n\n') +
                 'Check the price tab headers, or list the correct tab names in a "Price_Lists" tab (Column A: Tab Name, Column B: Category).',
      tabErrors: errors,
    };
  }

  var result = { ok: true, scriptVersion: SCRIPT_VERSION, mode: usedFallback ? 'auto-scan' : 'config', items: all, counts: counts, totalTabs: Object.keys(counts).length,
                 annotated: { discontinued: annDiscontinued, altCode: annAltCode } };
  if (errors.length) result.tabErrors = errors;
  _cachePut(cacheKey, result);   // speed up the next load
  return result;
}

// ─── Chunked script cache (values >100KB are split across keys) ──────────────
function _cachePut(key, obj) {
  try {
    var cache = CacheService.getScriptCache();
    var s = JSON.stringify(obj);
    var size = 90000, n = Math.ceil(s.length / size), map = {};
    for (var i = 0; i < n; i++) map[key + '_' + i] = s.substring(i * size, (i + 1) * size);
    map[key + '_meta'] = JSON.stringify({ n: n });
    cache.putAll(map, 3600);   // 1 hour
  } catch (e) { /* cache is best-effort */ }
}
function _cacheGet(key) {
  try {
    var cache = CacheService.getScriptCache();
    var meta  = cache.get(key + '_meta');
    if (!meta) return null;
    var n = JSON.parse(meta).n, keys = [];
    for (var i = 0; i < n; i++) keys.push(key + '_' + i);
    var parts = cache.getAll(keys), s = '';
    for (var j = 0; j < n; j++) { var pc = parts[key + '_' + j]; if (pc === undefined || pc === null) return null; s += pc; }
    return JSON.parse(s);
  } catch (e) { return null; }
}

// Reads Price_Lists sheet. Expected columns: Tab Name | Category
// Returns [{tab, cat}] or [] if sheet absent / empty.
function _getPriceListConfig(opsSS) {
  // Accept a few common spellings of the config tab name
  var sh = null;
  var candidates = ['Price_Lists', 'Price Lists', 'PriceLists', 'Price_List', 'Price List', 'PriceList'];
  for (var c = 0; c < candidates.length; c++) {
    sh = opsSS.getSheetByName(candidates[c]);
    if (sh) break;
  }
  if (!sh) return [];
  var rows = sh.getDataRange().getValues();
  var result = [];
  for (var i = 1; i < rows.length; i++) {   // skip header row
    var tab = String(rows[i][0] || '').trim();
    var cat = String(rows[i][1] || '').trim();
    if (tab) result.push({ tab: tab, cat: cat || tab });
  }
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
// catOverride: if non-empty string, all items from this tab get that category
//              (set from Price_Lists sheet column B)
function _parsePriceTab(sh, tabName, catOverride) {
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return [];

  var headerRow = -1;
  var format    = '';

  for (var i = 0; i < Math.min(10, rows.length); i++) {
    var cells  = rows[i].map(function(c){ return String(c||'').toUpperCase().trim(); });
    var joined = '|' + cells.join('|') + '|';

    // Normalized format: has ITEM_CODE (or ITEM CODE) + DESCRIPTION
    if ((joined.indexOf('|ITEM_CODE|') !== -1 || joined.indexOf('|ITEM CODE|') !== -1
         || joined.indexOf('|LN_CODE|') !== -1)
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
  if (format === 'normalized')    return _parseNormTab(rows, headerRow, tabName, catOverride);
  if (format === 'raw-furniture') return _parseFurnitureTab(rows, headerRow, tabName, catOverride);
  if (format === 'raw-mattress')  return _parseMattressTab(rows, headerRow, tabName, catOverride);
  return [];
}

// ─── Normalized tab parser ────────────────────────────────────────────────────
// Header: CATEGORY | ITEM_GROUP | ITEM_CODE | DESCRIPTION | CPL | EXTRA_INFO
// catOverride: when set (from Price_Lists sheet), all items get that category
function _parseNormTab(rows, headerRow, tabName, catOverride) {
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

    // Use catOverride if provided, else read from CATEGORY column, else fall back to tabName
    var cat   = catOverride || String(row[cCat] || tabName).trim() || tabName;
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
function _parseFurnitureTab(rows, headerRow, tabName, catOverride) {
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
      items.push(_makeItem(tabName, catOverride || tabName, currentGroup, code, desc, priceFl, extraParts.join(' | ')));
    }
  }
  return items;
}

// ─── Raw Godrej mattress tab parser ──────────────────────────────────────────
// Header: [blank] | HSN | Reference | Model | LN Code | LN Description | Thickness(in) | Thickness(cm) | CPL
function _parseMattressTab(rows, headerRow, tabName, catOverride) {
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

    items.push(_makeItem(tabName, catOverride || 'Mattress', currentModel, code, desc, cpl, extra));
  }
  return items;
}

// ─── Discontinued Products lookup ─────────────────────────────────────────────
// OPS tab "Discontinued Products" headers:
//   Item Code | Item Description | PRODUCT FAMILY | DATE OF DISCONTINUATION |
//   REMARKS | Alt item code | Alt Item code Description
// Returns { <UPPER item code>: {remarks, remarksRaw, date, altCode, altName} } or null.
function _getDiscontinuedMap(opsSS) {
  var sh = opsSS.getSheetByName('Discontinued Products');
  if (!sh) return null;
  var rows = sh.getDataRange().getValues();
  if (rows.length < 2) return {};

  var hdr   = rows[0].map(function(c){ return String(c || '').toUpperCase().trim(); });
  // Normalised matching (ignores spaces / underscores / punctuation / NBSP) so
  // headers like "Alt  item  code" or "Alt-Item Code" still resolve correctly.
  // IMPORTANT: match the DESCRIPTION column first, then EXCLUDE it when finding
  // the alt-code column, so "Alt Item code Description" is never mistaken for it.
  var cCode = _hdrKeyIdx(hdr, ['ITEM CODE', 'ITEMCODE', 'CODE', 'OLD ITEM CODE', 'OLD CODE']);
  var cDate = _hdrKeyIdx(hdr, ['DATE OF DISCONTINUATION', 'DISCONTINUATION DATE', 'DATE']);
  var cRem  = _hdrKeyIdx(hdr, ['REMARKS', 'REMARK', 'STATUS']);
  var cAltD = _hdrKeyIdx(hdr, ['ALT ITEM CODE DESCRIPTION', 'ALT ITEM CODE DESC', 'ALT CODE DESCRIPTION', 'ALTERNATE ITEM CODE DESCRIPTION', 'ALT DESCRIPTION']);
  var cAlt  = _hdrKeyIdx(hdr, ['ALT ITEM CODE', 'ALTERNATE ITEM CODE', 'ALTERNATIVE ITEM CODE', 'ALT CODE', 'ALTERNATE CODE', 'ALT ITEM', 'NEW ITEM CODE', 'NEW CODE', 'REPLACEMENT ITEM CODE', 'REPLACEMENT CODE'], [cAltD]);

  // Positional fallback matching the documented header order
  if (cCode < 0) cCode = 0;
  if (cDate < 0) cDate = 3;
  if (cRem  < 0) cRem  = 4;
  if (cAlt  < 0) cAlt  = 5;
  if (cAltD < 0) cAltD = 6;

  var map = {};
  for (var i = 1; i < rows.length; i++) {
    var r    = rows[i];
    var code = String(r[cCode] || '').toUpperCase().trim();
    if (!code) continue;
    var remarksRaw = String(r[cRem] || '').trim();
    map[code] = {
      remarks:    remarksRaw.toLowerCase(),
      remarksRaw: remarksRaw,
      date:       _fmtDate(r[cDate]),
      altCode:    String(r[cAlt]  || '').toUpperCase().trim(),
      altName:    String(r[cAltD] || '').trim(),
    };
  }
  return map;
}

function _fmtDate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd MMM yyyy');
  }
  return String(v).trim();
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

// Like _hdrIdx but normalises both sides (strips spaces/underscores/punctuation)
// so header quirks don't break detection. `exclude` is a list of column indexes
// to skip (e.g. so the alt-code column never resolves to the alt-code-DESCRIPTION
// column). Returns -1 if none match.
function _hdrKeyIdx(headers, candidates, exclude) {
  var normHdr = headers.map(_crmKey);            // _crmKey: UPPER, [^A-Z0-9] removed
  var skip = {};
  (exclude || []).forEach(function(i){ if (i >= 0) skip[i] = true; });
  for (var i = 0; i < candidates.length; i++) {
    var k = _crmKey(candidates[i]);
    for (var j = 0; j < normHdr.length; j++) {
      if (!skip[j] && normHdr[j] === k) return j;
    }
  }
  return -1;
}

function _numVal(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') {
    if (isNaN(v) || v > 9999999) return 0;  // cap at ₹99,99,999 — larger = product code
    return v;
  }
  var sv = String(v);
  // If the value has 3+ letters it's a product code, not a price (e.g. "56101502SD02842")
  if ((sv.match(/[A-Za-z]/g) || []).length >= 2) return 0;
  // Strip currency symbols, spaces, commas — keep digits and one decimal point
  var s = sv.replace(/[^\d.]/g, '');
  var parts = s.split('.');
  if (parts.length > 2) s = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  var result = parseFloat(s) || 0;
  return result > 9999999 ? 0 : result;  // cap at ₹1 crore
}

function _makeItem(tabName, cat, group, code, desc, cpl, extra) {
  var name = desc || group || cat;
  // Keep the payload lean: the app builds its own search string from
  // cat/item/name and treats a missing stock array as []. Dropping searchName
  // and the empty stock array here noticeably shrinks the JSONP response.
  return {
    code:  code.toUpperCase(),
    name:  name,
    cat:   cat,
    item:  group || '',
    mrp:   cpl,
    cpl:   cpl,
    extra: extra || '',
    sheet: tabName,
  };
}

// ─── ORDERS ───────────────────────────────────────────────────────────────────
// Reads past orders from the CRM tab (one row per item) and groups them into
// one summary per order, identified by ORDER NO + CONTACT NUMBER.
function handleOrders(p) {
  var sh;
  try { sh = _openCRMSheet(); }
  catch (e) { return { ok: false, error: e.message }; }

  var C     = _crmCols(sh);
  var colOf = C.colOf;
  var ncol  = C.header.length;

  // Column indexes (order-level repeated on every row + per-item).
  var cOrderNo = colOf(CRM_H.ORDER_NO);
  var cPhone   = colOf(CRM_H.PHONE);
  var cIntNo   = colOf(CRM_H.INT_NO);
  var cWon     = colOf(CRM_H.WON);
  var cCust    = colOf(CRM_H.CUSTOMER);
  var cDate    = colOf(CRM_H.DATE);
  var cSales   = colOf(CRM_H.SALES);
  var cAmt     = colOf(CRM_H.AMOUNT);
  var cEmail   = colOf(['EMAIL ADDRESS']);
  var cAlt     = colOf(['ALT PHONE','ALTERNATE PHONE','ALT CONTACT NUMBER','ALTERNATE CONTACT NUMBER']);
  var cGst     = colOf(['CUSTOMER GST NO','CUSTOMER GSTIN','GST NO','GSTIN']);
  var cBill    = colOf(['BILLING ADDRESS']);
  var cDelv    = colOf(['DELIVERY ADDRESS']);
  var cFloor   = colOf(['FLOOR']);
  var cLandmk  = colOf(['LANDMARK']);
  var cLiftAv  = colOf(['LIFT AVAILABLE','LIFT AVAILABLE?']);
  var cLiftTy  = colOf(['LIFT TYPE','LIFT TYPES']);
  var cCPName  = colOf(['CONTACT PERSON NAME','CONTACT PERSON']);
  var cCPNum   = colOf(['CONTACT PERSON NUMBER','CONTACT PERSON CONTACT NUMBER']);
  var cCPRem   = colOf(['CONTACT REMARK','CONTACT REMARKS']);
  var cDob     = colOf(['DATE OF BIRTH','DOB']);
  var cAnniv   = colOf(['MARRIAGE ANNIVERSARY','MARRIAGE ANNIVERSARY DATE','ANNIVERSARY']);
  var cAware   = colOf(['HOW DID THEY COME TO KNOW ABOUT OUR SHOWROOM?','HOW DID THEY COME TO KNOW ABOUT OUR SHOWROOM','LEAD SOURCE','SOURCE OF AWARENESS']);
  var cPatt    = colOf(['PURCHASE PATTERN']);
  var cPurpose = colOf(['PURCHASING FOR','PURCHASING FOR:']);
  var cSofaW   = colOf(['SOFA WIDTH']), cSofaH = colOf(['SOFA HEIGHT']), cSofaD = colOf(['SOFA DEPTH']);
  var cWardL   = colOf(['WARDROBE LENGTH']), cWardW = colOf(['WARDROBE WIDTH']), cWardH = colOf(['WARDROBE HEIGHT']);
  var cStairW  = colOf(['STAIRCASE WIDTH','STAIR CASE WIDTH']);
  var cStairL  = colOf(['STAIRCASE LANDING HEIGHT','STAIR CASE LANDING HEIGHT']);
  var cDoorW   = colOf(['CUSTOMER HOUSE ENTRY DOOR WIDTH','ENTRY DOOR WIDTH']);
  var cDoorH   = colOf(['CUSTOMER HOUSE ENTRY DOOR HEIGHT','ENTRY DOOR HEIGHT']);
  // Multi-block measurements — round-tripped as a JSON blob (kept alongside the
  // legacy single-block WARDROBE / STAIRCASE columns above).
  var cMeasJson = colOf(['SITE MEASUREMENTS DATA','MEASUREMENTS DATA','MEASUREMENTS JSON']);
  var cPlanned = colOf(['CUSTOMER DELIVERY DATE (TO BE)']);
  var cInstr   = colOf(['SPECIFIC INSTRUCTION','INSTALLATION NOTE','INSTALL NOTE']);
  var cOFRcpt  = colOf(['ORDER FORM RECEIPT NO','ORDER FORM RECEIPT NO.','ORDER FORM RECEIPT']);
  var cOrdDisc = colOf(['ORDER DISCOUNT %','ADDITIONAL ORDER DISCOUNT %','ORDER DISCOUNT']);
  var cPay     = colOf(['PAYMENT MODE']);
  var cAdv     = colOf(['ADV RECEIVED']);
  var cFollow  = colOf(['FOLLOW-UP DATE','FOLLOW UP DATE','FOLLOWUP DATE']);
  var cOrdType = colOf(['ORDER TYPE','B2C/B2B','ORDER CATEGORY']);
  var cPoRef   = colOf(['REFERENCE ORDER NO.','REFERENCE ORDER NO']);
  var cDelvSt  = colOf(CRM_H.DELIVERY);
  var cMr1n=colOf(['MONEY RECEIPT NO 1','MONEY RECEIPT NO','RECEIPT NO','RECEIPT NO.','RECEIPT NO & DATE']);
  var cMr1d=colOf(['MONEY RECEIPT DATE 1','MONEY RECEIPT DATE','RECEIPT DATE']);
  var cMr2n=colOf(['MONEY RECEIPT NO 2']), cMr2d=colOf(['MONEY RECEIPT DATE 2']);
  var cMr3n=colOf(['MONEY RECEIPT NO 3']), cMr3d=colOf(['MONEY RECEIPT DATE 3']);
  // Per-item columns
  var cICode = colOf(['ITEM CODE','CODE']);
  var cIName = colOf(['PRODUCT NAME']);
  var cICat  = colOf(['CATEGORY']);
  var cIType = colOf(['CATEGORY TYPE']);
  var cIMrp  = colOf(['MRP/UNIT(AS PER PRICE LIST )','MRP/UNIT(AS PER PRICE LIST)','MRP/UNIT','MRP']);
  var cICpl  = colOf(['CPL']);
  var cIQty  = colOf(['QTY']);
  var cIDisc = colOf(['ITEM DISCOUNT %','PER ITEM DISCOUNT %','ITEM DISC %']);
  var cISchm = colOf(['DISC ALLOWED']);

  var lastRow = sh.getLastRow();
  var data    = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, ncol).getValues() : [];

  function cell(r, ci) { return ci >= 0 ? r[ci] : ''; }
  function sval(r, ci) { return String(cell(r, ci) || '').trim(); }

  // Everyone sees every salesperson's orders (filtering happens client-side).
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);

  var map = {}, keys = [];
  for (var i = 0; i < data.length; i++) {
    var r  = data[i];
    var no = sval(r, cOrderNo);
    var ph = sval(r, cPhone);
    if (!no && !ph) continue;
    var key = no + '|' + ph;
    if (!map[key]) {
      // Order discount: a legacy "40%" cell may have been stored as 0.40 — scale
      // any 0<x<1 fraction back to a whole-number percent.
      var odNum = parseFloat(sval(r, cOrdDisc).replace('%', '')) || 0;
      if (odNum > 0 && odNum < 1) odNum = odNum * 100;
      var disc = odNum ? String(odNum) : '';
      map[key] = {
        no: no,
        internalNo: cIntNo >= 0 ? Number(r[cIntNo]) || 0 : 0,
        wons: [],
        customer: sval(r, cCust),
        phone: ph,
        alt: sval(r, cAlt),
        email: sval(r, cEmail),
        gstNumber: sval(r, cGst),
        billing: sval(r, cBill),
        delivery: sval(r, cDelv),
        floor: sval(r, cFloor),
        landmark: sval(r, cLandmk),
        liftAvailable: sval(r, cLiftAv),
        contactPersonName: sval(r, cCPName),
        // liftTypes / wardrobes / rooms are attached after this literal (below).
        contactNumber: sval(r, cCPNum),
        contactRemark: sval(r, cCPRem),
        dob: sval(r, cDob),
        anniversary: sval(r, cAnniv),
        awareness: sval(r, cAware),
        purchasePattern: sval(r, cPatt) ? sval(r, cPatt).split(/\s*,\s*/).filter(String) : [],
        purchasingFor: sval(r, cPurpose),
        sofaWidth: sval(r, cSofaW), sofaHeight: sval(r, cSofaH), sofaDepth: sval(r, cSofaD),
        wardrobeLength: sval(r, cWardL), wardrobeWidth: sval(r, cWardW), wardrobeHeight: sval(r, cWardH),
        staircaseWidth: sval(r, cStairW), staircaseLandingHeight: sval(r, cStairL),
        entryDoorWidth: sval(r, cDoorW), entryDoorHeight: sval(r, cDoorH),
        plannedDly: sval(r, cPlanned),
        installNote: sval(r, cInstr),
        orderFormReceiptNo: sval(r, cOFRcpt),
        orderDiscount: disc,
        paymentMode: sval(r, cPay),
        earnest: cAdv >= 0 ? Number(r[cAdv]) || 0 : 0,
        followUp: sval(r, cFollow),
        salesExec: sval(r, cSales),
        orderType: sval(r, cOrdType) || 'B2C',
        poRef: sval(r, cPoRef),
        deliveryStatus: sval(r, cDelvSt) || 'Pending',
        moneyReceipts: [
          { no: sval(r, cMr1n), date: sval(r, cMr1d) },
          { no: sval(r, cMr2n), date: sval(r, cMr2d) },
          { no: sval(r, cMr3n), date: sval(r, cMr3d) },
        ],
        date: sval(r, cDate),
        amt: 0,
        items: [],
        _row: i,
      };
      map[key].receiptNo = map[key].moneyReceipts[0].no;
      // Multi-block measurements + lift types. Prefer the JSON blob (exact
      // round-trip); otherwise migrate the legacy single-block scalar columns.
      var meas = {};
      if (cMeasJson >= 0) { try { var rawM = sval(r, cMeasJson); if (rawM) meas = JSON.parse(rawM); } catch (e) { meas = {}; } }
      map[key].liftTypes = Array.isArray(meas.liftTypes) ? meas.liftTypes
        : (sval(r, cLiftTy) ? sval(r, cLiftTy).split(/\s*,\s*/).filter(String) : []);
      map[key].rooms = Array.isArray(meas.rooms) ? meas.rooms : [];
      if (Array.isArray(meas.wardrobes) && meas.wardrobes.length) {
        map[key].wardrobes = meas.wardrobes;
      } else {
        var mw = { name:'', length: sval(r, cWardL), width: sval(r, cWardW), height: sval(r, cWardH), staircaseWidth: sval(r, cStairW), staircaseLandingHeight: sval(r, cStairL) };
        map[key].wardrobes = (mw.length || mw.width || mw.height || mw.staircaseWidth || mw.staircaseLandingHeight) ? [mw] : [];
      }
      keys.push(key);
    }
    var m = map[key];
    m.amt += cAmt >= 0 ? (Number(r[cAmt]) || 0) : 0;
    m._row = i;

    var rowWon = sval(r, cWon);
    if (rowWon && m.wons.indexOf(rowWon) === -1) m.wons.push(rowWon);
    var rowDelv = sval(r, cDelvSt);
    if (rowDelv) m.deliveryStatus = rowDelv;

    // Reconstruct this line's item (in sheet order).
    var qty  = cIQty >= 0 ? Number(r[cIQty]) || 0 : 0;
    var mrp  = cIMrp >= 0 ? Number(r[cIMrp]) || 0 : 0;
    var discPct = parseFloat(sval(r, cIDisc).replace('%', '')) || 0;
    if (discPct > 0 && discPct < 1) discPct = discPct * 100;   // legacy "40%" stored as 0.40
    var unitPrice = Math.round(mrp * (1 - discPct / 100));
    var schemeStr = sval(r, cISchm);
    var otherMatch = schemeStr.match(/Other\s*:?\s*([^,]*)/i);
    m.items.push({
      code: sval(r, cICode),
      name: sval(r, cIName),
      cat: sval(r, cICat),
      item: sval(r, cIType),
      qty: qty,
      mrp: mrp,
      cpl: cICpl >= 0 ? Number(r[cICpl]) || 0 : 0,
      disc: discPct ? String(discPct) : '',
      unitPrice: unitPrice,
      total: unitPrice * qty,
      ageing: /ageing/i.test(schemeStr),
      sweetner: /sweetner/i.test(schemeStr),
      other: /other/i.test(schemeStr),
      schemeCode: otherMatch ? (otherMatch[1] || '').trim() : '',
      won: rowWon,
    });
  }

  var orders = keys.map(function(k){ return map[k]; })
    .filter(function(m){
      var dt = _parseCrmDate(m.date);
      if (dt && dt < cutoff) return false;
      return true;
    })
    .sort(function(a,b){ return b._row - a._row; })
    .map(function(m){
      var won = m.wons.join(', ');
      var completed = /installation done/i.test(m.deliveryStatus || '');
      var status = completed ? 'completed'
                 : (won ? 'billed' : 'pending-won');
      m.won = won;
      delete m.wons; delete m._row;
      m.status = status;
      return m;
    });

  return { ok: true, orders: orders };
}

// ─── CRM SHEET HELPERS ───────────────────────────────────────────────────────
// The CRM tab "B2C FRANCHISE APP ORDER DETAILS 26-27" is the ONE source of
// truth: the app writes orders here (one row per item), reads history from
// here, and updates the WON here. Everything is matched to columns BY HEADER
// NAME (column order does not matter); missing columns are simply skipped.
function _crmKey(h) { return String(h || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function _openCRMSheet() {
  var ss = SpreadsheetApp.openById(CRM_SHEET_ID);   // throws if it cannot open
  var sh = ss.getSheetByName(CRM_TAB_NAME);
  if (!sh) { var shts = ss.getSheets(); sh = shts.length ? shts[0] : null; }
  if (!sh) throw new Error('CRM tab not found: ' + CRM_TAB_NAME);
  return sh;
}

// Reads the header row and returns { header, colOf } for by-name lookups.
function _crmCols(sh) {
  var lastCol = Math.max(1, sh.getLastColumn());
  var header  = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = {};
  for (var c = 0; c < header.length; c++) {
    var key = _crmKey(header[c]);
    if (key && idx[key] === undefined) idx[key] = c;
  }
  function colOf(cands) {
    for (var k = 0; k < cands.length; k++) {
      var ci = idx[_crmKey(cands[k])];
      if (ci !== undefined) return ci;
    }
    return -1;
  }
  return { header: header, colOf: colOf };
}

// Header aliases for the columns used to identify / group an order.
var CRM_H = {
  ORDER_NO: ['ORDER NO', 'ORDER NO.'],
  PHONE:    ['CONTACT NUMBER', 'PHONE', 'CONTACT NO'],
  INT_NO:   ['INTERNAL ODER NO', 'INTERNAL ORDER NO'],
  // WON and Godrej SO No are the same thing — the WON lands in the GODREJ SO NO column.
  WON:      ['WON', 'WON NO', 'WON NO.', 'WON NUMBER', 'GODREJ SO NO', 'GODREJ SO NO.', 'GODREJ SO NUMBER'],
  DATE:     ['ORDER DATE'],
  CUSTOMER: ['CUSTOMER NAME'],
  SALES:    ['SALES PERSON'],
  AMOUNT:   ['ORDER AMOUNT (WITH TAX AND AFTER DISC )', 'ORDER AMOUNT (WITH TAX AND AFTER DISC)'],
  DELIVERY: ['DELIVERY REMARKS(DELIVERED/PENDING)', 'DELIVERY REMARKS', 'DELIVERY STATUS'],
};

// Every column the app writes to the CRM tab, as [canonical, ...aliases] groups.
// _ensureCrmColumns() appends the canonical name for any group whose columns are
// all absent, so no field captured in the app is ever dropped on save. This
// MUST stay in sync with the put() calls in _buildOrderRows.
var CRM_APP_COLUMNS = [
  ['SL NO.', 'SL NO'],
  ['INTERNAL ODER NO', 'INTERNAL ORDER NO'],
  ['ORDER DATE'],
  ['ORDER NO', 'ORDER NO.'],
  ['GODREJ SO NO', 'GODREJ SO NO.', 'GODREJ SO NUMBER', 'WON', 'WON NO', 'WON NUMBER'],
  ['ITEM CODE', 'CODE'],
  ['CUSTOMER NAME'],
  ['CONTACT NUMBER', 'PHONE', 'CONTACT NO'],
  ['EMAIL ADDRESS'],
  ['CATEGORY'],
  ['PRODUCT NAME'],
  ['CATEGORY TYPE'],
  ['MRP/UNIT(AS PER PRICE LIST )', 'MRP/UNIT(AS PER PRICE LIST)', 'MRP/UNIT'],
  ['MRP'],
  ['CPL'],
  ['ORDER UNIT PRICE=(AFTER DISC + TAX)', 'ORDER UNIT PRICE'],
  ['QTY'],
  ['GROSS ORDER VALUE(MRP)'],
  ['ORDER AMOUNT (WITH TAX AND AFTER DISC )', 'ORDER AMOUNT (WITH TAX AND AFTER DISC)'],
  ['DISC ALLOWED'],
  ['DISCOUNT GIVEN'],
  ['CROSS CHECK GROSS AMT (Order Value Without Tax)', 'CROSS CHECK GROSS AMT'],
  ['CUSTOMER DELIVERY DATE (TO BE)'],
  ['SALES PERSON'],
  ['ADV RECEIVED'],
  ['REFERENCE ORDER NO.', 'REFERENCE ORDER NO'],
  ['DELIVERY REMARKS(DELIVERED/PENDING)', 'DELIVERY REMARKS'],
  ['POSTED BY'],
  ['PINELAB / BAJAJ', 'PINELAB/BAJAJ'],
  ['DATE OF BIRTH', 'DOB'],
  ['MARRIAGE ANNIVERSARY', 'MARRIAGE ANNIVERSARY DATE', 'ANNIVERSARY'],
  ['HOW DID THEY COME TO KNOW ABOUT OUR SHOWROOM?', 'HOW DID THEY COME TO KNOW ABOUT OUR SHOWROOM', 'SOURCE OF AWARENESS'],
  ['PURCHASE PATTERN'],
  ['PURCHASING FOR', 'PURCHASING FOR:'],
  ['SOFA WIDTH'], ['SOFA HEIGHT'], ['SOFA DEPTH'],
  ['WARDROBE LENGTH'], ['WARDROBE WIDTH'], ['WARDROBE HEIGHT'],
  ['STAIRCASE WIDTH', 'STAIR CASE WIDTH'],
  ['STAIRCASE LANDING HEIGHT', 'STAIR CASE LANDING HEIGHT'],
  ['CUSTOMER HOUSE ENTRY DOOR WIDTH', 'ENTRY DOOR WIDTH'],
  ['CUSTOMER HOUSE ENTRY DOOR HEIGHT', 'ENTRY DOOR HEIGHT'],
  ['ORDER TYPE', 'B2C/B2B', 'ORDER CATEGORY'],
  ['LEAD SOURCE'],
  ['CUSTOMER GST NO', 'CUSTOMER GSTIN', 'GST NO', 'GSTIN'],
  ['ALT PHONE', 'ALTERNATE PHONE', 'ALT CONTACT NUMBER', 'ALTERNATE CONTACT NUMBER'],
  ['BILLING ADDRESS'],
  ['DELIVERY ADDRESS'],
  ['FLOOR'],
  ['LANDMARK'],
  ['LIFT AVAILABLE', 'LIFT AVAILABLE?'],
  ['CONTACT PERSON NAME', 'CONTACT PERSON'],
  ['CONTACT PERSON NUMBER', 'CONTACT PERSON CONTACT NUMBER'],
  ['CONTACT REMARK', 'CONTACT REMARKS'],
  ['ORDER DISCOUNT %', 'ADDITIONAL ORDER DISCOUNT %', 'ORDER DISCOUNT'],
  ['ITEM DISCOUNT %', 'PER ITEM DISCOUNT %', 'ITEM DISC %'],
  ['PAYMENT MODE'],
  ['FOLLOW-UP DATE', 'FOLLOW UP DATE', 'FOLLOWUP DATE'],
  ['SPECIFIC INSTRUCTION', 'INSTALLATION NOTE', 'INSTALL NOTE'],
  ['MONEY RECEIPT NO 1', 'MONEY RECEIPT NO', 'RECEIPT NO', 'RECEIPT NO.', 'RECEIPT NO & DATE'],
  ['MONEY RECEIPT DATE 1', 'MONEY RECEIPT DATE', 'RECEIPT DATE'],
  ['MONEY RECEIPT NO 2'],
  ['MONEY RECEIPT DATE 2'],
  ['MONEY RECEIPT NO 3'],
  ['MONEY RECEIPT DATE 3'],
  ['DELIVERY STATUS'],
  ['ORDER FORM RECEIPT NO', 'ORDER FORM RECEIPT NO.', 'ORDER FORM RECEIPT'],
];

// Appends any missing CRM columns (by header name) to the end of the header row
// so every app field has a home. Returns the list of column names that were added.
function _ensureCrmColumns(sh) {
  var lastCol = Math.max(1, sh.getLastColumn());
  var header  = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var have = {};
  for (var c = 0; c < header.length; c++) { var k = _crmKey(header[c]); if (k) have[k] = true; }

  var toAdd = [];
  for (var i = 0; i < CRM_APP_COLUMNS.length; i++) {
    var group = CRM_APP_COLUMNS[i], exists = false;
    for (var j = 0; j < group.length; j++) { if (have[_crmKey(group[j])]) { exists = true; break; } }
    if (!exists) { toAdd.push(group[0]); have[_crmKey(group[0])] = true; }
  }
  if (toAdd.length) {
    sh.getRange(1, header.length + 1, 1, toAdd.length).setValues([toAdd]);
    try { sh.getRange(1, 1, 1, header.length + toAdd.length).setFontWeight('bold'); } catch (e) {}
  }
  return toAdd;
}

// Run manually from the Apps Script editor to backfill all app columns at once.
function ensureCrmColumns() {
  var sh = _openCRMSheet();
  var added = _ensureCrmColumns(sh);
  Logger.log(added.length ? ('Added columns: ' + added.join(' | ')) : 'All app columns already present.');
  return added;
}

// Parse a "dd.mm.yy" / "dd.mm.yyyy" ORDER DATE string → Date (or null).
function _parseCrmDate(s) {
  s = String(s || '').trim();
  if (!s) return null;
  var m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  if (!m) { var d0 = new Date(s); return isNaN(d0.getTime()) ? null : d0; }
  var d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (y < 100) y += 2000;
  var dt = new Date(y, mo - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

// ─── SAVE ORDER ───────────────────────────────────────────────────────────────
// Writes the order to the CRM tab ONLY (no Orders_Master). One row per item.
// An order is identified by ORDER NO + CONTACT NUMBER (+ WON). Re-saving an
// order (or adding items) replaces its existing rows instead of duplicating.
function handleSaveOrder(o) {
  if (!o) throw new Error('No order data provided.');
  var res = _writeOrderToCRM(o);
  if (!res.ok) throw new Error(res.error || 'Could not write the order to the CRM sheet.');
  return { ok: true, orderNo: res.orderNo, internalNo: res.internalNo, crmRows: res.rows };
}

function _writeOrderToCRM(o) {
  var sh;
  try { sh = _openCRMSheet(); }
  catch (e) { return { ok: false, error: e.message }; }

  // Make sure every column the app captures exists before writing (adds any
  // missing ones to the sheet), so no field is silently dropped.
  try { _ensureCrmColumns(sh); } catch (e) {}

  var C      = _crmCols(sh);
  var colOf  = C.colOf;
  var header = C.header;
  var ncol   = header.length;
  if (ncol < 1) return { ok: false, error: 'CRM sheet has no header row.' };

  var cOrderNo = colOf(CRM_H.ORDER_NO);
  var cPhone   = colOf(CRM_H.PHONE);
  var cIntNo   = colOf(CRM_H.INT_NO);
  var cWon     = colOf(CRM_H.WON);
  var cDate    = colOf(CRM_H.DATE);

  var lastRow = sh.getLastRow();
  var data    = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, ncol).getValues() : [];

  var incomingOrder  = String(o.no || '').trim();
  var incomingInt    = Number(o.internalNo) || 0;

  // Find this order's existing rows so a re-save REPLACES them instead of adding
  // duplicates. Match by the stable INTERNAL order number first, then by ORDER
  // NO — never by phone, so editing the customer's phone still updates the same
  // order rather than creating a new entry.
  var matchRows = [], existingWon = '', existingDate = '';
  if ((incomingInt || incomingOrder) && (cIntNo >= 0 || cOrderNo >= 0)) {
    for (var i = 0; i < data.length; i++) {
      var rowInt   = cIntNo   >= 0 ? Number(data[i][cIntNo]) || 0 : 0;
      var rowOrder = cOrderNo >= 0 ? String(data[i][cOrderNo] || '').trim() : '';
      var intMatch   = incomingInt   && rowInt   === incomingInt;
      var orderMatch = incomingOrder && rowOrder === incomingOrder;
      if (!intMatch && !orderMatch) continue;
      matchRows.push(i);
      if (cWon  >= 0 && !existingWon)  existingWon  = String(data[i][cWon]  || '').trim();
      if (cDate >= 0 && !existingDate) existingDate = String(data[i][cDate] || '').trim();
    }
  }

  // Identity: reuse the matched rows' internal number / order number so the order
  // keeps the same identifiers across edits; only a brand-new order gets fresh ones.
  var matchedOrderNo = '', matchedInt = 0;
  if (matchRows.length) {
    if (cOrderNo >= 0) matchedOrderNo = String(data[matchRows[0]][cOrderNo] || '').trim();
    if (cIntNo   >= 0) matchedInt     = Number(data[matchRows[0]][cIntNo]) || 0;
  }
  var internalNo = incomingInt || matchedInt || 0;
  if (!internalNo) {
    var maxInt = 0;
    if (cIntNo >= 0) for (var j = 0; j < data.length; j++) {
      var v = Number(data[j][cIntNo]) || 0; if (v > maxInt) maxInt = v;
    }
    internalNo = maxInt + 1;
  }
  var orderNo = incomingOrder || matchedOrderNo || '';
  if (!orderNo) {
    var receiptNo = String(o.receiptNo || '').trim();
    orderNo = receiptNo ? (internalNo + '/' + receiptNo) : String(internalNo);
  }

  var now          = new Date();
  var todayStr     = now.toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'2-digit' }).replace(/\//g,'.');
  var orderDateStr = String(o.date || '') || existingDate || todayStr;   // keep original date on re-save
  var wonToWrite   = String(o.won || '').trim() || existingWon || '';    // preserve a WON already on the sheet

  // Replace: delete the order's old rows (bottom-up) so item count can change.
  if (matchRows.length) {
    var sheetRows = matchRows.map(function(x){ return x + 2; }).sort(function(a,b){ return b - a; });
    for (var d = 0; d < sheetRows.length; d++) sh.deleteRow(sheetRows[d]);
  }

  var built = _buildOrderRows(o, header, colOf, orderNo, internalNo, orderDateStr, wonToWrite, sh.getLastRow());
  if (!built.length) return { ok: true, orderNo: orderNo, internalNo: internalNo, rows: 0 };
  sh.getRange(sh.getLastRow() + 1, 1, built.length, ncol).setValues(built);
  return { ok: true, orderNo: orderNo, internalNo: internalNo, rows: built.length };
}

// Builds the per-item rows for one order (values matched to columns by header).
function _buildOrderRows(o, header, colOf, orderNo, internalNo, orderDateStr, won, slBaseRow) {
  var items = o.items || [];
  if (!items.length) return [];
  var orderDiscPct = Math.max(0, parseFloat(o.orderDiscount) || 0) / 100;
  var out = [];

  for (var i = 0; i < items.length; i++) {
    var it   = items[i];
    var qty  = Number(it.qty) || 0;
    var unitMrp = Number(it.mrp) || Number(it.cpl) || 0;
    var unitCpl = Number(it.cpl) || Number(it.mrp) || 0;
    var unitItem = (it.unitPrice !== undefined && it.unitPrice !== '') ? (Number(it.unitPrice) || 0) : unitMrp;
    var lineNet  = Math.round(unitItem * qty * (1 - orderDiscPct));    // after item + order discount, before tax
    var unitAll  = qty > 0 ? (lineNet / qty) : unitItem;
    var grossMrp = Math.round(unitMrp * qty);

    var schemes = [];
    if (it.ageing)   schemes.push('Ageing');
    if (it.sweetner) schemes.push('Sweetner');
    if (it.other)    schemes.push(it.schemeCode ? ('Other: ' + it.schemeCode) : 'Other');

    var row = [];
    for (var z = 0; z < header.length; z++) row.push('');
    function put(cands, value) { var ci = colOf(cands); if (ci >= 0) row[ci] = value; }

    put(['SL NO.', 'SL NO'], slBaseRow + i);
    put(CRM_H.INT_NO, internalNo);
    put(CRM_H.DATE, orderDateStr);
    put(CRM_H.ORDER_NO, orderNo);
    // WON == Godrej SO No. Per-item WON (it.won) wins so a single order can carry
    // several SO numbers across its items; falls back to the order-level WON.
    put(CRM_H.WON, String(it.won || won || ''));
    put(['ITEM CODE', 'CODE'], it.code || '');
    put(CRM_H.CUSTOMER, o.customer || '');
    put(CRM_H.PHONE, o.phone || '');
    put(['EMAIL ADDRESS'], o.email || '');
    put(['CATEGORY'], it.cat || '');
    put(['PRODUCT NAME'], it.name || '');
    put(['CATEGORY TYPE'], it.item || '');
    put(['MRP/UNIT(AS PER PRICE LIST )', 'MRP/UNIT(AS PER PRICE LIST)', 'MRP/UNIT'], unitMrp);
    put(['MRP'], unitMrp);
    put(['CPL'], unitCpl);
    put(['ORDER UNIT PRICE=(AFTER DISC + TAX)', 'ORDER UNIT PRICE'], Math.round(unitAll * 1.18));
    put(['QTY'], qty);
    put(['GROSS ORDER VALUE(MRP)'], grossMrp);
    put(CRM_H.AMOUNT, Math.round(lineNet * 1.18));
    put(['DISC ALLOWED'], schemes.join(', '));
    put(['DISCOUNT GIVEN'], grossMrp - lineNet);   // total rupee discount (item + order share), pre-tax
    put(['CROSS CHECK GROSS AMT (Order Value Without Tax)', 'CROSS CHECK GROSS AMT'], lineNet);
    put(['CUSTOMER DELIVERY DATE (TO BE)'], o.plannedDly || '');
    put(CRM_H.SALES, o.salesExec || '');
    if (i === 0) put(['ADV RECEIVED'], Number(o.earnest) || 0);   // order-level — first row only
    put(['REFERENCE ORDER NO.', 'REFERENCE ORDER NO'], o.poRef || '');
    put(['DELIVERY REMARKS(DELIVERED/PENDING)', 'DELIVERY REMARKS'], o.deliveryStatus || 'Pending');
    put(['POSTED BY'], o.salesExec || '');
    put(['PINELAB / BAJAJ', 'PINELAB/BAJAJ'], o.paymentMode || '');

    // ── Customer profiling + site measurements (order-level; not on the PDF
    //    except the sofa measurements). Written by header name, so add these
    //    columns to the CRM sheet to capture them; missing columns are skipped.
    put(['DATE OF BIRTH', 'DOB'], o.dob || '');
    put(['MARRIAGE ANNIVERSARY', 'MARRIAGE ANNIVERSARY DATE', 'ANNIVERSARY'], o.anniversary || '');
    put(['HOW DID THEY COME TO KNOW ABOUT OUR SHOWROOM?', 'HOW DID THEY COME TO KNOW ABOUT OUR SHOWROOM', 'HOW DID THEY COME TO KNOW', 'SOURCE OF AWARENESS'], o.awareness || '');
    put(['PURCHASE PATTERN'], Array.isArray(o.purchasePattern) ? o.purchasePattern.join(', ') : (o.purchasePattern || ''));
    put(['PURCHASING FOR', 'PURCHASING FOR:'], o.purchasingFor || '');
    put(['SOFA WIDTH'], o.sofaWidth || '');
    put(['SOFA HEIGHT'], o.sofaHeight || '');
    put(['SOFA DEPTH'], o.sofaDepth || '');
    put(['WARDROBE LENGTH'], o.wardrobeLength || '');
    put(['WARDROBE WIDTH'], o.wardrobeWidth || '');
    put(['WARDROBE HEIGHT'], o.wardrobeHeight || '');
    put(['STAIRCASE WIDTH', 'STAIR CASE WIDTH'], o.staircaseWidth || '');
    put(['STAIRCASE LANDING HEIGHT', 'STAIR CASE LANDING HEIGHT'], o.staircaseLandingHeight || '');
    put(['CUSTOMER HOUSE ENTRY DOOR WIDTH', 'ENTRY DOOR WIDTH'], o.entryDoorWidth || '');
    put(['CUSTOMER HOUSE ENTRY DOOR HEIGHT', 'ENTRY DOOR HEIGHT'], o.entryDoorHeight || '');
    // ── Multi-block measurements: lift type(s), one measurement block per
    //    modular furniture, and any number of rooms. Written as a human-readable
    //    summary + a JSON blob (for exact round-trip on reopen). Add these columns
    //    to the CRM sheet to capture them; missing columns are skipped.
    var wbs = Array.isArray(o.wardrobes) ? o.wardrobes : [];
    var rms = Array.isArray(o.rooms) ? o.rooms : [];
    var lts = Array.isArray(o.liftTypes) ? o.liftTypes : [];
    put(['LIFT TYPE', 'LIFT TYPES'], lts.join(', '));
    var wbSummary = wbs.map(function (w, wi) {
      var nm = w.name ? (' ' + w.name) : '';
      return 'Furniture ' + (wi + 1) + nm + ' (LxWxH): ' + [w.length, w.width, w.height].map(function (v) { return v || '-'; }).join(' x ')
        + '; Staircase (W/Landing H): ' + [w.staircaseWidth, w.staircaseLandingHeight].map(function (v) { return v || '-'; }).join(' / ');
    }).join('  |  ');
    put(['MODULAR FURNITURE MEASUREMENTS', 'MODULAR MEASUREMENTS'], wbSummary);
    var rmSummary = rms.map(function (r2, ri) {
      return (r2.name || ('Room ' + (ri + 1))) + ' (WxHxD): ' + [r2.width, r2.height, r2.depth].map(function (v) { return v || '-'; }).join(' x ');
    }).join('  |  ');
    put(['ROOM MEASUREMENTS', 'ROOMS MEASUREMENTS'], rmSummary);
    if (wbs.length || rms.length || lts.length)
      put(['SITE MEASUREMENTS DATA', 'MEASUREMENTS DATA', 'MEASUREMENTS JSON'], JSON.stringify({ wardrobes: wbs, rooms: rms, liftTypes: lts }));

    // ── Extra fields captured by the app (write only if the column exists).
    //    Add these headers to the CRM sheet to capture them.
    put(['ORDER TYPE', 'B2C/B2B', 'ORDER CATEGORY'], o.orderType || 'B2C');
    put(['LEAD SOURCE'], o.awareness || '');            // renamed field — alias of "How did they come to know…"
    put(['CUSTOMER GST NO', 'CUSTOMER GSTIN', 'GST NO', 'GSTIN'], o.gstNumber || '');
    put(['ALT PHONE', 'ALTERNATE PHONE', 'ALT CONTACT NUMBER', 'ALTERNATE CONTACT NUMBER'], o.alt || '');
    put(['BILLING ADDRESS'], o.billing || '');
    put(['DELIVERY ADDRESS'], o.delivery || '');
    put(['FLOOR'], o.floor || '');
    put(['LANDMARK'], o.landmark || '');
    put(['LIFT AVAILABLE', 'LIFT AVAILABLE?'], o.liftAvailable || '');
    // Contact details (order bought on behalf of someone else)
    put(['CONTACT PERSON NAME', 'CONTACT PERSON'], o.contactPersonName || '');
    put(['CONTACT PERSON NUMBER', 'CONTACT PERSON CONTACT NUMBER'], o.contactNumber || '');
    put(['CONTACT REMARK', 'CONTACT REMARKS'], o.contactRemark || '');
    // Write discounts as plain whole-number percents (40, not "40%"): a "%"
    // string makes Google Sheets store the underlying fraction (0.40), which
    // then reads back as 0.4% and mis-scales the discount on reopen.
    put(['ORDER DISCOUNT %', 'ADDITIONAL ORDER DISCOUNT %', 'ORDER DISCOUNT'], (parseFloat(o.orderDiscount) || 0) || '');
    put(['ITEM DISCOUNT %', 'PER ITEM DISCOUNT %', 'ITEM DISC %'], (parseFloat(it.disc) || 0) || '');
    put(['PAYMENT MODE'], o.paymentMode || '');
    put(['FOLLOW-UP DATE', 'FOLLOW UP DATE', 'FOLLOWUP DATE'], o.followUp || '');
    put(['SPECIFIC INSTRUCTION', 'INSTALLATION NOTE', 'INSTALL NOTE'], o.installNote || '');
    // Money receipts — up to 3 no + date pairs (updatable over time)
    var mrs = Array.isArray(o.moneyReceipts) ? o.moneyReceipts : [];
    var mr1 = mrs[0] || { no: o.receiptNo || '', date: '' };
    var mr2 = mrs[1] || { no: '', date: '' };
    var mr3 = mrs[2] || { no: '', date: '' };
    put(['MONEY RECEIPT NO 1', 'MONEY RECEIPT NO', 'RECEIPT NO', 'RECEIPT NO.', 'RECEIPT NO & DATE'], mr1.no || '');
    put(['MONEY RECEIPT DATE 1', 'MONEY RECEIPT DATE', 'RECEIPT DATE'], mr1.date || '');
    put(['MONEY RECEIPT NO 2'], mr2.no || '');
    put(['MONEY RECEIPT DATE 2'], mr2.date || '');
    put(['MONEY RECEIPT NO 3'], mr3.no || '');
    put(['MONEY RECEIPT DATE 3'], mr3.date || '');
    put(['DELIVERY STATUS'], o.deliveryStatus || 'Pending');
    put(['ORDER FORM RECEIPT NO','ORDER FORM RECEIPT NO.','ORDER FORM RECEIPT'], o.orderFormReceiptNo || '');

    out.push(row);
  }
  return out;
}

// ─── UPDATE WON ───────────────────────────────────────────────────────────────
// Writes the WON onto every CRM row of the order (matched by ORDER NO or
// INTERNAL ODER NO). WON == Godrej SO No, so it lands in the "GODREJ SO NO" column
// (or a "WON" column if one exists).
function handleUpdateWON(body) {
  var orderNo    = String(body.orderNo    || '').trim();
  var internalNo = Number(body.internalNo || 0);
  var won        = String(body.won        || '').trim().toUpperCase();
  var updatedBy  = String(body.updatedBy  || '');
  // Optional: 0-based indexes (in sheet/item order) of the items this WON
  // applies to. Omitted / empty → apply to every item of the order.
  var itemIndexes = Array.isArray(body.itemIndexes)
    ? body.itemIndexes.map(function(n){ return Number(n); }).filter(function(n){ return !isNaN(n); })
    : null;
  if (!won) return { ok: false, error: 'WON number is required.' };

  var sh;
  try { sh = _openCRMSheet(); }
  catch (e) { return { ok: false, error: e.message }; }

  var C     = _crmCols(sh);
  var colOf = C.colOf;
  var ncol  = C.header.length;

  var cOrderNo = colOf(CRM_H.ORDER_NO);
  var cIntNo   = colOf(CRM_H.INT_NO);
  var cWon     = colOf(CRM_H.WON);
  if (cWon < 0) return { ok: false, error: 'No "Godrej SO No" (WON) column found in the CRM sheet.' };

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'Order not found: ' + orderNo };
  var data = sh.getRange(2, 1, lastRow - 1, ncol).getValues();

  // Collect the order's rows in sheet order.
  var matchRows = [];
  for (var i = 0; i < data.length; i++) {
    var matchOrder = cOrderNo >= 0 && orderNo    && String(data[i][cOrderNo] || '').trim() === orderNo;
    var matchInt   = cIntNo   >= 0 && internalNo && Number(data[i][cIntNo]) === internalNo;
    if (matchOrder || matchInt) matchRows.push(i);
  }
  if (!matchRows.length) return { ok: false, error: 'Order not found: ' + orderNo };

  var updated = 0;
  for (var k = 0; k < matchRows.length; k++) {
    // When a subset was requested, only stamp the selected item positions.
    if (itemIndexes && itemIndexes.length && itemIndexes.indexOf(k) === -1) continue;
    sh.getRange(matchRows[k] + 2, cWon + 1).setValue(won);
    updated++;
  }
  if (!updated) return { ok: false, error: 'No matching items to update for order: ' + orderNo };
  _appendLog(updatedBy, orderNo, 'UPDATE_WON', 'WON: ' + won + (itemIndexes ? ' items:' + itemIndexes.join(',') : ''));
  return { ok: true, rows: updated };
}

// ─── UPDATE DELIVERY STATUS ────────────────────────────────────────────────────
// Sets the "DELIVERY REMARKS(DELIVERED/PENDING)" column for every row of an order.
// Called by the salesperson once an order has physically been delivered.
function handleUpdateDelivery(body) {
  var orderNo    = String(body.orderNo    || '').trim();
  var internalNo = Number(body.internalNo || 0);
  var status     = String(body.deliveryStatus || body.status || '').trim();
  var updatedBy  = String(body.updatedBy  || '');
  if (!status) return { ok: false, error: 'Delivery status is required.' };

  var sh;
  try { sh = _openCRMSheet(); }
  catch (e) { return { ok: false, error: e.message }; }

  var C     = _crmCols(sh);
  var colOf = C.colOf;
  var ncol  = C.header.length;

  var cOrderNo = colOf(CRM_H.ORDER_NO);
  var cIntNo   = colOf(CRM_H.INT_NO);
  var cDeliv   = colOf(CRM_H.DELIVERY);
  if (cDeliv < 0) return { ok: false, error: 'No "Delivery Remarks" column found in the CRM sheet.' };

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'Order not found: ' + orderNo };
  var data = sh.getRange(2, 1, lastRow - 1, ncol).getValues();

  var updated = 0;
  for (var i = 0; i < data.length; i++) {
    var matchOrder = cOrderNo >= 0 && orderNo    && String(data[i][cOrderNo] || '').trim() === orderNo;
    var matchInt   = cIntNo   >= 0 && internalNo && Number(data[i][cIntNo]) === internalNo;
    if (matchOrder || matchInt) {
      sh.getRange(i + 2, cDeliv + 1).setValue(status);
      updated++;
    }
  }
  if (!updated) return { ok: false, error: 'Order not found: ' + orderNo };
  _appendLog(updatedBy, orderNo, 'UPDATE_DELIVERY', 'Delivery: ' + status);
  return { ok: true, rows: updated };
}

// ─── DELETE ORDER (admin only) ────────────────────────────────────────────────
// Removes every CRM row belonging to an order. Guarded server-side: the calling
// user's role is looked up from the same creds/staff sheets used for login, and
// the delete only proceeds when that role is 'admin'.
function handleDeleteOrder(body) {
  var orderNo    = String(body.orderNo || '').trim();
  var internalNo = Number(body.internalNo || 0);
  var by         = String(body.by || body.updatedBy || '').trim();

  if (_lookupRole(by) !== 'admin') {
    return { ok: false, error: 'Only an admin can delete orders.' };
  }
  if (!orderNo && !internalNo) return { ok: false, error: 'Order identifier is required.' };

  var sh;
  try { sh = _openCRMSheet(); }
  catch (e) { return { ok: false, error: e.message }; }

  var C     = _crmCols(sh);
  var colOf = C.colOf;
  var ncol  = C.header.length;

  var cOrderNo = colOf(CRM_H.ORDER_NO);
  var cIntNo   = colOf(CRM_H.INT_NO);

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: false, error: 'Order not found: ' + orderNo };
  var data = sh.getRange(2, 1, lastRow - 1, ncol).getValues();

  // Collect matching sheet rows, then delete bottom-up so indexes stay valid.
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    var matchOrder = cOrderNo >= 0 && orderNo    && String(data[i][cOrderNo] || '').trim() === orderNo;
    var matchInt   = cIntNo   >= 0 && internalNo && Number(data[i][cIntNo]) === internalNo;
    if (matchOrder || matchInt) rows.push(i + 2);
  }
  if (!rows.length) return { ok: false, error: 'Order not found: ' + orderNo };
  for (var j = rows.length - 1; j >= 0; j--) sh.deleteRow(rows[j]);

  _appendLog(by, orderNo, 'DELETE_ORDER', 'Deleted ' + rows.length + ' row(s)');
  return { ok: true, rows: rows.length };
}

// Look up a user's role by username from the same sheets login uses, WITHOUT a
// password (used to authorize server-side actions). Returns a normalised role
// ('sales' | 'manager' | 'admin'); defaults to 'sales' when not found.
function _lookupRole(username) {
  username = String(username || '').toLowerCase().trim();
  if (!username) return 'sales';

  function scanByHeaders(sh) {
    var rows = sh.getDataRange().getValues();
    if (rows.length < 2) return null;
    var hdr   = rows[0].map(function(c){ return String(c || '').toLowerCase().trim(); });
    var cUser = _hdrIdx(hdr, ['username', 'user name', 'user']);
    var cRole = _hdrIdx(hdr, ['role', 'user role', 'access', 'access level', 'designation']);
    if (cUser < 0) cUser = 1;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][cUser] || '').toLowerCase().trim() === username) {
        var roleVal = (cRole >= 0 && cRole < rows[i].length) ? String(rows[i][cRole] || '').trim() : '';
        return _normRole(roleVal);
      }
    }
    return null;
  }

  try {
    var opsSS = _openOPS();
    if (opsSS) {
      var credsSh = opsSS.getSheetByName('APP_ORDERING_CREDS');
      if (credsSh) { var r = scanByHeaders(credsSh); if (r !== null) return r; }
      var staffSh = opsSS.getSheetByName('Staff');
      if (staffSh) {
        var rowsS = staffSh.getDataRange().getValues().slice(1);
        for (var i = 0; i < rowsS.length; i++) {
          if (String(rowsS[i][COL_USR.USERNAME] || '').toLowerCase().trim() === username) {
            return _normRole(rowsS[i][COL_USR.ROLE]);
          }
        }
      }
    }
  } catch (e) {}

  try {
    var masterStaff = _getSheet('Staff');
    if (masterStaff) {
      var rowsM = masterStaff.getDataRange().getValues().slice(1);
      for (var k = 0; k < rowsM.length; k++) {
        if (String(rowsM[k][COL_USR.USERNAME] || '').toLowerCase().trim() === username) {
          return _normRole(rowsM[k][COL_USR.ROLE]);
        }
      }
    }
  } catch (e) {}

  return 'sales';
}

// ─── CHANGE LOG ───────────────────────────────────────────────────────────────
// Logger-only now (the app no longer keeps an Orders_Master / Change_Log sheet —
// the CRM tab is the single source of truth).
function _appendLog(user, orderNo, action, detail) {
  try { Logger.log([new Date(), user, orderNo, action, detail].join(' | ')); } catch(e) {}
}

// ─── DEBUG — fast: reads only header row + row count per listed tab ────────────
function handleDebugPriceList() {
  var opsSS = _openOPS();
  if (!opsSS) return { ok: false, error: 'Cannot open OPS sheet: ' + OPS_SHEET_ID };

  var priceCfg = _getPriceListConfig(opsSS);
  var allTabs  = opsSS.getSheets().map(function(s){ return s.getName(); });
  var tabInfo  = {};

  // Mirror handlePriceList: with no config sheet, auto-scan all non-skip tabs
  var usedFallback = false;
  if (priceCfg.length === 0) {
    usedFallback = true;
    priceCfg = allTabs
      .filter(function(n){ return !_inSkipList(n); })
      .map(function(n){ return { tab: n, cat: n }; });
  }

  priceCfg.forEach(function(cfg) {
    var sh = opsSS.getSheetByName(cfg.tab);
    if (!sh) { tabInfo[cfg.tab] = { error: 'Tab not found', cat: cfg.cat }; return; }
    // Read only first 2 rows to stay fast
    var last = sh.getLastRow();
    var lastC = sh.getLastColumn();
    var headerRange = sh.getRange(1, 1, Math.min(2, last), Math.min(lastC, 10));
    var hdrVals = headerRange.getValues();
    var header  = hdrVals[0] ? hdrVals[0].map(String) : [];
    var sample  = hdrVals[1] ? hdrVals[1].map(String) : [];
    tabInfo[cfg.tab] = {
      cat:       cfg.cat,
      totalRows: last,
      header:    header,
      sample:    sample,
    };
  });

  return {
    ok:          true,
    scriptVersion: SCRIPT_VERSION,
    mode:        usedFallback ? 'auto-scan' : 'config',
    opsName:     opsSS.getName(),
    allTabs:     allTabs,
    priceConfig: priceCfg,
    tabInfo:     tabInfo,
    discontinued: _debugDiscontinued(opsSS),
  };
}

// Diagnostic: how the "Discontinued Products" tab is being read, and which
// column is used as the Alt item code (surfaced in the Settings → Debug panel).
function _debugDiscontinued(opsSS) {
  try {
    var sh = opsSS.getSheetByName('Discontinued Products');
    if (!sh) return { found: false };
    var rows = sh.getDataRange().getValues();
    if (rows.length < 2) return { found: true, rows: 0 };
    var hdr   = rows[0].map(function(c){ return String(c || '').toUpperCase().trim(); });
    var cCode = _hdrKeyIdx(hdr, ['ITEM CODE', 'ITEMCODE', 'CODE', 'OLD ITEM CODE', 'OLD CODE']); if (cCode < 0) cCode = 0;
    var cRem  = _hdrKeyIdx(hdr, ['REMARKS', 'REMARK', 'STATUS']); if (cRem < 0) cRem = 4;
    var cAltD = _hdrKeyIdx(hdr, ['ALT ITEM CODE DESCRIPTION', 'ALT ITEM CODE DESC', 'ALT CODE DESCRIPTION', 'ALTERNATE ITEM CODE DESCRIPTION', 'ALT DESCRIPTION']);
    var cAlt  = _hdrKeyIdx(hdr, ['ALT ITEM CODE', 'ALTERNATE ITEM CODE', 'ALTERNATIVE ITEM CODE', 'ALT CODE', 'ALTERNATE CODE', 'ALT ITEM', 'NEW ITEM CODE', 'NEW CODE', 'REPLACEMENT ITEM CODE', 'REPLACEMENT CODE'], [cAltD]); if (cAlt < 0) cAlt = 5;
    var withAlt = 0, samples = [];
    for (var i = 1; i < rows.length; i++) {
      var code = String(rows[i][cCode] || '').trim();
      var alt  = String(rows[i][cAlt]  || '').trim();
      if (!code) continue;
      if (alt) {
        withAlt++;
        if (samples.length < 6) samples.push({ code: code, alt: alt, remarks: String(rows[i][cRem] || '').trim() });
      }
    }
    return { found: true, rows: rows.length - 1, header: hdr, altColIndex: cAlt, altColHeader: hdr[cAlt] || '', rowsWithAlt: withAlt, samples: samples };
  } catch (e) {
    return { found: false, error: e.message };
  }
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
