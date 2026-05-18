// ─────────── 3. ITEM SEARCH / STOCK
function SearchScreen() {
  const items = MOCK.ITEMS;
  return (
    <PhoneScreen bg={T.paper}>
      <div style={{ height: 54 }} />
      <StockRibbon />

      {/* Header */}
      <div style={{ padding: '14px 18px 8px' }}>
        <div style={{ fontSize: 11, color: T.ink4, fontFamily: T.mono, letterSpacing: 1 }}>STOCK · 184 SKUs</div>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5, marginTop: 2 }}>Search items</div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '0 18px 10px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: '#fff',
          border: `1.5px solid ${T.green}`, borderRadius: 8,
          boxShadow: `0 0 0 4px ${T.greenSoft}`,
        }}>
          {Icon.search(18)}
          <span style={{ fontSize: 15, color: T.ink, fontWeight: 500, flex: 1 }}>Slide</span>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.ink4 }}>2 results</span>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ padding: '0 18px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {['All', 'In stock', 'Storage', 'Mattress', 'Modular Kitchen', 'Bedroom'].map((c, i) => (
          <span key={c} style={{
            padding: '5px 11px', borderRadius: 99,
            background: i === 0 ? T.ink : '#fff',
            color: i === 0 ? '#fff' : T.ink2,
            border: `1px solid ${i === 0 ? T.ink : T.line}`,
            fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          }}>{c}</span>
        ))}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderTop: `1px solid ${T.line}` }}>
        {items.slice(0, 5).map((it, i) => {
          const total = it.stock.reduce((s, x) => s + x.q, 0);
          const oos = total === 0;
          return (
            <div key={it.code} style={{
              padding: '12px 18px', borderBottom: `1px solid ${T.line}`, position: 'relative',
              opacity: oos ? 0.65 : 1,
            }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {/* placeholder image */}
                <div style={{
                  width: 56, height: 56, borderRadius: 4, flexShrink: 0,
                  background: `repeating-linear-gradient(135deg, ${T.paper2} 0 6px, ${T.paper} 6px 12px)`,
                  border: `1px solid ${T.line}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: T.mono, fontSize: 9, color: T.ink4,
                }}>IMG</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.ink2, fontWeight: 600 }}>{it.code}</span>
                    <Pill tone="neutral" size="sm">{it.cat.toUpperCase()}</Pill>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.3, marginBottom: 5 }}>
                    {it.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    {it.stock.map(s => <StockChip key={s.b} branch={s.b} count={s.q} low={s.q > 0 && s.q < 2} />)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 9, color: T.ink4, fontWeight: 600, letterSpacing: 0.5 }}>CPL</div>
                  <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>
                    ₹{(it.cpl/1000).toFixed(1)}k
                  </div>
                  <div style={{ fontSize: 9, color: T.ink4, fontFamily: T.mono, marginTop: 1 }}>PL · {it.cat.slice(0, 4).toUpperCase()}</div>
                </div>
              </div>
              {oos && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                }}><Pill tone="bad" size="sm">OUT OF STOCK</Pill></div>
              )}
            </div>
          );
        })}

        {/* zero-state hint at bottom */}
        <div style={{ padding: 18, textAlign: 'center', fontSize: 11, color: T.ink4, fontFamily: T.mono }}>
          PRICES PULLED FROM PL-MODULAR.PDF · 09 MAY
        </div>
      </div>

      <BottomTabs active="search" />
    </PhoneScreen>
  );
}

// ─────────── 4. NEW ORDER FORM
function OrderFormScreen() {
  const o = MOCK.SAMPLE_ORDER;
  const [items, setItems] = React.useState(o.items);
  const [showSearch, setShowSearch] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef(null);

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const cgst = Math.round(subtotal * 0.09);
  const sgst = Math.round(subtotal * 0.09);
  const total = subtotal + cgst + sgst;

  const filtered = MOCK.ITEMS.filter(it =>
    it.name.toLowerCase().includes(query.toLowerCase()) ||
    it.code.toLowerCase().includes(query.toLowerCase()) ||
    it.cat.toLowerCase().includes(query.toLowerCase())
  );

  // Native event listener — more reliable than React onChange on mobile browsers
  React.useEffect(() => {
    if (!showSearch) return;
    const el = inputRef.current;
    if (!el) return;
    const handler = (e) => setQuery(e.target.value);
    el.addEventListener('input', handler);
    setTimeout(() => el.focus(), 150);
    return () => el.removeEventListener('input', handler);
  }, [showSearch]);

  function addItem(it) {
    setItems(prev => [...prev, {
      code: it.code,
      name: it.name,
      qty: 1,
      cpl: it.cpl,
      total: it.cpl,
      disc: '0%',
      branch: (it.stock.find(s => s.q > 0) || it.stock[0])?.b || '—',
    }]);
    setShowSearch(false);
    setQuery('');
  }

  function openSearch() {
    setShowSearch(true);
    setQuery('');
  }

  function closeSearch() {
    setShowSearch(false);
    setQuery('');
  }

  const appBar = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 14px 10px', background: T.paper,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6, background: '#fff',
          border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: T.ink, fontWeight: 600,
        }}>‹</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.4 }}>New order</div>
          <div style={{ fontSize: 10, color: T.ink4, fontFamily: T.mono }}>DRAFT · {o.no}</div>
        </div>
      </div>
      <Pill tone="warn" size="sm">UNSAVED</Pill>
    </div>
  );

  if (showSearch) {
    return (
      <PhoneScreen bg={T.paper}>
        <div style={{ height: 54 }} />

        {/* Search panel header */}
        <div style={{ padding: '10px 14px 12px', background: T.paper, borderBottom: `1px solid ${T.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div
              onClick={closeSearch}
              style={{
                width: 32, height: 32, borderRadius: 6, background: '#fff',
                border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: T.ink, fontWeight: 600, cursor: 'pointer',
              }}
            >‹</div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>Add item to order</div>
          </div>

          {/* Live search bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', background: '#fff',
            border: `1.5px solid ${T.green}`, borderRadius: 8,
            boxShadow: `0 0 0 4px ${T.greenSoft}`,
          }}>
            {Icon.search(18)}
            <input
              ref={inputRef}
              defaultValue=""
              placeholder="Search by name, code or category…"
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, flex: 1, fontFamily: T.sans, color: T.ink,
              }}
            />
            {query.length > 0 && (
              <span
                onClick={() => {
                  setQuery('');
                  if (inputRef.current) inputRef.current.value = '';
                }}
                style={{ cursor: 'pointer', fontSize: 14, color: T.ink4, lineHeight: 1 }}
              >✕</span>
            )}
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.ink4 }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Item results list */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 12, color: T.ink4, fontFamily: T.mono }}>
              NO ITEMS MATCH "{query.toUpperCase()}"
            </div>
          ) : (
            filtered.map(it => {
              const stockTotal = it.stock.reduce((s, x) => s + x.q, 0);
              const alreadyAdded = items.some(i => i.code === it.code);
              return (
                <div
                  key={it.code}
                  onClick={() => !alreadyAdded && addItem(it)}
                  style={{
                    padding: '12px 14px', borderBottom: `1px solid ${T.line}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                    cursor: alreadyAdded ? 'default' : 'pointer',
                    opacity: stockTotal === 0 ? 0.55 : 1,
                    background: alreadyAdded ? T.greenSoft : '#fff',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontFamily: T.mono, fontSize: 10, color: T.ink4, fontWeight: 600 }}>{it.code}</span>
                      <Pill tone="neutral" size="sm">{it.cat.toUpperCase()}</Pill>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.3, marginBottom: 5 }}>
                      {it.name}
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {it.stock.map(s => <StockChip key={s.b} branch={s.b} count={s.q} low={s.q > 0 && s.q < 2} />)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: T.ink, letterSpacing: -0.3 }}>
                      ₹{(it.cpl / 1000).toFixed(1)}k
                    </div>
                    {alreadyAdded ? (
                      <div style={{ fontSize: 11, color: T.green, fontWeight: 700, marginTop: 5 }}>ADDED ✓</div>
                    ) : (
                      <div style={{
                        marginTop: 5, padding: '3px 8px', background: T.green, color: '#fff',
                        borderRadius: 4, fontSize: 11, fontWeight: 700, textAlign: 'center',
                      }}>+ ADD</div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          <div style={{ padding: 18, textAlign: 'center', fontSize: 11, color: T.ink4, fontFamily: T.mono }}>
            PRICES PULLED FROM PL-MODULAR.PDF · 09 MAY
          </div>
        </div>
      </PhoneScreen>
    );
  }

  return (
    <PhoneScreen bg={T.paper}>
      <div style={{ height: 54 }} />
      {appBar}

      <StockRibbon />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Section: Customer */}
        <SectionHead n="01" label="Customer" />
        <Field label="P.O. Reference No." value={o.poRef} mono required />
        <Field label="Customer Name" value={o.customer} required />
        <Field label="Phone" value={o.phone} mono required action="CALL" />
        <Field label="Alt. Phone" value={o.alt} mono />
        <Field label="E-mail" value={o.email} hint="Optional · for digital order copy" />
        <Field label="Customer Code" value={o.customerCode} mono />
        <Field label="Lead Source" value={o.source} hint="Walk-in · Reference · Digital · Repeat" />

        {/* Section: Address */}
        <SectionHead n="02" label="Address" />
        <Field label="Billing Address" value={o.billing} multiline required />
        <Field label="Delivery Address" value={o.delivery} multiline action="SAME AS BILLING" />
        <Field label="Lift available" value={o.liftAvailable} hint="Adds installation handling fee if no" />

        {/* Section: Items */}
        <SectionHead n="03" label={`Items · ${items.length}`} action="+ ADD ITEM" onAction={openSearch} />

        <div style={{ background: '#fff' }}>
          {items.map((it, i) => (
            <div key={it.code + i} style={{
              padding: '11px 14px', borderBottom: `1px solid ${T.line}`,
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'flex-start',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.ink2, fontWeight: 600 }}>{it.code}</span>
                  <StockChip branch={it.branch} count={3} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{it.name}</div>
                <div style={{ display: 'flex', gap: 14, marginTop: 5, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 10, color: T.ink4, fontWeight: 700 }}>QTY</span>
                  <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700 }}>{it.qty}</span>
                  <span style={{ fontSize: 10, color: T.ink4, fontWeight: 700, marginLeft: 8 }}>CPL</span>
                  <span style={{ fontFamily: T.mono, fontSize: 12 }}>₹{it.cpl.toLocaleString('en-IN')}</span>
                  <span style={{ fontSize: 10, color: T.ink4, fontWeight: 700, marginLeft: 8 }}>DISC</span>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.green }}>{it.disc}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, letterSpacing: -0.3 }}>
                  ₹{it.total.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 10, color: T.green, fontWeight: 600, marginTop: 6 }}>EDIT</div>
              </div>
            </div>
          ))}

          {/* Add item row — now clickable */}
          <div
            onClick={openSearch}
            style={{
              padding: '14px', display: 'flex', alignItems: 'center', gap: 10,
              background: T.greenSoft, color: T.green, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {Icon.search(16, T.green)}
            <span style={{ fontSize: 13 }}>Search & add another item</span>
            <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11 }}>SCAN ⌘</span>
          </div>
        </div>

        {/* Section: Commercials */}
        <SectionHead n="04" label="Commercials" />
        <Field label="Discount Code" value={o.discountCode} mono required />
        <Field label="HFP / HFC / HFS / RFD" value="—" mono hint="Scheme code, if applicable" />
        <Field label="Planned Delivery" value={o.plannedDly} mono required />
        <Field label="Specific Instructions" value={o.installNote} multiline />

        {/* Section: Payment */}
        <SectionHead n="05" label="Payment" />
        <Field label="Payment Mode" value={o.paymentMode} required />
        <Field label="Earnest Amount" value={`₹${o.earnest.toLocaleString('en-IN')}`} mono required />
        <Field label="Receipt No. & Date" value="4522 · 09.05.26" mono />
        <Field label="Follow-up Date" value={o.followUp} mono hint="Reminder will trigger at 10:00 AM" />

        {/* Section: Sales / Internal */}
        <SectionHead n="06" label="Internal" />
        <Field label="Salesperson" value={o.salesExec} mono />
        <Field label="Salesman Code" value="SW-04" mono />
        <Field label="Customer Signature" value="Captured ✓" action="RE-CAPTURE" />
        <Field label="Sales Exe Signature" value="Auto from login" />
        <Field label="WON / Godrej SO" value="Pending — add later" hint="Updatable after Godrej confirms" />

        {/* Totals card */}
        <div style={{ padding: '14px 14px 18px' }}>
          <div style={{
            background: T.ink, color: '#fff', borderRadius: 8, padding: '14px 16px',
            fontFamily: T.mono,
          }}>
            <Row k="Subtotal" v={`₹${subtotal.toLocaleString('en-IN')}`} />
            <Row k="CGST 9%" v={`₹${cgst.toLocaleString('en-IN')}`} />
            <Row k="SGST 9%" v={`₹${sgst.toLocaleString('en-IN')}`} />
            <div style={{ height: 1, background: 'rgba(255,255,255,0.18)', margin: '8px 0' }} />
            <Row k="TOTAL" v={`₹${total.toLocaleString('en-IN')}`} big />
            <Row k="Earnest paid" v={`₹${o.earnest.toLocaleString('en-IN')}`} muted />
            <Row k="Balance" v={`₹${(total - o.earnest).toLocaleString('en-IN')}`} accent />
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 14px',
        background: '#fff', borderTop: `1px solid ${T.line}`,
      }}>
        <Btn>Save draft</Btn>
        <Btn primary full size="md">Generate PDF →</Btn>
      </div>
    </PhoneScreen>
  );
}

function SectionHead({ n, label, action, onAction }) {
  return (
    <div style={{
      padding: '14px 18px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      background: T.paper,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.ink4, fontWeight: 700 }}>{n}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.ink2, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
      </div>
      {action && (
        <span
          onClick={onAction}
          style={{ fontSize: 11, color: T.green, fontWeight: 700, cursor: onAction ? 'pointer' : 'default' }}
        >{action}</span>
      )}
    </div>
  );
}

function Row({ k, v, big, muted, accent }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '3px 0',
      fontSize: big ? 18 : 13,
      fontWeight: big ? 700 : 500,
      color: muted ? 'rgba(255,255,255,0.6)' : accent ? '#FFD27A' : '#fff',
      letterSpacing: -0.3,
    }}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}

window.SearchScreen = SearchScreen;
window.OrderFormScreen = OrderFormScreen;
window.SectionHead = SectionHead;
