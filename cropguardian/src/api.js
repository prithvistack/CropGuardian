// Thin wrapper around fetch() for the CropGuardian AI FastAPI backend
// (api/main.py). Every polling loop in the dashboard goes through this so a
// backend that's temporarily down or unreachable degrades to `null` instead
// of throwing and crashing a setInterval loop.

// Empty string == same origin as whatever served this page. The backend now
// serves this built frontend directly (see api/main.py's StaticFiles mount),
// so the dashboard and the API it calls always share one host:port -- no
// hardcoded IP to go stale every time the board changes networks, which is
// exactly the class of bug that kept breaking this before.
export const API_BASE_URL = "";

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
