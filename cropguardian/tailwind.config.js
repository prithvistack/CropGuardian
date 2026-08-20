/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Primary brand green (professional, forest-toned)
        brand: {
          50: "#f1f7f2",
          100: "#dcebe0",
          200: "#b8d6c0",
          300: "#8fbd9d",
          400: "#5f9e73",
          500: "#3d8055",
          600: "#2c6642",
          700: "#235235",
          800: "#1c4129",
          900: "#16341f",
        },
        // Earth brown (warm, classy neutral accent)
        earth: {
          50: "#f8f4f0",
          100: "#eee2d5",
          200: "#dcc4a8",
          300: "#c6a17a",
          400: "#ac7f52",
          500: "#8f6339",
          600: "#6f4e2e",
          700: "#5a3e26",
          800: "#47311e",
          900: "#382717",
        },
        // Gold accent (luxury highlight, buttons/badges/borders)
        gold: {
          50: "#fbf6ea",
          100: "#f5e9c8",
          200: "#ead08e",
          300: "#dcb75f",
          400: "#c99f3f",
          500: "#b0842c",
          600: "#916a22",
          700: "#73531b",
          800: "#5c4317",
          900: "#4a3613",
        },
        // Lighter, fresher green for accents against the deep brand green
        sage: {
          50: "#f4f8f2",
          100: "#e4efdf",
          200: "#c8dfbe",
          300: "#a7cb96",
          400: "#84b46e",
          500: "#679a51",
          600: "#4f7d3d",
          700: "#3f6431",
          800: "#335028",
          900: "#2a4121",
        },
        // Azure blue (crisp, professional accent — used sparingly now)
        azure: {
          50: "#eff6fb",
          100: "#dbeaf5",
          200: "#b3d4ea",
          300: "#82b8db",
          400: "#4f97c4",
          500: "#2f7aab",
          600: "#235f88",
          700: "#1d4c6d",
          800: "#183f59",
          900: "#15354b",
        },

        // ---- Pastel palette (main app, post-login) ----
        mint: {
          50: "#eafbf1", 100: "#d2f5e1", 200: "#a8ecc7", 300: "#7bdfac",
          400: "#55ce93", 500: "#34b87c", 600: "#279966", 700: "#1f7b53",
          800: "#1a6244", 900: "#164f38",
        },
        coral: {
          50: "#fff1ee", 100: "#ffdfd8", 200: "#ffc0b3", 300: "#ff9d8a",
          400: "#ff7a63", 500: "#f65e45", 600: "#da4530", 700: "#b33726",
          800: "#8f2d20", 900: "#75261b",
        },
        sky: {
          50: "#eff8ff", 100: "#dbf0ff", 200: "#b6e1ff", 300: "#85ccff",
          400: "#57b4ff", 500: "#2e97f0", 600: "#1f79cc", 700: "#1b62a6",
          800: "#1a5286", 900: "#19456f",
        },
        lilac: {
          50: "#f6f2ff", 100: "#ebe1ff", 200: "#d6c4ff", 300: "#bca0ff",
          400: "#a47dfa", 500: "#8c5fee", 600: "#7847d1", 700: "#6238ac",
          800: "#4f2e8a", 900: "#402770",
        },
        sun: {
          50: "#fffbeb", 100: "#fff3c4", 200: "#ffe58a", 300: "#ffd34d",
          400: "#ffc120", 500: "#f2a609", 600: "#cc8703", 700: "#a66b04",
          800: "#85560a", 900: "#6e470d",
        },

        // ---- Sahyadri-inspired forest palette (dashboard v3) ----
        forest: {
          50: "#eef7ec", 100: "#d7ecd1", 200: "#b0d9a5", 300: "#83c073",
          400: "#5ba647", 500: "#3f8a2f", 600: "#2f6f24", 700: "#1e5128",
          800: "#183f1f", 900: "#0f3800", 950: "#081c00",
        },
        leaf: {
          50: "#f3fce8", 100: "#e2f8c8", 200: "#c5f094", 300: "#a3e463",
          400: "#80ed99", 500: "#6bd67e", 600: "#4e9f3d", 700: "#3d7d30",
          800: "#316426", 900: "#295220",
        },
        aqua: {
          50: "#eff9ff", 100: "#dcf1ff", 200: "#b8e4ff", 300: "#87d1ff",
          400: "#4db8f5", 500: "#0284c7", 600: "#0369a1", 700: "#075985",
          800: "#0c4a6e", 900: "#0a3a58",
        },
      },
    },
  },
  plugins: [],
};
