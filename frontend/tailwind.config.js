/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        "cardinal-red": "#E41F35",
        "cardinal-red-hover": "#C91A2D",
        // Neutrals
        "near-black": "#27251F",
        "near-black-hover": "#3A372E",
        "warm-gray-med": "#948A85",
        "warm-gray-light": "#EFEFEF",
        // Accent (workhorse — UX-1). Keep in sync with tokens.css.
        accent: "#1F6787",
        "accent-hover": "#17536D",
        "accent-soft": "#E9F1F5",
        "accent-border": "#A8C8D6",
        // Pale end of the accent family
        "light-blue": "#BBDDE6",
        // Semantic
        success: "#2F6B4A",
        "success-soft": "#E9F2ED",
        "success-border": "#BFDACB",
        warning: "#9A6C08",
        "warning-soft": "#F7F0DC",
        "warning-border": "#E2D1A4",
        "danger-soft": "#FCEDEE",
        "danger-border": "#F2C0C6",
        // Structure
        border: "#E5E5E2",
        "border-strong": "#D8D6D2",
        "surface-tertiary": "#FBFBFA",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        // Pairs with line-height
        "page-title": ["28px", { lineHeight: "36px", letterSpacing: "-0.01em" }],
        "section-title": ["18px", { lineHeight: "26px", letterSpacing: "-0.005em" }],
        body: ["14px", { lineHeight: "20px" }],
        small: ["12px", { lineHeight: "16px" }],
      },
      spacing: {
        // Mirrors the 8px grid tokens
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(39,37,31,0.04), 0 0 0 1px rgba(39,37,31,0.06)",
        popover: "0 4px 12px rgba(39,37,31,0.08), 0 0 0 1px rgba(39,37,31,0.06)",
        modal: "0 16px 40px rgba(39,37,31,0.12), 0 0 0 1px rgba(39,37,31,0.06)",
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      transitionDuration: {
        hover: "120ms",
        toggle: "160ms",
        modal: "200ms",
      },
    },
  },
  plugins: [],
};
