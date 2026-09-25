/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0f14",
          panel: "#111823",
          card: "#151d29",
          border: "#1f2937",
        },
        accent: {
          cyan: "#22d3ee",
          blue: "#3b82f6",
        },
        risk: {
          low: "#22c55e",
          medium: "#eab308",
          high: "#f97316",
          critical: "#ef4444",
        },
      },
    },
  },
  plugins: [],
}

