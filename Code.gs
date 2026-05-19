// ============================================================
// 4S Interiors — Google Apps Script backend
// Deployed as a Web App: Execute as Me | Anyone can access
//
// HOW TO UPDATE:
//   1. Open script.google.com → your 4S Orders project
//   2. Replace or merge this file with your existing Code.gs
//   3. Deploy → Manage deployments → New version → Deploy
//   4. Copy the new URL and paste it in the app Settings if it changed
// ============================================================

// ── Entry point ───────────────────────────────────────────────
function doGet(e) {
  const p        = e.parameter || {};
  const callback = p.callback  || 'cb';
  let result;

  try {
    switch (p.action) {
      case 'login':     result = handleLogin(p);     break;
      case 'stock':     result = handleStock(p);     break;
      case 'priceList': result = handlePriceList();  break;  // ← ADD THIS LINE
      case 'orders':    result = handleOrders(p);    break;
      default:          result = { ok: false, error: 'Unknown action: ' + p.action };
    }
  } catch (err) {
    result = { ok: false, error: err.message };
  }

  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(result) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch { return _json({ ok: false, error: 'Bad JSON' }); }

  try {
    switch (body.action) {
      case 'saveOrder':  return _json(handleSaveOrder(body));
      case 'updateWON':  return _json(handleUpdateWON(body));
      default:           return _json({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return _json({ ok: false, error: err.message });
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Price List ────────────────────────────────────────────────
// Reads both price list sheets and returns all items as JSON.
// Sheet IDs match what the app expects:
//   Price_list          → Home Storage & Furniture
//   Price_List_Mattress → Mattress
//
// Column layout for Price_list:
//   A=Category/Series  B=SubCategory  C=Code  D=Description  E=CPL  F=GST%  G=MRP
//
// Column layout for Price_List_Mattress:
//   A=Category  C=Code  D=Description  G=CPL  I=MRP
//
function handlePriceList() {
  const SHEET_ID = '1wFpK-WokcZB6k1vzG7B6JO5TdGHrUwdgvVm_-UQse54';
  const ss  = SpreadsheetApp.openById(SHEET_ID);
  const all = [];

  // ── Sheet 1: Home Storage & Furniture ──────────────────────
  try {
    const sh   = ss.getSheetByName('Price_list');
    if (sh) {
      const rows = sh.getDataRange().getValues();
      rows.slice(1).forEach(function(v) {
        var cat    = String(v[0] || 'Furniture').trim();
        var subcat = String(v[1] || '').trim();
        var code   = String(v[2] || '').toUpperCase().trim();
        var desc   = String(v[3] || '').trim();
        if (!code && !desc) return;
        var cpl  = parseFloat(String(v[4] || 0).replace(/[^\d.]/g, '')) || 0;
        var mrp  = parseFloat(String(v[6] || 0).replace(/[^\d.]/g, '')) || cpl;
        var name       = desc || subcat || cat;
        var searchName = [cat, subcat, desc].filter(Boolean).join(' ');
        all.push({ code: code, name: name, searchName: searchName,
                   cat: cat, subcat: subcat, mrp: mrp, cpl: cpl,
                   stock: [], sheet: 'furniture' });
      });
    }
  } catch (e) {
    Logger.log('Price_list sheet error: ' + e.message);
  }

  // ── Sheet 2: Mattress ───────────────────────────────────────
  try {
    const sh   = ss.getSheetByName('Price_List_Mattress');
    if (sh) {
      const rows = sh.getDataRange().getValues();
      rows.slice(1).forEach(function(v) {
        var cat  = String(v[0] || 'Mattress').trim();
        var code = String(v[2] || '').toUpperCase().trim();
        var desc = String(v[3] || '').trim();
        if (!code && !desc) return;
        var cpl  = parseFloat(String(v[6] || 0).replace(/[^\d.]/g, '')) || 0;
        var mrp  = parseFloat(String(v[8] || 0).replace(/[^\d.]/g, '')) || cpl;
        var name       = desc || cat;
        var searchName = [cat, desc].filter(Boolean).join(' ');
        all.push({ code: code, name: name, searchName: searchName,
                   cat: cat, mrp: mrp, cpl: cpl,
                   stock: [], sheet: 'mattress' });
      });
    }
  } catch (e) {
    Logger.log('Price_List_Mattress sheet error: ' + e.message);
  }

  return {
    ok:     true,
    items:  all,
    counts: {
      furniture: all.filter(function(i) { return i.sheet === 'furniture'; }).length,
      mattress:  all.filter(function(i) { return i.sheet === 'mattress';  }).length,
    },
  };
}

// ── Stock ─────────────────────────────────────────────────────
// Keep your existing handleStock() here unchanged.
// It should return: { ok: true, items: [...], syncedAt: '...' }
function handleStock(p) {
  // TODO: paste your existing stock handler here
  throw new Error('handleStock not implemented — paste your existing code here');
}

// ── Login ─────────────────────────────────────────────────────
function handleLogin(p) {
  // TODO: paste your existing login handler here
  throw new Error('handleLogin not implemented — paste your existing code here');
}

// ── Orders ────────────────────────────────────────────────────
function handleOrders(p) {
  // TODO: paste your existing orders handler here
  throw new Error('handleOrders not implemented — paste your existing code here');
}

// ── Save order ────────────────────────────────────────────────
function handleSaveOrder(body) {
  // TODO: paste your existing save-order handler here
  throw new Error('handleSaveOrder not implemented — paste your existing code here');
}

// ── Update WON ────────────────────────────────────────────────
function handleUpdateWON(body) {
  // TODO: paste your existing update-WON handler here
  throw new Error('handleUpdateWON not implemented — paste your existing code here');
}
