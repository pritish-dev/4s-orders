// 4S Interiors logo / brand mark — placeholder, original
function FSLogo({ size = 28, dark = false, mark = true, wordmark = true }) {
  const ink = dark ? '#FAFAF8' : T.ink;
  const accent = T.green;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: T.sans }}>
      {mark && (
        <div style={{
          width: size, height: size, borderRadius: 6,
          background: accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.mono, fontWeight: 700, fontSize: size * 0.46,
          letterSpacing: -0.5, position: 'relative',
        }}>
          <span>4S</span>
          <div style={{
            position: 'absolute', right: 3, bottom: 3,
            width: 5, height: 5, borderRadius: 1, background: '#fff', opacity: 0.85,
          }} />
        </div>
      )}
      {wordmark && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontSize: size * 0.55, fontWeight: 700, color: ink, letterSpacing: -0.3 }}>
            4S Interiors
          </span>
          <span style={{ fontSize: size * 0.34, color: T.ink4, fontFamily: T.mono, marginTop: 3, letterSpacing: 0.5 }}>
            PATIA · BBSR
          </span>
        </div>
      )}
    </div>
  );
}

// Common UI atoms
function Pill({ children, tone = 'neutral', mono = false, size = 'md' }) {
  const map = {
    neutral: { bg: T.paper2, fg: T.ink2, bd: T.line },
    ok: { bg: T.okSoft, fg: T.ok, bd: '#B7DBC1' },
    warn: { bg: T.warnSoft, fg: T.warn, bd: '#E6CC95' },
    bad: { bg: T.badSoft, fg: T.bad, bd: '#E0B7AE' },
    green: { bg: T.greenSoft, fg: T.green, bd: T.greenLine },
    ink: { bg: T.ink, fg: '#fff', bd: T.ink },
  };
  const c = map[tone];
  const s = size === 'sm' ? { fs: 10, px: 6, py: 2, h: 16 } : { fs: 11, px: 8, py: 3, h: 20 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      height: s.h, padding: `0 ${s.px}px`, borderRadius: 4,
      background: c.bg, color: c.fg, border: `1px solid ${c.bd}`,
      fontFamily: mono ? T.mono : T.sans, fontSize: s.fs, fontWeight: 600,
      letterSpacing: mono ? 0 : 0.2, textTransform: mono ? 'none' : 'uppercase',
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Btn({ children, primary, danger, ghost, full, size = 'md', icon }) {
  const h = size === 'lg' ? 52 : size === 'sm' ? 32 : 44;
  const fs = size === 'lg' ? 16 : size === 'sm' ? 13 : 14;
  let bg = T.card, fg = T.ink, bd = T.line2;
  if (primary) { bg = T.green; fg = '#fff'; bd = T.green; }
  if (danger) { bg = T.bad; fg = '#fff'; bd = T.bad; }
  if (ghost) { bg = 'transparent'; fg = T.ink; bd = 'transparent'; }
  return (
    <button style={{
      height: h, padding: '0 14px', borderRadius: 6,
      background: bg, color: fg, border: `1px solid ${bd}`,
      fontFamily: T.sans, fontWeight: 600, fontSize: fs, letterSpacing: -0.1,
      width: full ? '100%' : undefined, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      {icon}
      {children}
    </button>
  );
}

// Generic field row used in order form
function Field({ label, value, mono, hint, required, action, multiline }) {
  return (
    <div style={{ borderBottom: `1px solid ${T.line}`, padding: '11px 14px', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: T.ink4, letterSpacing: 0.8,
          textTransform: 'uppercase', fontFamily: T.sans,
        }}>{label}{required && <span style={{ color: T.bad, marginLeft: 3 }}>*</span>}</span>
        {action && (
          <span style={{ fontSize: 11, color: T.green, fontWeight: 600, fontFamily: T.sans }}>{action}</span>
        )}
      </div>
      <div style={{
        fontSize: multiline ? 14 : 15,
        fontFamily: mono ? T.mono : T.sans,
        color: value ? T.ink : T.ink4,
        fontWeight: mono ? 500 : 400,
        lineHeight: multiline ? '20px' : '22px',
        whiteSpace: multiline ? 'pre-line' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{value || 'Tap to fill'}</div>
      {hint && <div style={{ fontSize: 11, color: T.ink4, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

// Stock chip showing branch + count
function StockChip({ branch, count, low }) {
  const tone = count === 0 ? 'bad' : low ? 'warn' : 'ok';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 0,
      borderRadius: 4, overflow: 'hidden',
      border: `1px solid ${tone === 'bad' ? '#E0B7AE' : tone === 'warn' ? '#E6CC95' : '#B7DBC1'}`,
      fontFamily: T.mono, fontSize: 10, fontWeight: 600,
      height: 18,
    }}>
      <span style={{
        background: T.ink, color: '#fff', padding: '0 5px',
        height: '100%', display: 'inline-flex', alignItems: 'center',
        letterSpacing: 0.5,
      }}>{branch}</span>
      <span style={{
        background: tone === 'bad' ? T.badSoft : tone === 'warn' ? T.warnSoft : T.okSoft,
        color: tone === 'bad' ? T.bad : tone === 'warn' ? T.warn : T.ok,
        padding: '0 6px', height: '100%', display: 'inline-flex', alignItems: 'center',
      }}>{count}</span>
    </span>
  );
}

// Tiny SVG icon set — geometric, no skeuomorphism
const Icon = {
  search: (s = 16, c = T.ink2) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke={c} strokeWidth="2"/>
      <path d="M20 20l-4-4" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  plus: (s = 16, c = '#fff') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke={c} strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  ),
  refresh: (s = 16, c = T.ink2) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M3 12a9 9 0 0115.5-6.3M21 4v5h-5M21 12a9 9 0 01-15.5 6.3M3 20v-5h5" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  filter: (s = 16, c = T.ink2) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16M7 12h10M10 18h4" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  doc: (s = 16, c = T.ink2) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M6 3h8l4 4v14H6z" stroke={c} strokeWidth="2" strokeLinejoin="round"/>
      <path d="M14 3v4h4" stroke={c} strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  ),
  whatsapp: (s = 16, c = '#fff') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="M12 2a10 10 0 00-8.5 15.2L2 22l4.9-1.4A10 10 0 1012 2zm5.2 14c-.2.6-1.3 1.2-1.8 1.3-.5.1-1.1.1-1.7-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.4-5.1-4.6-.2-.2-1.2-1.6-1.2-3 0-1.4.8-2.1 1-2.4.3-.3.6-.4 1-.4h.7c.2 0 .5 0 .8.6.3.7 1 2.4 1.1 2.5.1.2.1.4 0 .6-.1.2-.2.3-.4.5-.2.2-.3.3-.5.5-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.4 1.5 2.7 1.6.3.2.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.3.7-.2.3.1 2 1 2.3 1.1.3.2.5.2.6.4.1.2.1.7-.1 1.4z"/>
    </svg>
  ),
  qr: (s = 16, c = T.ink2) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" stroke={c} strokeWidth="2"/>
      <rect x="14" y="3" width="7" height="7" stroke={c} strokeWidth="2"/>
      <rect x="3" y="14" width="7" height="7" stroke={c} strokeWidth="2"/>
      <rect x="14" y="14" width="3" height="3" fill={c}/>
      <rect x="18" y="18" width="3" height="3" fill={c}/>
    </svg>
  ),
  bolt: (s = 14, c = T.warn) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></svg>
  ),
  check: (s = 14, c = T.ok) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-11" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  user: (s = 16, c = T.ink2) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={c} strokeWidth="2"/>
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  share: (s = 16, c = '#fff') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="12" r="3" stroke={c} strokeWidth="2"/>
      <circle cx="18" cy="6" r="3" stroke={c} strokeWidth="2"/>
      <circle cx="18" cy="18" r="3" stroke={c} strokeWidth="2"/>
      <path d="M8.5 10.5l7-3M8.5 13.5l7 3" stroke={c} strokeWidth="2"/>
    </svg>
  ),
  download: (s = 16, c = T.ink) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  cloud: (s = 16, c = T.ink2) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M7 18a4 4 0 010-8 6 6 0 0111.7 1.5A4 4 0 0118 18H7z" stroke={c} strokeWidth="2"/>
    </svg>
  ),
  edit: (s = 14, c = T.green) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 20h4l11-11-4-4L4 16v4z" stroke={c} strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  ),
};

Object.assign(window, { FSLogo, Pill, Btn, Field, StockChip, Icon });
