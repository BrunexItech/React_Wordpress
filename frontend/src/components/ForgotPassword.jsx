// src/components/ForgotPassword.jsx
import React, { useState } from "react";
import { toast } from "react-toastify";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { FiMail } from "react-icons/fi";

/**
 * WPGraphQL: sendPasswordResetEmail
 * Accepts username or email. We'll ask for email in the UI but pass as "username".
 */
const SEND_RESET = gql`
  mutation SendReset($username: String!) {
    sendPasswordResetEmail(input: { username: $username }) {
      user {
        id
      }
    }
  }
`;

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sendReset, { loading }] = useMutation(SEND_RESET, {
    fetchPolicy: "no-cache",
  });

  const submit = async (e) => {
    e.preventDefault();
    try {
      // WP accepts username or email in `username` argument
      await sendReset({ variables: { username: email } });
      // For privacy: always show success, even if email isn't registered
      toast.success("Check your email for a password reset link.", {
        autoClose: 2000,
        position: "top-center",
      });
    } catch {
      // Keep the same message to avoid user enumeration
      toast.success("Check your email for a password reset link.", {
        autoClose: 2000,
        position: "top-center",
      });
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative overflow-hidden rounded-2xl border bg-white/90 backdrop-blur p-6 md:p-8 shadow-xl">
        <div className="relative mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600">
            <FiMail size={22} />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Forgot password</h2>
          <p className="mt-1 text-sm text-gray-500">We’ll email you a link to reset it.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">
              Email
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <FiMail />
              </span>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
          </div>

          <button
            disabled={loading}
            className="group relative inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
