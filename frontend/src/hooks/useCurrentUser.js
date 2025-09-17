// src/hooks/useCurrentUser.js
import { useEffect, useState } from "react";
import { api, getAccessToken, clearAuth, getUser as getCachedUser } from "../api";

/**
 * useCurrentUser hook
 *
 * WHAT IT DOES:
 * - Reads the last known user from localStorage for instant UI (no spinner).
 * - If an access token exists, it verifies the session by calling GET /api/auth/me/.
 * - Exposes { user, loading, error, refresh, signOut } to your components.
 * - Listens for "auth-changed" events so login/logout in other parts of the app instantly update this hook.
 */
export default function useCurrentUser({ auto = true } = {}) {
  // Start with cached user for instant paint (then confirm with server)
  const [user, setUser] = useState(() => getCachedUser());
  const [loading, setLoading] = useState(Boolean(getAccessToken()));
  const [error, setError] = useState("");

  // Re-fetch user from the API (verifies token + gets fresh user data)
  const refresh = async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await api.me(); // { id, username, email }
      localStorage.setItem("user", JSON.stringify(data)); // keep cache fresh
      setUser(data);
    } catch (e) {
      // Token likely invalid/expired → clear and surface a friendly message
      clearAuth();
      setUser(null);
      setError(e?.message || "Session expired.");
    } finally {
      setLoading(false);
    }
  };

  // Simple sign out helper
  const signOut = () => {
    clearAuth();
    setUser(null);
    setError("");
  };

  // Auto-refresh on mount and whenever auth changes elsewhere
  useEffect(() => {
    if (auto) refresh();
    const onAuth = () => refresh();
    window.addEventListener("auth-changed", onAuth);
    return () => window.removeEventListener("auth-changed", onAuth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading, error, refresh, signOut };
}
