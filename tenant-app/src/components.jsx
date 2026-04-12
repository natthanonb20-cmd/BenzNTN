export const C = {
  bg: "#0F0F13", card: "#16161D", cardBorder: "#2A2A38",
  accent: "#00C896", accentDim: "#00C89620", accentGlow: "#00C89640",
  warn: "#FFB547", warnDim: "#FFB54720",
  danger: "#FF5B5B", dangerDim: "#FF5B5B20",
  info: "#5B9BFF", infoDim: "#5B9BFF20",
  text: "#F0F0F8", muted: "#8888AA", line: "#06C755",
};

export const Tag = ({ color = C.accent, children }) => (
  <span style={{
    background: color + "22", color, borderRadius: 99,
    padding: "2px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
  }}>{children}</span>
);

export const Card = ({ children, style = {}, glow }) => (
  <div style={{
    background: C.card,
    border: `1px solid ${glow ? glow + "60" : C.cardBorder}`,
    borderRadius: 16, padding: 16,
    boxShadow: glow ? `0 0 24px ${glow}22` : "none",
    ...style,
  }}>{children}</div>
);

export const Pill = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    background: active ? C.accent : "transparent",
    color: active ? "#0F0F13" : C.muted,
    border: `1px solid ${active ? C.accent : C.cardBorder}`,
    borderRadius: 99, padding: "6px 16px",
    fontSize: 12, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", transition: "all 0.2s", whiteSpace: "nowrap",
  }}>{label}</button>
);

export const Btn = ({ children, onClick, color = C.accent, outline, style = {}, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: "100%", border: outline ? `1px solid ${color}` : "none",
    borderRadius: 10, padding: "11px",
    background: outline ? "transparent" : color,
    color: outline ? color : "#0F0F13",
    fontWeight: 800, fontSize: 13, cursor: "pointer",
    fontFamily: "inherit", opacity: disabled ? .5 : 1,
    ...style,
  }}>{children}</button>
);
