import type { Config } from "tailwindcss";

// As cores vêm de variáveis CSS (src/app/globals.css) para que o tema
// claro/escuro e a futura tela de identidade visual (Etapa 9) troquem a
// paleta sem mudar componentes.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        sunken: token("sunken"),
        ink: token("ink"),
        muted: token("muted"),
        line: token("line"),
        brand: token("brand"),
        "on-brand": token("on-brand"),
        accent: token("accent"),
        "accent-soft": token("accent-soft"),
        ok: token("ok"),
        "ok-soft": token("ok-soft"),
        warn: token("warn"),
        "warn-soft": token("warn-soft"),
        danger: token("danger"),
        "danger-soft": token("danger-soft"),
        heading: token("heading"),
        icon: token("icon"),
        "sidebar-bg": token("sidebar-bg"),
        "sidebar-text": token("sidebar-text"),
        "sidebar-muted": token("sidebar-muted"),
        "sidebar-active-bg": token("sidebar-active-bg"),
        "sidebar-active-text": token("sidebar-active-text"),
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        DEFAULT: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
