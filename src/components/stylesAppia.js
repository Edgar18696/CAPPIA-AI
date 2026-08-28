export const colors = {
  primary: "#2563eb",
  secondary: "#38bdf8",

  success: "#16a34a",
  successDark: "#14532d",

  danger: "#dc2626",
  warning: "#f59e0b",

  background: "#020617",
  card: "#0f172a",

  border: "#334155",

  text: "#ffffff",
  textSecondary: "#cbd5e1",
};

export const radius = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
};

export const shadow = {
  card: "0 12px 28px rgba(0,0,0,.25)",
  button: "0 8px 20px rgba(37,99,235,.25)",
};

export const transition = {
  default: "all .2s ease",
};

export const cardStyle = {
  background: colors.card,
  border: `1px solid ${colors.primary}`,
  borderRadius: radius.lg,
  padding: "20px",
  color: colors.text,
  boxShadow: shadow.card,
};

const buttonBase = {
  border: "none",
  padding: "12px 20px",
  borderRadius: radius.md,
  cursor: "pointer",
  fontWeight: "bold",
  fontSize: "14px",
  transition: transition.default,
};

export const buttonBlue = {
  ...buttonBase,
  background:
    "linear-gradient(135deg,#2563eb,#38bdf8)",
  color: "#ffffff",
  boxShadow: shadow.button,
};

export const buttonGreen = {
  ...buttonBase,
  background:
    "linear-gradient(135deg,#16a34a,#22c55e)",
  color: "#ffffff",
};

export const buttonRed = {
  ...buttonBase,
  background:
    "linear-gradient(135deg,#dc2626,#ef4444)",
  color: "#ffffff",
};

export const buttonGray = {
  ...buttonBase,
  background: "#334155",
  color: "#ffffff",
};

export const buttonYellow = {
  ...buttonBase,
  background:
    "linear-gradient(135deg,#d97706,#f59e0b)",
  color: "#ffffff",
};