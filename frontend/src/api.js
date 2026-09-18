// One place that knows how to talk to the ComUniSolve backend.
//
// Every component used to repeat the same four things: the base URL, the
// headers, credentials: "include", and its own way of reading errors. Four
// copies means four places to change when one of them is wrong - and they were
// already drifting apart. This file holds that knowledge once.

// import.meta.env is Vite's way of reading environment variables at build time.
// Variables must start with VITE_ to be exposed to browser code. The fallback
// keeps local development working with no .env file at all.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// While a refresh is already in flight, every other 401 waits on that same
// promise instead of starting its own. Without this, two components mounting at
// once (React StrictMode mounts everything twice in development) would fire two
// /refresh calls and write two rows into refresh_tokens for one real refresh.
let refreshInFlight = null;

function refreshSession() {
  if (refreshInFlight === null) {
    refreshInFlight = fetch(`${API_URL}/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// FastAPI returns errors in two different shapes, and the frontend has to
// survive both:
//   HTTPException  -> {"detail": "Invalid email or password"}        (a string)
//   Pydantic 422   -> {"detail": [{"loc": [...], "msg": "..."}, ...]} (an array)
// Passing that array straight into JSX crashes React with "Objects are not
// valid as a React child", so the whole page goes blank instead of showing a
// validation message. This function always returns a plain string.
export function getErrorMessage(data, status) {
  const detail = data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        // loc is like ["body", "password"]; the first entry is always the
        // request part, so the useful field name is whatever comes after it.
        const field = Array.isArray(item.loc) ? item.loc.slice(1).join(".") : "";
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join(" | ");
  }

  return `Request failed (${status}). Please try again.`;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function send(path, options) {
  const headers = { ...(options.headers || {}) };

  // Only declare a JSON body when there actually is one. Sending
  // Content-Type on a plain GET forces the browser into a CORS preflight
  // (an extra OPTIONS round trip) for no reason.
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include", // the auth cookies are httpOnly; without this the
    // browser will not attach them at all
  });
}

/**
 * Make a request to the backend.
 *
 * Returns the parsed JSON body on success. Throws an ApiError carrying a
 * human-readable message and the HTTP status on failure.
 *
 * On a 401 it calls /refresh once and replays the original request. That single
 * behaviour is what stops a tester from being silently logged out every 15
 * minutes when the access token expires.
 */
export async function api(path, options = {}) {
  // retryOn401 defaults to true. Pass false for calls where a 401 is a normal
  // answer rather than an expired session - /users/me for a guest, say.
  const { retryOn401 = true, ...fetchOptions } = options;

  let response = await send(path, fetchOptions);

  if (retryOn401 && response.status === 401 && path !== "/refresh" && path !== "/login") {
    const refreshed = await refreshSession();
    if (refreshed) {
      // Replay exactly once. If this attempt is also a 401, the session is
      // genuinely gone and retrying again would loop forever.
      response = await send(path, fetchOptions);
    }
  }

  // A 204 or an empty body has nothing to parse, so never let JSON.parse
  // failure masquerade as a request failure.
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(getErrorMessage(data, response.status), response.status);
  }

  return data;
}

export function apiGet(path) {
  return api(path, { method: "GET" });
}

export function apiPost(path, body) {
  return api(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiPatch(path, body) {
  return api(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
