# CropGuardian AI — Frontend

Operator dashboard for the [CropGuardian AI](../README.md) system — SIH prototype frontend for high-value tomato agriculture. Talks to the FastAPI backend in [../api/](../api) for sensor readings, disease analysis, rover control, and warehouse status.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173) in your browser. The dashboard sits behind a client-side password gate (`cropguardian2025`, hardcoded in `src/App.jsx`) — a demo access gate, not real authentication.

By default this expects the FastAPI backend (see the [root README](../README.md#running-the-full-stack)) running and reachable for API calls. For a single-origin setup, build the frontend and let the backend serve it directly — see below.

## Build for production

```bash
npm run build
npm run preview
```

## Stack

- React 18 + Vite
- Tailwind CSS
- Recharts (data visualization)
- lucide-react (icons)

## Structure

- `src/App.jsx` — the entire application (dashboard, disease detection, storage monitoring, spraying history, disease library, reports, settings)
- `src/main.jsx` — React entry point
- `src/index.css` — Tailwind directives
