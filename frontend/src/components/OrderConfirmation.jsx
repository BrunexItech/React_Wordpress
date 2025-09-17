// frontend/src/Pages/OrderConfirmation.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { gql, useQuery, useMutation } from "@apollo/client";

/* ---------------- GraphQL ---------------- */

const GET_ORDER_BY_DBID = gql`
  query GetOrder($id: ID!) {
    order(id: $id, idType: DATABASE_ID) {
      id
      databaseId
      orderNumber
      status
      date
      total
      paymentMethod
      createdAt: date
      billing {
        firstName
        lastName
        email
        phone
      }
      shipping {
        firstName
        lastName
        address1
        address2
        city
        country
      }
      lineItems {
        nodes {
          quantity
          total
          product {
            node {
              name
              databaseId
            }
          }
        }
      }
    }
  }
`;

/*
 Placeholder mutation — keep in case your backend exposes a resend action.
 If not available your backend will return an error; UI handles that.
*/
const SEND_ORDER_EMAIL = gql`
  mutation SendOrderEmail($orderId: ID!) {
    sendOrderEmail(input: { orderId: $orderId }) {
      success
      message
    }
  }
`;

/* ---------------- Helpers ---------------- */

function parseNumber(n) {
  if (n == null || n === "") return 0;
  const s = String(n).replace(/[^0-9.-]+/g, "");
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

export default function OrderConfirmation() {
  const { id } = useParams();
  const dbId = Number(id);

  const { data, loading } = useQuery(GET_ORDER_BY_DBID, {
    variables: { id: String(dbId) }, // <-- pass as ID!, not Int
    skip: !dbId,
    fetchPolicy: "cache-and-network",
  });

  const [sendOrderEmail] = useMutation(SEND_ORDER_EMAIL);

  const [resending, setResending] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [receiptReady, setReceiptReady] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState("");

  useEffect(() => {
    if (data?.order) {
      // If your schema provides a receipt/download URL, set it here.
      setReceiptReady(true);
    }
  }, [data]);

  const order = data?.order;

  const money = (v) => {
    const n = parseNumber(v);
    return `Ksh ${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const issuedAt = useMemo(() => {
    if (!order?.createdAt) return "";
    try {
      return new Date(order.createdAt).toLocaleString("en-KE", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(order.createdAt);
    }
  }, [order?.createdAt]);

  const resend = async () => {
    if (!order?.databaseId) return;
    setResending(true);
    try {
      await sendOrderEmail({ variables: { orderId: String(order.databaseId) } });
      setToastMsg("Receipt sent to your email.");
      setTimeout(() => setToastMsg(""), 2500);
    } catch (e) {
      console.error(e);
      setToastMsg("Failed to resend receipt. Backend may not expose a resend mutation.");
      setTimeout(() => setToastMsg(""), 3500);
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <section className="px-6 py-10 flex justify-center">
        <div className="animate-pulse text-gray-500">Loading receipt…</div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="px-6 py-10">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Order not found</h2>
          <p className="mt-2 text-gray-600">
            We couldn't find that order. If you just placed it, please wait a moment and refresh.
          </p>
          <Link to="/" className="mt-4 inline-block px-4 py-2 rounded bg-indigo-600 text-white">
            Continue shopping
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-8 print:p-0">
      <div className="mx-auto w-full max-w-md bg-white shadow-xl rounded-xl overflow-hidden">
        <div className="px-5 pt-5 pb-2 text-center">
          <h1 className="text-lg font-extrabold tracking-widest">JONTECH</h1>
          <p className="text-xs text-gray-500">Thank you for your purchase</p>
        </div>

        <div className="px-5 py-3 text-xs font-mono text-gray-700">
          <div className="flex justify-between">
            <span>Receipt</span>
            <span className="uppercase">{order?.status || "PENDING"}</span>
          </div>
          <div className="flex justify-between">
            <span>Order ID</span>
            <span>#{order?.databaseId}</span>
          </div>
          <div className="flex justify-between">
            <span>Order No.</span>
            <span>{order?.orderNumber ?? order?.databaseId}</span>
          </div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>{issuedAt}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment</span>
            <span className="uppercase">{order?.paymentMethod || "cod"}</span>
          </div>
        </div>

        <div className="mx-5 border-t border-dashed border-gray-300" />

        <div className="px-5 py-3">
          <h2 className="text-xs tracking-widest text-gray-500 mb-2">ITEMS</h2>
          <div className="space-y-2">
            {(order?.lineItems?.nodes || []).map((it, idx) => {
              const productName = it.product?.node?.name || "Item";
              const lineTotal = parseNumber(it.total);
              const qty = Number(it.quantity || 0);
              const unit = qty ? lineTotal / qty : lineTotal;
              return (
                <div key={idx} className="font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="pr-3 break-words">{productName}</span>
                    <span>{money(lineTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span>Qty: {qty} @ {money(unit)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mx-5 border-t border-dashed border-gray-300" />

        <div className="px-5 py-3 text-sm font-mono">
          <div className="flex justify-between">
            <span className="text-gray-600">Total</span>
            <span>{money(order?.total)}</span>
          </div>
        </div>

        <div className="px-5 pt-2 pb-4">
          <div
            className="h-10 w-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg,#111,#111 2px,transparent 2px,transparent 4px)",
            }}
          />
          <div className="text-center text-xs font-mono mt-1">
            {String(order?.databaseId).padStart(10, "0")}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 print:hidden">
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
          >
            Print receipt
          </button>

          <a
            href={receiptUrl || "#"}
            onClick={(e) => {
              if (!receiptReady) e.preventDefault();
            }}
            className={[
              "px-4 py-2 rounded",
              receiptReady
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-200 text-gray-600 cursor-not-allowed",
            ].join(" ")}
            download
          >
            {receiptReady ? "Download PDF" : "Preparing receipt…"}
          </a>

          <button
            onClick={resend}
            disabled={resending}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {resending ? "Sending…" : "Resend to my email"}
          </button>
        </div>

        <Link
          to="/"
          className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Continue shopping
        </Link>

        {toastMsg && <div className="text-sm text-gray-700 mt-2">{toastMsg}</div>}
      </div>
    </section>
  );
}
