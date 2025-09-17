// frontend/src/apolloClient.js
import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

// Read token from localStorage (saved as JSON under "wpjwt")
function getAuthToken() {
  try {
    const raw = localStorage.getItem("wpjwt");
    if (!raw) return null;
    return JSON.parse(raw)?.authToken || null;
  } catch {
    return null;
  }
}

const httpLink = new HttpLink({
  // Prefer env; falls back to local WP
  uri: import.meta.env.VITE_WORDPRESS_GRAPHQL_URL || "http://localhost:8000/graphql",

  // JWT-only: do NOT send cookies
  credentials: "omit",

  // CORS is fine since we only send an Authorization header
  fetchOptions: { mode: "cors" },
});

// Attach Authorization: Bearer <token> when available
const authLink = setContext((_, { headers }) => {
  const token = getAuthToken();
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export default client;
