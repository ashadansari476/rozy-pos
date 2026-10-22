/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg:          "rgb(255 255 255 / <alpha-value>)",
        bgGradient:  "linear-gradient(135deg, #E8DCC4 0%, #D4B896 100%)",
        surface:       "rgb(255 255 255 / <alpha-value>)",
        "surface-alt": "rgb(255 255 255 / <alpha-value>)",

        // Wood palette
        wood: {
          light:  "#D4B896",
          mid:    "#B8935A",
          dark:   "#8B5A2B",
          deep:   "#6B4423",
          edge:   "#A67F44",
        },

        // Brand colors (kept)
        primary:  { DEFAULT: "#8B1E1E", hover: "#A62626", light: "#F5E6E6" },
        accent:   { DEFAULT: "#D4A017", light: "#FFF2CC" },
        success:  "#2D7A4F",
        warning:  "#E67E22",
        danger:   "#C0392B",

        // Text
        ink: {
          DEFAULT: "#3A2410",
          muted:   "#6B4423",
          faint:   "#9B7A55",
          light:   "#FFF8E7",
        },

        border: "rgba(120, 80, 50, 0.2)",
      },
      fontFamily: {
        serif: ["Bricolage Grotesque", "Inter", "system-ui", "sans-serif"],
        sans:  ["Inter", "system-ui", "sans-serif"],
        mono:  ["JetBrains Mono", "monospace"],
      },
      borderRadius: { xl2: "18px" },
      boxShadow: {
        warm:  "0 10px 30px rgba(90, 50, 80, 0.16)",
        warmH: "0 24px 60px rgba(90, 50, 80, 0.30)",
      },
    },
  },
  plugins: [],
};