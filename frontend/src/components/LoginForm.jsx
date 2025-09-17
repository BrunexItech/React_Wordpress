// src/components/LoginForm.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { FiMail, FiLock, FiEye, FiEyeOff, FiLogIn } from "react-icons/fi";

// WPGraphQL JWT login mutation
const LOGIN_MUTATION = gql`
  mutation Login($username: String!, $password: String!) {
    login(input: { username: $username, password: $password }) {
      authToken
      refreshToken
      user {
        id
        username
        email
      }
    }
  }
`;

const LoginForm = ({ onSuccess }) => {
  const [identifier, setIdentifier] = useState(""); // username or email
  const [password, setPassword]   = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [error, setError]         = useState("");
  const navigate = useNavigate();

  const [doLogin, { loading }] = useMutation(LOGIN_MUTATION, {
    fetchPolicy: "no-cache",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!identifier || !password) {
      const msg = "Please enter your username/email and password.";
      setError(msg);
      toast.error(msg, { autoClose: 1500, position: "top-center" });
      return;
    }

    setError("");

    try {
      const { data } = await doLogin({
        variables: { username: identifier, password },
      });

      const payload = data?.login;
      if (!payload?.authToken) {
        throw new Error("Login failed. No token returned.");
      }

      // Persist tokens for the Apollo auth link
      localStorage.setItem(
        "wpjwt",
        JSON.stringify({
          authToken: payload.authToken,
          refreshToken: payload.refreshToken,
          user: payload.user,
        })
      );

      // Let the rest of the app know (optional)
      window.dispatchEvent(new CustomEvent("auth-changed", { detail: { user: payload.user } }));

      toast.success("Login successful!", { autoClose: 1500, position: "top-center" });

      // Give parent a chance to react
      onSuccess?.(payload);

      // Go home (or wherever you want)
      navigate("/");
    } catch (err) {
      // Try to surface GraphQL errors nicely
      const graphQLError =
        err?.graphQLErrors?.[0]?.message ||
        err?.message ||
        "Invalid credentials. Please try again.";
      setError(graphQLError);
      toast.error(graphQLError, { autoClose: 1500, position: "top-center" });
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative overflow-hidden rounded-2xl border bg-white/90 backdrop-blur p-6 md:p-8 shadow-xl">
        {/* Accent pill */}
        <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-blue-100/70" />
        <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-indigo-100/70" />

        {/* Header */}
        <div className="relative mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
            <FiLogIn size={22} />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Welcome back</h2>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to continue shopping and track your orders.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {String(error)}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative">
          {/* Username or Email */}
          <div>
            <label htmlFor="identifier" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">
              Username or Email
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <FiMail />
              </span>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
                placeholder="yourname or you@example.com"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">
              Password
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <FiLock />
              </span>
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                required
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>

            {/* Forgot password */}
            <div className="mt-2 text-left">
              <span className="text-sm text-gray-600">Forgot your </span>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200 rounded"
              >
                password
              </Link>
              <span className="text-sm text-gray-600">?</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="group relative inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : null}
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>

        {/* Footer link */}
        <p className="relative mt-5 text-center text-sm text-gray-600">
          Don’t have an account?{" "}
          <Link to="/register" className="font-medium text-blue-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
