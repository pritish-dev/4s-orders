// ============================================================
//  4S Interiors — Google Apps Script backend  (Code.gs)
//  Complete file — copy and paste this into your project
// ============================================================
//
//  FIRST-TIME SETUP:
//   1. Go to script.google.com → your 4S Orders project (or create new)
//   2. Replace the entire Code.gs with this file
//   3. Click Run → ensureSheets   (creates the master spreadsheet + all tabs)
//      Grant permissions when prompted
//   4. Deploy → New deployment → Web App
//      Execute as : Me
//      Who has access : Anyone
//   5. Copy the deployment URL → paste in the app Settings screen
//
//  UPDATING (when you add new features):
//   1. Edit this file in Apps Script editor
//   2. Deploy → Manage deployments → select existing → New version → Deploy
//   3. URL stays the same — no change needed in the app
//
// ============================================================

// ── Sheet column indexes (0-based) ─────────────────────────────────────────
// Stock_Master columns:
//   A=Code  B=Name  C=Category  D=CPL  E=MRP
//   F=KB_Qty  G=B2CB_Qty  H=PTA_Qty  I=CTC_Qty
var COL_ST = { CODE:0, NAME:1, CAT:2, CPL:3, MRP:4, KB:5, B2CB:6, PTA:7, CTC:8 };

// Orders_Master columns:
//   A=Timestamp  B=InternalNo  C=OrderNo  D=WON  E=Status
//   F=Customer   G=Phone  H=Alt  I=Email
//   J=Billing    K=Delivery  L=LiftAvailable  M=CustomerCode
//   N=PORef      O=Source  P=DiscountCode  Q=PlannedDly
//   R=InstallNote  S=PaymentMode  T=Earnest  U=ReceiptNo
//   V=FollowUp   W=SalesExec  X=OrderType  Y=Items_JSON
//   Z=Subtotal   AA=CGST  AB=SGST  AC=TotalWithTax  AD=Date
var COL_ORD = {
  TS:0, INTERNAL_NO:1, ORDER_NO:2, WON:3, STATUS:4,
  CUSTOMER:5, PHONE:6, ALT:7, EMAIL:8,
  BILLING:9, DELIVERY:10, LIFT:11, CUST_CODE:12,
  PO_REF:13, SOURCE:14, DISCOUNT:15, PLANNED_DLY:16,
  INSTALL_NOTE:17, PAYMENT_MODE:18, EARNEST:19, RECEIPT_NO:20,
  FOLLOW_UP:21, SALES_EXEC:22, ORDER_TYPE:23, ITEMS_JSON:24,
  SUBTOTAL:25, CGST:26, SGST:27, TOTAL_WITH_TAX:28, DATE:29
};

// Staff columns:
//   A=username  B=password  C=name  D=code  E=role
var COL_USR = { USERNAME:0, PASSWORD:1, NAME:2, CODE:3, ROLE:4 };

// Change_Log columns:
//   A=Timestamp  B=User  C=OrderNo  D=Action  E=Detail
var COL_LOG = { TS:0, USER:1, ORDER_NO:2, ACTION:3, DETAIL:4 };

// Price list spreadsheet ID (same as hardcoded in the app)
var PRICE_SHEET_ID = '1wFpK-WokcZB6k1vzG7B6JO5TdGHrUwdgvVm_-UQse54';
// Price_list columns:          A=CATEGORY  B=ITEM  C=ITEM CODE  D=ITEM DESCRIPTION  E=CPL  F=GST  G=PRICE
// Price_List_Mattress columns: A=CATEGORY  B=ITEM  C=ITEM CODE  D=ITEM DESCRIPTION  E=THICKNESS(IN)  F=THICKNESS(CM)  G=CPL  H=GST  I=PRICE

// ── Master spreadsheet helper ────────────────────────────────────────────────
// Auto-creates the master spreadsheet on first use — no manual ensureSheets() needed.
function _getMasterSS() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('MASTER_SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); }
    catch (e) {
      // Spreadsheet was deleted or access lost — recreate it
      Logger.log('Could not open saved spreadsheet (' + e.message + ') — recreating.');
    }
  }
  // First run: auto-setup
  ensureSheets();
  id = props.getProperty('MASTER_SHEET_ID');
  if (!id) throw new Error('Auto-setup failed. Please run ensureSheets() manually from the Apps Script editor.');
  return SpreadsheetApp.openById(id);
}

function _getSheet(name) {
  return _getMasterSS().getSheetByName(name);
}

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

// ── Entry points ─────────────────────────────────────────────────────────────
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
// Called by the app Settings screen to verify the API URL is working.
// Also triggers auto-setup on first call if master sheet doesn't exist yet.
function handlePing() {
  var props = PropertiesService.getScriptProperties();
  var id    = props.getProperty('MASTER_SHEET_ID');
  if (!id) {
    ensureSheets();
    id = props.getProperty('MASTER_SHEET_ID');
  }
  var ss  = SpreadsheetApp.openById(id);
  return {
    ok:      true,
    message: 'Connected ✓',
    spreadsheetUrl: ss.getUrl(),
    spreadsheetId:  id,
    sheets: ss.getSheets().map(function(s){ return s.getName(); }),
  };
}

// ── LOGIN ────────────────────────────────────────────────────────────────────
// Checks username + password against the Staff sheet.
// Returns: { ok:true, user:{ name, code, role, branch } }
//       or { ok:false, error:'...' }
function handleLogin(p) {
  var username = (p.username || '').toLowerCase().trim();
  var password = (p.password || '').trim();
  if (!username || !password) return { ok: false, error: 'Username and password required.' };

  // Find the Staff sheet — check master spreadsheet first, then price list spreadsheet.
  // This handles the common case where all data lives in one spreadsheet (PRICE_SHEET_ID).
  var sh = _findStaffSheet();
  if (!sh) {
    return {
      ok: false,
      error: 'Staff sheet not found in either spreadsheet.\n\n' +
             'Fix: open your Google Spreadsheet → make sure one tab is named exactly "Staff" ' +
             '(capital S, no spaces). Then run setMasterSheet() in Apps Script with your spreadsheet ID.'
    };
  }

  var rows = sh.getDataRange().getValues();
  var dataRows = rows.slice(1).filter(function(r) {
    return String(r[COL_USR.USERNAME] || '').trim() !== '';
  });

  if (dataRows.length === 0) {
    return { ok: false, error: 'Staff sheet exists but has no data rows. Add staff members with columns: username, password, name, code, role.' };
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

// Finds the Staff sheet — tries master spreadsheet first, then PRICE_SHEET_ID.
function _findStaffSheet() {
  // Try master spreadsheet
  try {
    var masterSh = _getSheet('Staff');
    if (masterSh) return masterSh;
  } catch(e) {}

  // Try price list spreadsheet (common when all data is in one file)
  try {
    var priceSS = SpreadsheetApp.openById(PRICE_SHEET_ID);
    var priceSh = priceSS.getSheetByName('Staff');
    if (priceSh) {
      // Auto-save this spreadsheet as the master so future calls work correctly
      PropertiesService.getScriptProperties().setProperty('MASTER_SHEET_ID', PRICE_SHEET_ID);
      Logger.log('Staff sheet found in PRICE_SHEET_ID spreadsheet — auto-set as master.');
      return priceSh;
    }
  } catch(e) {}

  return null;
}

// ── STOCK SYNC ───────────────────────────────────────────────────────────────
// Reads Stock_Master sheet and returns all items with branch-wise quantities.
// Returns: { ok:true, items:[{ code, name, cat, mrp, cpl,
//                              stock:[{b:'KB',q:3},{b:'B2CB',q:1},...] }],
//            syncedAt:'ISO string' }
//
// Stock_Master sheet columns:
//   A=Code  B=Name  C=Category  D=CPL  E=MRP
//   F=KB_Qty  G=B2CB_Qty  H=PTA_Qty  I=CTC_Qty
//
// NOTE: You can paste the Godrej stock sheet data directly into Stock_Master.
//       Make sure row 1 is the header row shown above.
function handleStock() {
  var sh = _getSheet('Stock_Master');
  if (!sh) return { ok: false, error: 'Stock_Master sheet not found. Run ensureSheets().' };

  var rows    = sh.getDataRange().getValues();
  var items   = [];
  var BRANCHES = ['KB', 'B2CB', 'PTA', 'CTC'];
  var COLS     = [COL_ST.KB, COL_ST.B2CB, COL_ST.PTA, COL_ST.CTC];

  // Row 0 is header — track when the sheet was last manually updated
  // by reading cell J1 (optional "Synced At" marker)
  var syncedAt = new Date().toISOString();
  var hdrRow   = rows[0] || [];
  if (hdrRow[9]) {  // column J = index 9
    var d = new Date(hdrRow[9]);
    if (!isNaN(d.getTime())) syncedAt = d.toISOString();
  }

  for (var i = 1; i < rows.length; i++) {
    var r    = rows[i];
    var code = String(r[COL_ST.CODE] || '').toUpperCase().trim();
    var name = String(r[COL_ST.NAME] || '').trim();
    if (!code && !name) continue; // skip blank rows

    var cpl = parseFloat(String(r[COL_ST.CPL] || 0).replace(/[^\d.]/g, '')) || 0;
    var mrp = parseFloat(String(r[COL_ST.MRP] || 0).replace(/[^\d.]/g, '')) || cpl;
    var cat = String(r[COL_ST.CAT] || '').trim();

    var stock = [];
    for (var b = 0; b < BRANCHES.length; b++) {
      var qty = parseInt(String(r[COLS[b]] || 0).replace(/[^\d]/g, ''), 10) || 0;
      stock.push({ b: BRANCHES[b], q: qty });
    }

    items.push({ code: code, name: name, cat: cat, mrp: mrp, cpl: cpl, stock: stock });
  }

  return { ok: true, items: items, syncedAt: syncedAt };
}

// ── PRICE LIST ───────────────────────────────────────────────────────────────
// Reads both price list sheets and returns all items as JSON.
// This runs server-side so it works regardless of sheet sharing settings.
//
// Price_list sheet columns (Home Storage & Furniture):
//   A(0)=CATEGORY  B(1)=ITEM  C(2)=ITEM CODE  D(3)=ITEM DESCRIPTION
//   E(4)=CPL  F(5)=GST  G(6)=PRICE
//
// Price_List_Mattress sheet columns:
//   A(0)=CATEGORY  B(1)=ITEM  C(2)=ITEM CODE  D(3)=ITEM DESCRIPTION
//   E(4)=THICKNESS(IN)  F(5)=THICKNESS(CM)  G(6)=CPL  H(7)=GST  I(8)=PRICE
//
// Returns: { ok:true, items:[...], counts:{ furniture:N, mattress:M } }
function handlePriceList() {
  var ss  = SpreadsheetApp.openById(PRICE_SHEET_ID);
  var all = [];

  // ── Sheet 1: Home Storage & Furniture ──────────────────────────────────
  try {
    var sh1 = ss.getSheetByName('Price_list');
    if (sh1) {
      var rows1 = sh1.getDataRange().getValues();
      for (var i = 1; i < rows1.length; i++) {
        var v    = rows1[i];
        var cat  = String(v[0] || 'Furniture').trim();    // CATEGORY
        var item = String(v[1] || '').trim();              // ITEM (series/model)
        var code = String(v[2] || '').toUpperCase().trim(); // ITEM CODE
        var desc = String(v[3] || '').trim();              // ITEM DESCRIPTION
        if (!code && !desc) continue;
        var cpl        = parseFloat(String(v[4] || 0).replace(/[^\d.]/g, '')) || 0;  // CPL
        var mrp        = parseFloat(String(v[6] || 0).replace(/[^\d.]/g, '')) || cpl; // PRICE
        var name       = desc || item || cat;
        var searchName = [cat, item, desc].filter(function(x){ return !!x; }).join(' ');
        all.push({
          code: code, name: name, searchName: searchName,
          cat: cat, item: item, mrp: mrp, cpl: cpl,
          stock: [], sheet: 'furniture'
        });
      }
    }
  } catch (e) {
    Logger.log('Price_list error: ' + e.message);
  }

  // ── Sheet 2: Mattress ──────────────────────────────────────────────────
  try {
    var sh2 = ss.getSheetByName('Price_List_Mattress');
    if (sh2) {
      var rows2 = sh2.getDataRange().getValues();
      for (var j = 1; j < rows2.length; j++) {
        var v2    = rows2[j];
        var cat2  = String(v2[0] || 'Mattress').trim();     // CATEGORY
        var item2 = String(v2[1] || '').trim();              // ITEM
        var code2 = String(v2[2] || '').toUpperCase().trim(); // ITEM CODE
        var desc2 = String(v2[3] || '').trim();              // ITEM DESCRIPTION
        if (!code2 && !desc2) continue;
        var cpl2        = parseFloat(String(v2[6] || 0).replace(/[^\d.]/g, '')) || 0;  // CPL
        var mrp2        = parseFloat(String(v2[8] || 0).replace(/[^\d.]/g, '')) || cpl2; // PRICE
        var name2       = desc2 || item2 || cat2;
        var searchName2 = [cat2, item2, desc2].filter(function(x){ return !!x; }).join(' ');
        all.push({
          code: code2, name: name2, searchName: searchName2,
          cat: cat2, item: item2, mrp: mrp2, cpl: cpl2,
          stock: [], sheet: 'mattress'
        });
      }
    }
  } catch (e) {
    Logger.log('Price_List_Mattress error: ' + e.message);
  }

  var furnitureCount = all.filter(function(i){ return i.sheet === 'furniture'; }).length;
  var mattressCount  = all.filter(function(i){ return i.sheet === 'mattress';  }).length;

  return {
    ok:     true,
    items:  all,
    counts: { furniture: furnitureCount, mattress: mattressCount }
  };
}

// ── ORDERS LIST ──────────────────────────────────────────────────────────────
// Returns orders from Orders_Master.
// If exec is provided, returns only that salesperson's orders (last 60 days).
// Returns: { ok:true, orders:[{ no, won, customer, date, amt, status, salesExec }] }
function handleOrders(p) {
  var sh = _getSheet('Orders_Master');
  if (!sh) return { ok: false, error: 'Orders_Master sheet not found.' };

  var rows   = sh.getDataRange().getValues();
  var exec   = (p.exec || '').trim().toLowerCase();
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60); // last 60 days

  var orders = [];
  for (var i = rows.length - 1; i >= 1; i--) {  // newest first
    var r  = rows[i];
    var ts = r[COL_ORD.TS];
    if (!ts) continue;
    var rowDate = (ts instanceof Date) ? ts : new Date(ts);
    if (rowDate < cutoff) break;  // rows are chronological — stop early

    var salesExec = String(r[COL_ORD.SALES_EXEC] || '');
    if (exec && salesExec.toLowerCase().indexOf(exec) === -1) continue;

    orders.push({
      no:        String(r[COL_ORD.ORDER_NO]    || ''),
      internalNo:Number(r[COL_ORD.INTERNAL_NO] || 0),
      won:       String(r[COL_ORD.WON]         || ''),
      customer:  String(r[COL_ORD.CUSTOMER]    || ''),
      phone:     String(r[COL_ORD.PHONE]       || ''),
      date:      String(r[COL_ORD.DATE]        || ''),
      amt:       Number(r[COL_ORD.TOTAL_WITH_TAX] || 0),
      status:    String(r[COL_ORD.STATUS]      || 'draft'),
      salesExec: salesExec,
    });
  }
  return { ok: true, orders: orders };
}

// ── SAVE ORDER ───────────────────────────────────────────────────────────────
// Appends a new order row to Orders_Master and logs to Change_Log.
// Returns: { ok:true, orderNo:'...', internalNo:N }
function handleSaveOrder(o) {
  if (!o) throw new Error('No order data provided.');
  var sh = _getSheet('Orders_Master');
  if (!sh) throw new Error('Orders_Master sheet not found.');

  // Auto-assign internal number = next row index (data rows only, not header)
  var lastRow    = sh.getLastRow();           // 1-based; row 1 is header
  var internalNo = lastRow;                   // so first order = 1, second = 2, …

  // Build the display order number: internalNo / receiptNo (or just internalNo)
  var receiptNo = String(o.receiptNo || '').trim();
  var orderNo   = receiptNo ? (internalNo + '/' + receiptNo) : String(internalNo);

  var now      = new Date();
  var dateStr  = now.toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'2-digit' }).replace(/\//g, '.');
  var subtotal = Number(o.items ? o.items.reduce(function(s,i){ return s + (i.total||0); }, 0) : 0);
  var cgst     = Math.round(subtotal * 0.09);
  var sgst     = Math.round(subtotal * 0.09);
  var total    = subtotal + cgst + sgst;

  sh.appendRow([
    now,                                         // A Timestamp
    internalNo,                                  // B InternalNo
    orderNo,                                     // C OrderNo
    String(o.won || ''),                         // D WON
    'pending-won',                               // E Status
    String(o.customer      || ''),               // F Customer
    String(o.phone         || ''),               // G Phone
    String(o.alt           || ''),               // H Alt
    String(o.email         || ''),               // I Email
    String(o.billing       || ''),               // J Billing
    String(o.delivery      || ''),               // K Delivery
    String(o.liftAvailable || ''),               // L LiftAvailable
    String(o.customerCode  || ''),               // M CustomerCode
    String(o.poRef         || ''),               // N PORef
    String(o.source        || ''),               // O Source
    String(o.discountCode  || ''),               // P DiscountCode
    String(o.plannedDly    || ''),               // Q PlannedDly
    String(o.installNote   || ''),               // R InstallNote
    String(o.paymentMode   || ''),               // S PaymentMode
    Number(o.earnest       || 0),                // T Earnest
    receiptNo,                                   // U ReceiptNo
    String(o.followUp      || ''),               // V FollowUp
    String(o.salesExec     || ''),               // W SalesExec
    String(o.orderType     || 'B2C'),            // X OrderType
    JSON.stringify(o.items || []),               // Y Items_JSON
    subtotal,                                    // Z Subtotal
    cgst,                                        // AA CGST
    sgst,                                        // AB SGST
    total,                                       // AC TotalWithTax
    dateStr,                                     // AD Date
  ]);

  // Audit log
  _appendLog(String(o.salesExec || ''), orderNo, 'CREATE',
    'Customer: ' + (o.customer || '') + ' | Items: ' + (o.items ? o.items.length : 0));

  return { ok: true, orderNo: orderNo, internalNo: internalNo };
}

// ── UPDATE WON ───────────────────────────────────────────────────────────────
// Finds the order row by internalNo and updates the WON + Status columns.
// Returns: { ok:true }
function handleUpdateWON(body) {
  var orderNo    = String(body.orderNo    || '');
  var internalNo = Number(body.internalNo || 0);
  var won        = String(body.won        || '').trim().toUpperCase();
  var updatedBy  = String(body.updatedBy  || '');
  if (!won) return { ok: false, error: 'WON number is required.' };

  var sh   = _getSheet('Orders_Master');
  if (!sh) return { ok: false, error: 'Orders_Master sheet not found.' };

  var rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var rowInternal = Number(rows[i][COL_ORD.INTERNAL_NO]);
    var rowOrderNo  = String(rows[i][COL_ORD.ORDER_NO]);
    if (rowInternal === internalNo || rowOrderNo === orderNo) {
      // Columns are 1-based in setValues
      var sheetRow = i + 1;  // +1 because rows[] is 0-based but sheet is 1-based
      sh.getRange(sheetRow, COL_ORD.WON    + 1).setValue(won);
      sh.getRange(sheetRow, COL_ORD.STATUS + 1).setValue('billed');
      _appendLog(updatedBy, orderNo, 'UPDATE_WON', 'WON: ' + won);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Order not found: ' + orderNo };
}

// ── CHANGE LOG ───────────────────────────────────────────────────────────────
function _appendLog(user, orderNo, action, detail) {
  try {
    var sh = _getSheet('Change_Log');
    if (sh) sh.appendRow([new Date(), user, orderNo, action, detail]);
  } catch (e) {
    Logger.log('Change_Log write failed: ' + e.message);
  }
}

// ── ensureSheets ─────────────────────────────────────────────────────────────
// Run this ONCE from the Apps Script editor (Run menu → ensureSheets).
// Creates a new Google Spreadsheet with all required tabs + headers.
// Stores the spreadsheet ID in Script Properties for all future calls.
function ensureSheets() {
  var props = PropertiesService.getScriptProperties();
  var existingId = props.getProperty('MASTER_SHEET_ID');
  var ss;

  if (existingId) {
    try {
      ss = SpreadsheetApp.openById(existingId);
      Logger.log('Using existing spreadsheet: ' + ss.getUrl());
    } catch (e) {
      Logger.log('Could not open existing spreadsheet (' + e.message + ') — creating new one.');
      ss = null;
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create('4S Interiors — Orders Master');
    props.setProperty('MASTER_SHEET_ID', ss.getId());
    Logger.log('Created new spreadsheet: ' + ss.getUrl());
  }

  // ── Staff ──────────────────────────────────────────────────────────────────
  var staff = ss.getSheetByName('Staff');
  if (!staff) {
    staff = ss.insertSheet('Staff');
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
    Logger.log('✓ Staff sheet created with 8 users');
  }

  // ── Stock_Master ──────────────────────────────────────────────────────────
  // Paste Godrej stock sheet data here (columns A–I).
  // Column J (index 9) can hold the date the stock was last updated.
  var stock = ss.getSheetByName('Stock_Master');
  if (!stock) {
    stock = ss.insertSheet('Stock_Master');
    stock.appendRow(['Code', 'Name', 'Category', 'CPL', 'MRP', 'KB_Qty', 'B2CB_Qty', 'PTA_Qty', 'CTC_Qty', 'Updated_At']);
    _boldHeader(stock);
    Logger.log('✓ Stock_Master sheet created — paste Godrej stock data here');
  }

  // ── Orders_Master ─────────────────────────────────────────────────────────
  var orders = ss.getSheetByName('Orders_Master');
  if (!orders) {
    orders = ss.insertSheet('Orders_Master');
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
    Logger.log('✓ Orders_Master sheet created');
  }

  // ── Change_Log ────────────────────────────────────────────────────────────
  var log = ss.getSheetByName('Change_Log');
  if (!log) {
    log = ss.insertSheet('Change_Log');
    log.appendRow(['Timestamp', 'User', 'OrderNo', 'Action', 'Detail']);
    _boldHeader(log);
    Logger.log('✓ Change_Log sheet created');
  }

  // Delete the default "Sheet1" if it still exists
  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1) ss.deleteSheet(sheet1);

  Logger.log('');
  Logger.log('============================================================');
  Logger.log('Setup complete!');
  Logger.log('Spreadsheet URL : ' + ss.getUrl());
  Logger.log('Spreadsheet ID  : ' + ss.getId());
  Logger.log('');
  Logger.log('Next steps:');
  Logger.log('  1. Deploy → New deployment → Web App');
  Logger.log('     Execute as: Me | Anyone can access');
  Logger.log('  2. Copy the Web App URL → paste in app Settings');
  Logger.log('  3. Paste your Godrej stock data into the Stock_Master tab');
  Logger.log('  4. Update passwords in the Staff tab as needed.');
  Logger.log('============================================================');
}

function _boldHeader(sheet) {
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
}

// ── DEBUG PRICE LIST ─────────────────────────────────────────────────────────
// Returns the sheet names + first 3 data rows from both price list sheets.
// Tap "Debug price list" in Settings to call this and see exactly what
// the Apps Script finds in the spreadsheet — helps diagnose 0-item issues.
function handleDebugPriceList() {
  try {
    var ss = SpreadsheetApp.openById(PRICE_SHEET_ID);
    var allSheetNames = ss.getSheets().map(function(s){ return s.getName(); });
    var result = {
      ok: true,
      spreadsheetName: ss.getName(),
      allSheets: allSheetNames,
      priceListSheet:    { found: false, rows: 0, sample: [] },
      mattressSheet:     { found: false, rows: 0, sample: [] },
    };

    var sh1 = ss.getSheetByName('Price_list');
    if (sh1) {
      var d1 = sh1.getDataRange().getValues();
      result.priceListSheet.found = true;
      result.priceListSheet.rows  = d1.length - 1; // subtract header
      result.priceListSheet.header = d1[0] ? d1[0].slice(0,7) : [];
      result.priceListSheet.sample = d1.slice(1, 4).map(function(r){ return r.slice(0,7); });
    }

    var sh2 = ss.getSheetByName('Price_List_Mattress');
    if (sh2) {
      var d2 = sh2.getDataRange().getValues();
      result.mattressSheet.found = true;
      result.mattressSheet.rows  = d2.length - 1;
      result.mattressSheet.header = d2[0] ? d2[0].slice(0,9) : [];
      result.mattressSheet.sample = d2.slice(1, 4).map(function(r){ return r.slice(0,9); });
    }

    return result;
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// ── setMasterSheet ────────────────────────────────────────────────────────────
// Run this from the Apps Script editor when you already have an existing
// spreadsheet that you want to use as the master.
//
// HOW TO USE:
//   1. Get your spreadsheet ID from its URL:
//      https://docs.google.com/spreadsheets/d/  ← COPY THIS PART →  /edit
//   2. Paste it between the quotes below, replacing YOUR_SPREADSHEET_ID_HERE
//   3. Click Run → setMasterSheet
//   4. Check the Logs — it will confirm which spreadsheet is now active
//
function setMasterSheet() {
  var id = 'YOUR_SPREADSHEET_ID_HERE'; // ← paste your spreadsheet ID here

  if (id === 'YOUR_SPREADSHEET_ID_HERE' || !id.trim()) {
    Logger.log('ERROR: Paste your spreadsheet ID into the setMasterSheet function first.');
    return;
  }

  try {
    var ss = SpreadsheetApp.openById(id.trim());
    PropertiesService.getScriptProperties().setProperty('MASTER_SHEET_ID', id.trim());
    Logger.log('✓ Master spreadsheet set to: ' + ss.getName());
    Logger.log('  URL: ' + ss.getUrl());
    Logger.log('  Sheets found: ' + ss.getSheets().map(function(s){ return s.getName(); }).join(', '));
  } catch(e) {
    Logger.log('ERROR: Could not open spreadsheet with ID "' + id + '"');
    Logger.log('  ' + e.message);
    Logger.log('  Make sure the ID is correct and the script has access to it.');
  }
}
