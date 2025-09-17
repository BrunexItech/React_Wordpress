// src/auth.js
const KEY = "wpjwt";

export function saveAuth({ authToken, refreshToken }) {
  localStorage.setItem(
    KEY,
    JSON.stringify({ authToken, refreshToken, savedAt: Date.now() })
  );
}

export function getAuth() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}
