// src/components/RegistrationForm.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { FiMail, FiUser, FiLock, FiEye, FiEyeOff, FiUserPlus } from "react-icons/fi";

/** GraphQL */
const REGISTER_USER = gql`
  mutation RegisterUser($username: String!, $email: String!, $password: String!) {
    registerUser(
      input: { username: $username, email: $email, password: $password }
    ) {
      user {
        id
        username
        email
      }
    }
  }
`;

const RegistrationForm = ({ onSuccess }) => {
  const [username, setUsername]               = useState("");
  const [email, setEmail]                     = useState("");
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd]                 = useState(false);
  const [showConfirmPwd, setShowConfirmPwd]   = useState(false);
  const [error, setError]                     = useState("");
  const navigate = useNavigate();

  const [registerUser, { loading }] = useMutation(REGISTER_USER, {
    fetchPolicy: "no-cache",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // basic client-side checks
    if (!username || !email || !password) {
      const msg = "Please fill in all required fields.";
      setError(msg);
      toast.error(msg, { autoClose: 1500, position: "top-center" });
      return;
    }
    if (password !== confirmPassword) {
      const msg = "Passwords do not match.";
      setError(msg);
      toast.error(msg, { autoClose: 1500, position: "top-center" });
      return;
    }

    setError("");

    try {
      // Create the WP user
      await registerUser({ variables: { username, email, password } });

      toast.success("Account created! Please log in.", {
        autoClose: 1500,
        position: "top-center",
      });

      // ✅ Redirect to login (no auto-login). Prefill username.
      navigate(`/login?username=${encodeURIComponent(username)}`);
      onSuccess?.();
    } catch (err) {
      const msg =
        err?.graphQLErrors?.[0]?.message ||
        err?.message ||
        "Registration failed.";
      setError(msg);
      toast.error(msg, { autoClose: 2000, position: "top-center" });
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative overflow-hidden rounded-2xl border bg-white/90 backdrop-blur p-6 md:p-8 shadow-xl">
        {/* Accents */}
        <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-indigo-100/70" />
        <div className="absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-blue-100/70" />

        {/* Header */}
        <div className="relative mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600">
            <FiUserPlus size={22} />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Create your account</h2>
          <p className="mt-1 text-sm text-gray-500">
            Join us for exclusive deals, faster checkout, and order tracking.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {String(error)}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label htmlFor="username" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">
              Username
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <FiUser />
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                required
                placeholder="Choose a username"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">
              Email
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <FiMail />
              </span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                required
                placeholder="you@example.com"
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
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
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
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600"
            >
              Confirm Password
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <FiLock />
              </span>
              <input
                id="confirmPassword"
                type={showConfirmPwd ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                required
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPwd((s) => !s)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showConfirmPwd ? "Hide password" : "Show password"}
              >
                {showConfirmPwd ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="group relative inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : null}
            {loading ? "Registering…" : "Sign up"}
          </button>
        </form>

        {/* Footer link */}
        <p className="relative mt-5 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegistrationForm;
