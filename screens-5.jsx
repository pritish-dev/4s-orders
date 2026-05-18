// Android-flavored variants of key screens
// Reuses our content components but with Material chrome via AndroidDevice

function AndroidHomeScreen() {
  // We render the same HomeScreen body but tweak top spacing — AndroidDevice handles the status bar
  return (
    <div style={{
      width: '100%', height: '100%', background: T.paper,
      fontFamily: T.sans, color: T.ink,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <StockRibbon />
      <div style={{ padding: '14px 18px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: T.ink4, fontFamily: T.mono, letterSpacing: 1 }}>SAT · 09 MAY</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginTop: 2 }}>Hi, Archita</div>
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 99, background: T.green, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.mono, fontSize: 16, fontWeight: 700,
        }}>AR</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8, padding: '8px 18px 14px' }}>
        {[
          { label: 'TODAY', val: '4', sub: 'orders', tone: 'green' },
          { label: 'PENDING WON', val: '2', sub: 'awaiting', tone: 'warn' },
          { label: 'M.T.D.', val: '₹8.4L', sub: 'booked', tone: 'ink' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#fff', border: `1px solid ${T.line}`, borderRadius: 12,
            padding: '10px 11px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ fontSize: 9, color: T.ink4, fontWeight: 700, letterSpacing: 0.8 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -1, color: T.ink, lineHeight: 1.1, marginTop: 4 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: T.ink3 }}>{s.sub}</div>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
              background: s.tone === 'green' ? T.green : s.tone === 'warn' ? T.warn : T.ink,
            }} />
          </div>
        ))}
      </div>

      <div style={{ padding: '0 18px 12px' }}>
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 18px', background: T.green, color: '#fff', border: 'none', borderRadius: 16,
          fontFamily: T.sans, cursor: 'pointer', textAlign: 'left',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, letterSpacing: 0.5, textTransform: 'uppercase' }}>NEW</div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: -0.4, marginTop: 2 }}>Book an order</div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 99, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {Icon.plus(20, T.green)}
          </div>
        </button>
      </div>

      <div style={{ padding: '0 18px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.ink4, letterSpacing: 1.2, textTransform: 'uppercase' }}>RECENT ORDERS</div>
        <div style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>VIEW ALL →</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, margin: '0 14px', overflow: 'hidden', border: `1px solid ${T.line}` }}>
        {MOCK.ORDERS.slice(0, 4).map((o, i, arr) => (
          <div key={o.no} style={{
            display: 'grid', gridTemplateColumns: '1fr auto',
            padding: '11px 14px', alignItems: 'center', gap: 10,
            borderBottom: i < arr.length - 1 ? `1px solid ${T.line}` : 'none',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.ink2, fontWeight: 600 }}>{o.no}</span>
                {o.won
                  ? <Pill tone="ok" mono size="sm">{o.won}</Pill>
                  : <Pill tone="warn" size="sm">WON?</Pill>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.customer}</div>
              <div style={{ fontSize: 11, color: T.ink4, fontFamily: T.mono, marginTop: 1 }}>{o.date} · {o.salesExec}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontFamily: T.mono, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>
                ₹{o.amt.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Material FAB */}
      <div style={{ position: 'relative', marginTop: 8 }}>
        <button style={{
          position: 'absolute', right: 16, bottom: 6,
          width: 56, height: 56, borderRadius: 16,
          background: T.green, border: 'none', color: '#fff',
          boxShadow: '0 6px 16px rgba(15,76,58,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{Icon.plus(22, '#fff')}</button>
      </div>

      <div style={{ height: 70 }} />
    </div>
  );
}

// WON-update modal as a standalone screen
function WONUpdateScreen() {
  const o = MOCK.SAMPLE_ORDER;
  return (
    <PhoneScreen bg={T.paper}>
      <div style={{ height: 54 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 14px' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6, background: '#fff', border: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>‹</div>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4 }}>Update WON / SO</div>
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        <div style={{
          background: '#fff', border: `1px solid ${T.line}`, borderRadius: 8, padding: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.ink2, fontWeight: 600 }}>{o.no}</span>
            <Pill tone="warn" size="sm">PENDING WON</Pill>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{o.customer}</div>
          <div style={{ fontSize: 11, color: T.ink4, marginTop: 2, fontFamily: T.mono }}>{o.date} · ₹1,71,390</div>
        </div>
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        <div style={{ fontSize: 10, color: T.ink4, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>GODREJ SO / WON NUMBER</div>
        <div style={{
          background: '#fff', border: `2px solid ${T.green}`, borderRadius: 8, padding: '14px 16px',
          fontFamily: T.mono, fontSize: 24, fontWeight: 700, letterSpacing: 1.5,
          color: T.ink, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: T.ink4 }}>WON</span>
          <span>0</span><span>3</span><span>6</span><span>0</span><span>0</span><span style={{ color: T.green, animation: 'blink 1s infinite' }}>|</span><span style={{ color: T.ink4 }}>_</span>
        </div>
        <div style={{ fontSize: 11, color: T.ink4, marginTop: 6, fontFamily: T.mono }}>From Godrej confirmation email</div>
      </div>

      <div style={{ padding: '0 18px 14px' }}>
        <div style={{
          padding: 12, background: T.greenSoft, border: `1px solid ${T.greenLine}`, borderRadius: 6,
          display: 'flex', gap: 10,
        }}>
          {Icon.bolt(14, T.green)}
          <div style={{ fontSize: 11.5, color: T.ink2, lineHeight: 1.5 }}>
            <b style={{ color: T.green }}>What this updates:</b> the saved PDF, customer's QR copy, the Orders sheet, and a new entry in the Change-log sheet (you · {o.salesExec} · 11:42 AM).
          </div>
        </div>
      </div>

      {/* Change log preview */}
      <div style={{ padding: '0 18px 14px' }}>
        <div style={{ fontSize: 10, color: T.ink4, fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>LAST 3 EDITS · THIS ORDER</div>
        <div style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 8 }}>
          {[
            { who: 'Swati', what: 'Created order', when: '09 May · 11:08 AM' },
            { who: 'Swati', what: 'Added Senate TV Unit', when: '09 May · 11:14 AM' },
            { who: 'Manager (Rohit)', what: 'Approved 11% scheme', when: '09 May · 11:31 AM' },
          ].map((l, i, arr) => (
            <div key={i} style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
              borderTop: i > 0 ? `1px solid ${T.line}` : 'none',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 99, background: T.green }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>{l.what}</div>
                <div style={{ fontSize: 10, color: T.ink4, fontFamily: T.mono }}>{l.who} · {l.when}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#fff', borderTop: `1px solid ${T.line}` }}>
        <Btn>Cancel</Btn>
        <Btn primary full>Update & re-issue PDF</Btn>
      </div>
    </PhoneScreen>
  );
}

window.AndroidHomeScreen = AndroidHomeScreen;
window.WONUpdateScreen = WONUpdateScreen;
