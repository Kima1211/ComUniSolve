import { useEffect, useState, useCallback } from "react";
import { api, apiPost } from "./api";
import { AuthContext } from "./auth-context";
import { clearDraft } from "./postDraft";

async function fetchMe() {
  try {
    return await api("/users/me", { method: "GET" });
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchMe().then((data) => {
      if (cancelled) return;
      setUser(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await fetchMe();
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost("/logout");
    } catch {
      // Clear the local state even if the request fails.
    }
    // A shared computer must not show the next person this user's unfinished post.
    clearDraft();
    setUser(null);
  }, []);

  const value = { user, loading, refreshUser, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
