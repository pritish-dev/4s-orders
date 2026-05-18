// ─────────── 6. ORDER HISTORY
function HistoryScreen() {
  const orders = MOCK.ORDERS;
  return (
    <PhoneScreen bg={T.paper}>
      <div style={{ height: 54 }} />
      <div style={{ padding: '14px 18px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 11, color: T.ink4, fontFamily: T.mono, letterSpacing: 1 }}>LEDGER · 26 ORDERS</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginTop: 2 }}>Orders</div>
        </div>
        <Btn size="sm" icon={Icon.filter(14)}>Filter</Btn>
      </div>

      {/* Tabs */}
      <div style={{ padding: '6px 18px 10px', display: 'flex', gap: 6 }}>
        {[['All', 26, true], ['Pending WON', 2], ['Drafts', 1], ['Delivered', 12]].map(([l, n, a]) => (
          <span key={l} style={{
            padding: '6px 11px', borderRadius: 99,
            background: a ? T.ink : '#fff', color: a ? '#fff' : T.ink2,
            border: `1px solid ${a ? T.ink : T.line}`,
            fontSize: 12, fontWeight: 600, display: 'inline-flex', gap: 5, alignItems: 'center',
          }}>{l}<span style={{ fontFamily: T.mono, opacity: 0.7, fontSize: 11 }}>{n}</span></span>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Day group 1 */}
        <DayHead label="Today · Sat 09 May" total={171390} count={1} />
        {orders.slice(0, 1).map(o => <OrderRow key={o.no} o={o} />)}

        <DayHead label="Yesterday · Fri 08 May" total={35735} count={1} />
        {orders.slice(1, 2).map(o => <OrderRow key={o.no} o={o} />)}

        <DayHead label="Thu 07 May" total={345000} count={1} />
        {orders.slice(2, 3).map(o => <OrderRow key={o.no} o={o} />)}

        <DayHead label="Wed 06 May" total={113440} count={2} />
        {orders.slice(3, 5).map(o => <OrderRow key={o.no} o={o} />)}

        <DayHead label="Tue 05 May" total={156780} count={1} />
        {orders.slice(5, 6).map(o => <OrderRow key={o.no} o={o} />)}

        <div style={{ height: 24 }} />
      </div>

      <BottomTabs active="orders" />
    </PhoneScreen>
  );
}

function DayHead({ label, total, count }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '14px 18px 6px', background: T.paper,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: T.ink4, letterSpacing: 1.2, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.ink3 }}>{count} · ₹{total.toLocaleString('en-IN')}</span>
    </div>
  );
}

function OrderRow({ o }) {
  return (
    <div style={{
      background: '#fff', borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`,
      padding: '12px 18px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.ink2, fontWeight: 600 }}>{o.no}</span>
          {o.won
            ? <Pill tone="ok" mono size="sm">{o.won}</Pill>
            : <Pill tone="warn" size="sm">+ ADD WON</Pill>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{o.customer}</div>
        <div style={{ fontSize: 11, color: T.ink4, fontFamily: T.mono, marginTop: 2 }}>{o.salesExec} · {o.status.toUpperCase()}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 16, fontFamily: T.mono, fontWeight: 700, color: T.ink, letterSpacing: -0.4 }}>
          ₹{o.amt.toLocaleString('en-IN')}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
          <span style={{ width: 28, height: 24, borderRadius: 4, background: T.paper2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.doc(13)}</span>
          <span style={{ width: 28, height: 24, borderRadius: 4, background: T.paper2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.share(13, T.ink)}</span>
          <span style={{ width: 28, height: 24, borderRadius: 4, background: '#25D36622', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.whatsapp(13, '#25D366')}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────── 7. SETTINGS / SYNC
function SettingsScreen() {
  return (
    <PhoneScreen bg={T.paper}>
      <div style={{ height: 54 }} />
      <div style={{ padding: '14px 18px 12px' }}>
        <div style={{ fontSize: 11, color: T.ink4, fontFamily: T.mono, letterSpacing: 1 }}>SETTINGS</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginTop: 2 }}>Sync & data</div>
      </div>

      {/* Big sync card */}
      <div style={{ padding: '0 18px 14px' }}>
        <div style={{
          background: '#fff', border: `1px solid ${T.line}`, borderRadius: 8, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: T.ink4, fontWeight: 700, letterSpacing: 0.8 }}>STOCK SHEET</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 3, letterSpacing: -0.3 }}>Stock Master · 09 May</div>
              <div style={{ fontSize: 11, color: T.ink3, marginTop: 4, lineHeight: 1.4 }}>
                Auto-pulled from <b>orders@4sinteriors.in</b><br/>every day at <b>11:00 AM</b> after Godrej email.
              </div>
            </div>
            <Pill tone="ok" mono>FRESH</Pill>
          </div>

          <div style={{
            marginTop: 12, padding: '10px 12px', background: T.paper, border: `1px solid ${T.line}`,
            borderRadius: 6, fontFamily: T.mono, fontSize: 11,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: T.ink2 }}>
              <span>SHEET DATE</span><span style={{ fontWeight: 700, color: T.ink }}>09 May 2026</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: T.ink2, marginTop: 4 }}>
              <span>FETCHED</span><span style={{ fontWeight: 700, color: T.ink }}>11:02:14 AM</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: T.ink2, marginTop: 4 }}>
              <span>ROWS</span><span style={{ fontWeight: 700, color: T.ink }}>184 SKUs · 4 branches</span>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Btn primary full icon={Icon.refresh(15, '#fff')}>Force sync now</Btn>
          </div>
        </div>
      </div>

      {/* Price lists */}
      <div style={{ padding: '0 18px 8px' }}>
        <div style={{ fontSize: 10, color: T.ink4, fontWeight: 700, letterSpacing: 1.2, marginBottom: 6 }}>PRICE LISTS · DRIVE</div>
        <div style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 8, overflow: 'hidden' }}>
          {[
            { name: 'PL-Modular Kitchen', date: '02 May 2026', items: 412, fresh: true },
            { name: 'PL-Mattress', date: '28 Apr 2026', items: 87, fresh: true },
            { name: 'PL-Storage', date: '12 Apr 2026', items: 156, fresh: true },
            { name: 'PL-Bedroom', date: '04 Mar 2026', items: 203, stale: true },
          ].map((p, i, arr) => (
            <div key={p.name} style={{
              padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 11,
              borderBottom: i < arr.length - 1 ? `1px solid ${T.line}` : 'none',
            }}>
              <div style={{
                width: 30, height: 36, background: T.bad, color: '#fff',
                borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: T.mono, fontSize: 8, fontWeight: 700,
              }}>PDF</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{p.name}</div>
                <div style={{ fontSize: 11, color: T.ink4, fontFamily: T.mono }}>{p.date} · {p.items} items</div>
              </div>
              {p.stale ? <Pill tone="warn" size="sm">STALE</Pill> : <Pill tone="ok" size="sm">OK</Pill>}
            </div>
          ))}
        </div>
      </div>

      {/* Backup / Sheet */}
      <div style={{ padding: '14px 18px 8px' }}>
        <div style={{ fontSize: 10, color: T.ink4, fontWeight: 700, letterSpacing: 1.2, marginBottom: 6 }}>RECORD BACKUP</div>
        <div style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 8 }}>
          <SettingRow icon={Icon.cloud(16, T.green)} title="Google Sheet — Orders Master" sub="Every saved order is mirrored automatically" right={<Pill tone="ok" mono size="sm">LIVE</Pill>} />
          <SettingRow icon={Icon.edit(16)} title="Change-log Sheet" sub="Logs every edit · who · when · what" right={<Pill tone="ok" mono size="sm">LIVE</Pill>} divider />
          <SettingRow icon={Icon.user(16, T.ink2)} title="Team & roles" sub="6 salespeople · 1 manager" right={<span style={{ color: T.ink4, fontSize: 18, fontWeight: 300 }}>›</span>} divider />
        </div>
      </div>

      <div style={{ padding: '14px 18px 24px' }}>
        <Btn full danger size="md">Sign out</Btn>
        <div style={{ textAlign: 'center', fontSize: 10, color: T.ink4, marginTop: 12, fontFamily: T.mono }}>
          BUILD 2026.05.09 · DEVICE iPhone-14
        </div>
      </div>

      <BottomTabs active="me" />
    </PhoneScreen>
  );
}

function SettingRow({ icon, title, sub, right, divider }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderTop: divider ? `1px solid ${T.line}` : 'none',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 6, background: T.paper,
        border: `1px solid ${T.line}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{title}</div>
        <div style={{ fontSize: 11, color: T.ink4 }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}

window.HistoryScreen = HistoryScreen;
window.SettingsScreen = SettingsScreen;
