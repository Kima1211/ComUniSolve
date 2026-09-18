import { useEffect, useState, useCallback } from "react";
import { api, apiPost } from "./api";
import { AuthContext } from "./auth-context";

// Asks the backend who this browser is. Returns the user, or null for a guest.
// It does not touch state itself - callers decide what to do with the answer.
async function fetchMe() {
  try {
    // retryOn401: false because a 401 here is the normal, expected answer for
    // a guest. Without it, every visitor would trigger a pointless /refresh.
    return await api("/users/me", { method: "GET", retryOn401: false });
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // null = nobody logged in
  const [loading, setLoading] = useState(true); // true until the first check finishes

  // Runs once when the app mounts. The cookie is httpOnly, so JavaScript
  // cannot read it - asking the server is the only way to find out.
  useEffect(() => {
    let cancelled = false;

    fetchMe().then((data) => {
      // StrictMode mounts twice in development, and a user can navigate away
      // mid-request. Without this flag the second, stale response could
      // overwrite the first - and React warns about setting state on a
      // component that is gone.
      if (cancelled) return;
      setUser(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // For explicit re-checks: after logging in, after verifying an email.
  // useCallback keeps it the same function object between renders, so a
  // component that lists it in a useEffect dependency array does not loop.
  const refreshUser = useCallback(async () => {
    const data = await fetchMe();
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost("/logout");
    } catch {
      // Even if the request fails, clear the local state. The user asked to be
      // logged out; leaving the UI showing them as signed in would be a lie.
    }
    setUser(null);
  }, []);

  const value = { user, loading, refreshUser, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
