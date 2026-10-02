const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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

export function getErrorMessage(data, status) {
  const detail = data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (detail && typeof detail === "object" && !Array.isArray(detail) && detail.message) {
    return detail.message;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item.loc) ? item.loc.slice(1).join(".") : "";
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join(" | ");
  }

  return `Request failed (${status}). Please try again.`;
}

// `code` and `params` come from the backend (Services/errors.py) so the UI can show the error in its language.
export class ApiError extends Error {
  constructor(message, status, detail = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.code = detail && typeof detail === "object" && !Array.isArray(detail) ? detail.code ?? null : null;
    this.params = this.code ? detail.params ?? {} : {};
  }
}

async function send(path, options) {
  const headers = { ...(options.headers || {}) };

  // File uploads (FormData) must let the browser set Content-Type itself.
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

// The free backend sleeps when idle and takes up to a minute to wake. While it wakes, requests fail
// with a network error or a 502/503/504 from the proxy. Waiting and trying again fixes that.
// Only GET (reading) is retried: repeating a POST could post the same problem twice.
const WAKE_DELAYS_MS = [2000, 4000, 8000, 15000, 20000];

function isWaking(response) {
  return [502, 503, 504].includes(response.status);
}

async function sendWithWake(path, options) {
  const canRetry = (options.method || "GET").toUpperCase() === "GET";
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await send(path, options);
      if (!canRetry || !isWaking(response) || attempt >= WAKE_DELAYS_MS.length) return response;
    } catch (e) {
      if (!canRetry || attempt >= WAKE_DELAYS_MS.length) throw e;
    }
    await new Promise((resolve) => setTimeout(resolve, WAKE_DELAYS_MS[attempt]));
  }
}

export async function api(path, options = {}) {
  const { retryOn401 = true, ...fetchOptions } = options;

  let response = await sendWithWake(path, fetchOptions);

  if (retryOn401 && response.status === 401 && path !== "/refresh" && path !== "/login") {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await send(path, fetchOptions);
    }
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(getErrorMessage(data, response.status), response.status, data?.detail ?? null);
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

export function apiPostForm(path, formData) {
  return api(path, { method: "POST", body: formData });
}

export function imageUrl(url, width) {
  if (!url || !url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}

export function apiPatch(path, body) {
  return api(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiDelete(path) {
  return api(path, { method: "DELETE" });
}
