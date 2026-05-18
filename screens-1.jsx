// ─────────── PHONE STAGE — wraps screens that ride INSIDE iOS frame
function PhoneScreen({ children, bg = T.paper }) {
  return (
    <div style={{
      width: '100%', height: '100%', background: bg,
      fontFamily: T.sans, color: T.ink,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

// Sticky stock-freshness ribbon shown at top of every working screen
function StockRibbon({ syncedAt = 'Today, 11:02 AM', dateLabel = 'Today · 09 May 2026', stale }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 8, padding: '8px 14px',
      background: stale ? T.warnSoft : T.greenSoft,
      borderBottom: `1px solid ${stale ? '#E6CC95' : T.greenLine}`,
      fontFamily: T.sans, fontSize: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 7, height: 7, borderRadius: 99,
          background: stale ? T.warn : T.ok, flexShrink: 0,
          boxShadow: stale ? 'none' : `0 0 0 3px ${T.okSoft}`,
        }} />
        <span style={{ color: stale ? T.warn : T.green, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', fontSize: 10 }}>
          STOCK · {dateLabel}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: stale ? T.warn : T.green, fontFamily: T.mono, fontSize: 10 }}>{syncedAt}</span>
        <span style={{
          fontFamily: T.sans, fontSize: 10, fontWeight: 700,
          color: T.green, textDecoration: 'underline', textUnderlineOffset: 2,
        }}>SYNC NOW</span>
      </div>
    </div>
  );
}

// ─────────── 1. LOGIN
function LoginScreen() {
  return (
    <PhoneScreen bg={T.paper}>
      <div style={{ height: 54 }} />
      <div style={{ padding: '32px 28px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FSLogo size={36} />
      </div>

      <div style={{ flex: 1, padding: '40px 28px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 11, color: T.ink4, fontFamily: T.mono, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          STAFF SIGN-IN · v1.0
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1, margin: '12px 0 6px', color: T.ink }}>
          Order desk.<br/><span style={{ color: T.green }}>Patia store.</span>
        </h1>
        <div style={{ fontSize: 13, color: T.ink3, lineHeight: 1.5, marginBottom: 28 }}>
          Sales-team only. Use the username issued by the store manager.
        </div>

        {/* form */}
        <div style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.ink4, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>USERNAME</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, color: T.ink }}>swati.patia</div>
          </div>
          <div style={{ padding: '12px 14px', position: 'relative' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.ink4, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>PASSWORD</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, color: T.ink, letterSpacing: 4 }}>••••••••</div>
            <span style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 11, fontFamily: T.sans, fontWeight: 600, color: T.green,
            }}>SHOW</span>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, color: T.ink3 }}>
          <span style={{
            width: 16, height: 16, border: `1.5px solid ${T.green}`, borderRadius: 3,
            background: T.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{Icon.check(11, '#fff')}</span>
          Keep me signed in on this device
        </label>

        <div style={{ marginTop: 24 }}>
          <Btn primary full size="lg">Sign in →</Btn>
        </div>

        <div style={{ marginTop: 16, padding: 12, background: '#fff', border: `1px dashed ${T.line2}`, borderRadius: 6, display: 'flex', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 4, background: T.greenSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {Icon.bolt(14, T.green)}
          </div>
          <div style={{ fontSize: 11, color: T.ink3, lineHeight: 1.5 }}>
            <b>Forgot password?</b> Contact store manager — passwords are reset only by admin.
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 28px 28px', textAlign: 'center', fontSize: 10, color: T.ink4, fontFamily: T.mono }}>
        4S INTERIORS · BUILD 2026.05.09 · SYNCED ✓
      </div>
    </PhoneScreen>
  );
}

// ─────────── 2. DASHBOARD / HOME
function HomeScreen() {
  const stats = [
    { label: 'TODAY', val: '4', sub: 'orders', tone: 'green' },
    { label: 'PENDING WON', val: '2', sub: 'awaiting', tone: 'warn' },
    { label: 'M.T.D.', val: '₹8.4L', sub: 'booked', tone: 'ink' },
  ];
  return (
    <PhoneScreen bg={T.paper}>
      <div style={{ height: 54 }} />
      <StockRibbon />

      {/* Header */}
      <div style={{ padding: '14px 18px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: T.ink4, fontFamily: T.mono, letterSpacing: 1 }}>SAT · 09 MAY</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginTop: 2 }}>Hi, Swati</div>
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 6, background: T.green, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.mono, fontSize: 16, fontWeight: 700,
        }}>SW</div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8, padding: '8px 18px 14px' }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: '#fff', border: `1px solid ${T.line}`, borderRadius: 6,
            padding: '10px 11px', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ fontSize: 9, color: T.ink4, fontWeight: 700, letterSpacing: 0.8 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -1, color: T.ink, fontFamily: T.sans, lineHeight: 1.1, marginTop: 4 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: T.ink3 }}>{s.sub}</div>
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
              background: s.tone === 'green' ? T.green : s.tone === 'warn' ? T.warn : T.ink,
            }} />
          </div>
        ))}
      </div>

      {/* Primary action */}
      <div style={{ padding: '0 18px 12px' }}>
        <button style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 18px', background: T.green, color: '#fff', border: 'none', borderRadius: 8,
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

      {/* Quick row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '0 18px 16px' }}>
        {[
          { icon: Icon.search(18), label: 'Search\nstock' },
          { icon: Icon.doc(18), label: 'Order\nhistory' },
          { icon: Icon.cloud(18), label: 'Price\nlists' },
        ].map((q, i) => (
          <div key={i} style={{
            background: '#fff', border: `1px solid ${T.line}`, borderRadius: 6,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 76,
          }}>
            {q.icon}
            <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, lineHeight: 1.25, whiteSpace: 'pre-line' }}>{q.label}</div>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div style={{ padding: '0 18px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.ink4, letterSpacing: 1.2, textTransform: 'uppercase' }}>RECENT ORDERS</div>
        <div style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>VIEW ALL →</div>
      </div>

      <div style={{ background: '#fff', borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, marginTop: 6 }}>
        {MOCK.ORDERS.slice(0, 4).map((o, i, arr) => (
          <div key={o.no} style={{
            display: 'grid', gridTemplateColumns: '1fr auto',
            padding: '11px 18px', alignItems: 'center', gap: 10,
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
              <div style={{ marginTop: 3 }}>
                <Pill
                  tone={o.status === 'delivered' ? 'ok' : o.status === 'billed' ? 'green' : o.status === 'draft' ? 'neutral' : 'warn'}
                  size="sm"
                >{o.status === 'pending-won' ? 'PENDING' : o.status.toUpperCase()}</Pill>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Bottom tab */}
      <BottomTabs active="home" />
    </PhoneScreen>
  );
}

function BottomTabs({ active = 'home' }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: (c) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1v-9z" stroke={c} strokeWidth="2" strokeLinejoin="round"/></svg> },
    { id: 'search', label: 'Stock', icon: (c) => Icon.search(20, c) },
    { id: 'order', label: 'New', icon: (c) => Icon.plus(20, c), primary: true },
    { id: 'orders', label: 'Orders', icon: (c) => Icon.doc(20, c) },
    { id: 'me', label: 'Me', icon: (c) => Icon.user(20, c) },
  ];
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
      padding: '8px 6px 24px', background: '#fff', borderTop: `1px solid ${T.line}`,
    }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        const c = t.primary ? '#fff' : isActive ? T.green : T.ink4;
        return (
          <div key={t.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{
              width: t.primary ? 44 : 32, height: t.primary ? 44 : 32,
              borderRadius: t.primary ? 12 : 6,
              background: t.primary ? T.green : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{t.icon(c)}</div>
            <div style={{ fontSize: 10, color: isActive ? T.green : T.ink4, fontWeight: 600 }}>{t.label}</div>
          </div>
        );
      })}
    </div>
  );
}

window.LoginScreen = LoginScreen;
window.HomeScreen = HomeScreen;
window.PhoneScreen = PhoneScreen;
window.StockRibbon = StockRibbon;
window.BottomTabs = BottomTabs;
