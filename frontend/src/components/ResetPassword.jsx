// src/components/ResetPassword.jsx
import React, { useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";

const RESET_PASSWORD = gql`
  mutation ResetPassword($key: String!, $login: String!, $password: String!) {
    resetUserPassword(input: { key: $key, login: $login, password: $password }) {
      user {
        id
        username
      }
    }
  }
`;

const ResetPassword = () => {
  const [params] = useSearchParams();
  const key = useMemo(() => params.get("key") || "", [params]);
  const login = useMemo(() => params.get("login") || "", [params]);
  const navigate = useNavigate();

  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetPassword, { loading }] = useMutation(RESET_PASSWORD, {
    fetchPolicy: "no-cache",
  });

  const submit = async (e) => {
    e.preventDefault();
    if (pwd !== confirm) {
      toast.error("Passwords do not match", { position: "top-center" });
      return;
    }
    try {
      await resetPassword({ variables: { key, login, password: pwd } });
      toast.success("Password reset successful. Please log in.", {
        autoClose: 1500,
        position: "top-center",
      });
      navigate(`/login?username=${encodeURIComponent(login)}`);
    } catch (e) {
      const msg =
        e?.graphQLErrors?.[0]?.message ||
        e?.message ||
        "Reset link is invalid or expired.";
      toast.error(msg, { position: "top-center" });
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="relative overflow-hidden rounded-2xl border bg-white/90 backdrop-blur p-6 md:p-8 shadow-xl">
        <div className="relative mb-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-900">Set a new password</h2>
          <p className="mt-1 text-sm text-gray-500">Enter your new password below.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">
              New password
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-600">
              Confirm password
            </label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <button
            disabled={loading}
            className="group relative inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Reset password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
