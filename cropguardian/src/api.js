// Thin wrapper around fetch() for the CropGuardian AI FastAPI backend
// (api/main.py). Every polling loop in the dashboard goes through this so a
// backend that's temporarily down or unreachable degrades to `null` instead
// of throwing and crashing a setInterval loop.

export const API_BASE_URL = "http://localhost:8000";

export async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, options);
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return null;
  }
}

export default apiFetch;
