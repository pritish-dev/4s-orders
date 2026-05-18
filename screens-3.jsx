// ─────────── 5. PDF PREVIEW + SHARE
function PDFPreviewScreen() {
  const o = MOCK.SAMPLE_ORDER;
  const subtotal = o.items.reduce((s, i) => s + i.total, 0);
  const cgst = Math.round(subtotal * 0.09);
  const sgst = Math.round(subtotal * 0.09);
  const total = subtotal + cgst + sgst;

  return (
    <PhoneScreen bg={T.ink2}>
      <div style={{ height: 54 }} />
      {/* Slim app bar over dark bg */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px 12px', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            onClick={() => {
              // Scroll to the home artboard in the design canvas; in a real app this would navigate
              const homeEl = document.getElementById('ios-home');
              if (homeEl) homeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              else if (window.__navigate) window.__navigate('home');
            }}
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              cursor: 'pointer',
            }}
          >‹</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4 }}>Order PDF</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontFamily: T.mono }}>{o.no} · GENERATED 11:42 AM</div>
          </div>
        </div>
        <Pill tone="ok" size="sm">SAVED ✓</Pill>
      </div>

      {/* PDF page preview */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 18px 14px' }}>
        <div style={{
          background: '#fff', borderRadius: 4, overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          fontFamily: T.sans,
        }}>
          {/* doc header */}
          <div style={{ background: T.green, color: '#fff', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FSLogo size={26} dark={true} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, opacity: 0.75, letterSpacing: 1 }}>ORDER CONFIRMATION</div>
                <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, marginTop: 2 }}>{o.no}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 16px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 9 }}>
              <div>
                <div style={{ color: T.ink4, fontWeight: 700, letterSpacing: 0.6, marginBottom: 3 }}>BILL TO</div>
                <div style={{ fontWeight: 700, fontSize: 11 }}>{o.customer}</div>
                <div style={{ color: T.ink3, lineHeight: 1.4, fontSize: 10, whiteSpace: 'pre-line' }}>{o.billing}</div>
                <div style={{ fontFamily: T.mono, fontSize: 10, marginTop: 3, color: T.ink2 }}>{o.phone}</div>
              </div>
              <div>
                <div style={{ color: T.ink4, fontWeight: 700, letterSpacing: 0.6, marginBottom: 3 }}>DELIVER TO</div>
                <div style={{ fontSize: 10, color: T.ink3 }}>{o.delivery}</div>
                <div style={{ marginTop: 6, color: T.ink4, fontWeight: 700, letterSpacing: 0.6 }}>PLANNED DLY</div>
                <div style={{ fontFamily: T.mono, fontSize: 10 }}>{o.plannedDly}</div>
              </div>
            </div>

            {/* meta band */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
              marginTop: 10, padding: '7px 10px',
              background: T.paper, border: `1px solid ${T.line}`, borderRadius: 4, fontSize: 9,
            }}>
              <Meta k="DATE" v={o.date} />
              <Meta k="EXEC" v={o.salesExec} />
              <Meta k="WON #" v="—" warn />
            </div>

            {/* items table */}
            <div style={{ marginTop: 12, border: `1px solid ${T.line}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '12px 1fr 22px 50px',
                background: T.paper, padding: '5px 8px', fontSize: 8, color: T.ink4,
                fontWeight: 700, letterSpacing: 0.5, gap: 6,
              }}>
                <span>#</span><span>ITEM</span><span style={{textAlign:'right'}}>QTY</span><span style={{textAlign:'right'}}>TOTAL</span>
              </div>
              {o.items.map((it, i) => (
                <div key={it.code} style={{
                  display: 'grid', gridTemplateColumns: '12px 1fr 22px 50px', gap: 6,
                  padding: '6px 8px', fontSize: 9,
                  borderTop: i > 0 ? `1px solid ${T.line}` : 'none',
                }}>
                  <span style={{ fontFamily: T.mono, color: T.ink4 }}>{i+1}</span>
                  <span>
                    <div style={{ fontFamily: T.mono, fontSize: 8, color: T.ink4 }}>{it.code}</div>
                    <div style={{ fontSize: 9, color: T.ink, fontWeight: 600, marginTop: 1 }}>{it.name}</div>
                  </span>
                  <span style={{ fontFamily: T.mono, textAlign: 'right' }}>{it.qty}</span>
                  <span style={{ fontFamily: T.mono, textAlign: 'right', fontWeight: 700 }}>{it.total.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            {/* totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <div style={{ width: 170, fontSize: 9, fontFamily: T.mono }}>
                <Row2 k="Subtotal" v={subtotal} />
                <Row2 k="CGST 9%" v={cgst} />
                <Row2 k="SGST 9%" v={sgst} />
                <div style={{ borderTop: `1px solid ${T.ink}`, marginTop: 3, paddingTop: 4, fontSize: 12, fontWeight: 700 }}>
                  <Row2 k="TOTAL" v={total} bold />
                </div>
                <div style={{ marginTop: 2, color: T.green }}>
                  <Row2 k="Earnest" v={o.earnest} />
                </div>
              </div>
            </div>

            {/* Footer with QR */}
            <div style={{
              marginTop: 14, padding: '10px 12px',
              background: T.greenSoft, border: `1px solid ${T.greenLine}`, borderRadius: 4,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <QRBlock />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 8, color: T.green, fontWeight: 700, letterSpacing: 0.5 }}>CUSTOMER COPY</div>
                <div style={{ fontSize: 9.5, color: T.ink2, marginTop: 2, lineHeight: 1.35 }}>
                  Scan to download a signed PDF copy of this order. Valid for 30 days.
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 8, color: T.ink4, marginTop: 3 }}>4SI.IN/O/{o.no.replace('/', '-')}</div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 8, color: T.ink4, textAlign: 'center', fontFamily: T.mono }}>
              4S INTERIORS · PATIA, BHUBANESWAR · GST 21AABCS9988R1Z3 · INVOICE NO PENDING
            </div>
          </div>
        </div>

        {/* WON later notice */}
        <div style={{
          marginTop: 14, padding: '12px 14px', background: 'rgba(255,210,122,0.12)',
          border: '1px dashed rgba(255,210,122,0.5)', borderRadius: 6,
          color: '#FFD27A', fontSize: 11.5, lineHeight: 1.5, display: 'flex', gap: 10,
        }}>
          {Icon.bolt(16, '#FFD27A')}
          <div style={{ flex: 1 }}>
            <b style={{ color: '#FFE6B0' }}>Add Godrej WON / SO number later.</b><br/>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>This PDF (and the customer's QR) updates automatically once entered.</span>
          </div>
          <span style={{ alignSelf: 'center', fontWeight: 700, color: '#FFD27A', fontSize: 11 }}>ADD →</span>
        </div>
      </div>

      {/* Share bar */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px 16px', background: T.ink2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button style={{
          flex: 1, height: 48, borderRadius: 6, background: '#25D366', border: 'none',
          color: '#fff', fontWeight: 700, fontFamily: T.sans, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>{Icon.whatsapp(18)} WhatsApp</button>
        <button style={{
          width: 48, height: 48, borderRadius: 6,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{Icon.qr(18, '#fff')}</button>
        <button style={{
          width: 48, height: 48, borderRadius: 6,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{Icon.download(18, '#fff')}</button>
        <button style={{
          flex: 1, height: 48, borderRadius: 6, background: '#fff', border: 'none',
          color: T.ink, fontWeight: 700, fontFamily: T.sans, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        }}>{Icon.share(16, T.ink)} Share</button>
      </div>
    </PhoneScreen>
  );
}

function Meta({ k, v, warn }) {
  return (
    <div>
      <div style={{ color: T.ink4, fontWeight: 700, letterSpacing: 0.5 }}>{k}</div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: warn ? T.warn : T.ink, fontWeight: 700, marginTop: 1 }}>{v}</div>
    </div>
  );
}

function Row2({ k, v, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
      <span style={{ color: bold ? T.ink : T.ink3 }}>{k}</span>
      <span style={{ color: T.ink, fontWeight: bold ? 700 : 500 }}>₹{v.toLocaleString('en-IN')}</span>
    </div>
  );
}

function QRBlock({ size = 56 }) {
  // Procedural-looking QR (not a real one)
  const cells = 11;
  const px = size / cells;
  const pattern = [];
  // deterministic pseudo-random
  const seed = (i, j) => ((i * 7 + j * 13 + i * j) % 5) > 1;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      // finder corners
      const corner = (i < 3 && j < 3) || (i < 3 && j > cells - 4) || (i > cells - 4 && j < 3);
      if (corner) {
        const inFinder = (i === 0 || i === 2 || j === 0 || j === 2 || (i === 1 && j === 1)) ||
                         (i < 3 && j > cells - 4 && (i === 0 || i === 2 || j === cells - 1 || j === cells - 3 || (i === 1 && j === cells - 2))) ||
                         (i > cells - 4 && j < 3 && (i === cells - 1 || i === cells - 3 || j === 0 || j === 2 || (i === cells - 2 && j === 1)));
        if (inFinder) pattern.push(<rect key={`${i}-${j}`} x={j*px} y={i*px} width={px} height={px} fill={T.ink} />);
      } else if (seed(i, j)) {
        pattern.push(<rect key={`${i}-${j}`} x={j*px} y={i*px} width={px} height={px} fill={T.ink} />);
      }
    }
  }
  return (
    <div style={{ background: '#fff', padding: 4, borderRadius: 4, border: `1px solid ${T.line}` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{pattern}</svg>
    </div>
  );
}

window.PDFPreviewScreen = PDFPreviewScreen;
window.QRBlock = QRBlock;
