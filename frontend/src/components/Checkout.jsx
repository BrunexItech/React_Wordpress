import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql, useMutation, useQuery } from "@apollo/client";
import { toast } from "react-toastify";

/* ---------------- GraphQL ---------------- */

const GET_CART = gql`
  query GetCart {
    cart {
      subtotal
      total
      contents(first: 100) {
        itemCount
        nodes {
          key
          quantity
          product {
            node {
              databaseId
              name
              ... on SimpleProduct { price }
              ... on VariableProduct { price }
            }
          }
        }
      }
    }
  }
`;

/**
 * Customer-safe checkout mutation.
 * It finalizes the current cart into an order and triggers store emails,
 * provided WC + WooGraphQL are configured to send emails.
 */
const CHECKOUT = gql`
  mutation Checkout($input: CheckoutInput!) {
    checkout(input: $input) {
      result
      redirect
      order {
        id
        databaseId
        status
        total
      }
    }
  }
`;

/* ---------------- Helpers ---------------- */

// Parse price strings like "1,234.00" or "KES 1,234" to numbers safely
function parsePrice(raw) {
  if (raw == null || raw === "") return 0;
  const s = String(raw).replace(/[^0-9.-]+/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

const emptyShipping = {
  full_name: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  country: "KE",
};

const emptyBilling = {
  name_on_card: "",
  tax_id: "",
};

export default function Checkout() {
  const navigate = useNavigate();

  const { data, loading: cartLoading } = useQuery(GET_CART, {
    fetchPolicy: "cache-and-network",
  });

  const [checkout, { loading: checkingOut }] = useMutation(CHECKOUT);

  const [shipping, setShipping] = useState(emptyShipping);
  const [billing, setBilling] = useState(emptyBilling);
  const [paymentMethod, setPaymentMethod] = useState("cod"); // cod | mpesa | card
  const [error, setError] = useState("");

  // redirect to cart if cart empty
  useEffect(() => {
    if (!cartLoading && (!data?.cart || (data.cart.contents?.itemCount || 0) === 0)) {
      navigate("/cart");
    }
  }, [cartLoading, data, navigate]);

  const items = data?.cart?.contents?.nodes || [];

  // compute total safely (for display)
  const total = useMemo(() => {
    if (!items?.length) return 0;
    return items.reduce((sum, it) => {
      const p = it.product?.node;
      const price = parsePrice(p?.price ?? 0);
      const qty = Number(it.quantity || 0);
      return sum + price * qty;
    }, 0);
  }, [items]);

  const onChange = (setter) => (e) => {
    const { name, value } = e.target;
    setter((prev) => ({ ...prev, [name]: value }));
  };

  const normalizeShipping = (s) => ({
    firstName: (s.full_name || "").split(" ").slice(0, 1).join(""),
    lastName: (s.full_name || "").split(" ").slice(1).join(" ") || "",
    phone: (s.phone ?? "").trim(),
    address1: (s.address1 ?? "").trim(),
    address2: (s.address2 ?? "").trim(),
    city: (s.city ?? "").trim(),
    country: (s.country ?? "").trim(),
  });

  const normalizeBilling = (b) => ({
    name_on_card: (b.name_on_card ?? "").trim(),
    tax_id: (b.tax_id ?? "").trim(),
  });

  const validateForm = (s) => {
    if (!s.full_name || !s.phone || !s.address1 || !s.city || !s.country) {
      setError("Please complete your shipping details.");
      return false;
    }
    setError("");
    return true;
  };

  const placeOrder = async () => {
    if (checkingOut) return;
    if (!validateForm(shipping)) return;

    try {
      const s = normalizeShipping(shipping);
      const b = normalizeBilling(billing);

      // IMPORTANT:
      // - Do NOT pass lineItems to checkout; it uses the cart from WooCommerce session.
      // - paymentMethod must exist & be enabled in WooCommerce (e.g., "cod").
      const input = {
        paymentMethod: paymentMethod === "cod" ? "cod" : paymentMethod,
        billing: {
          firstName: s.firstName,
          lastName: s.lastName,
          email:
            (typeof window !== "undefined" && localStorage.getItem("userEmail")) ||
            "",
          phone: s.phone,
          address1: s.address1,
          address2: s.address2,
          city: s.city,
          country: s.country,
        },
        shipping: {
          firstName: s.firstName,
          lastName: s.lastName,
          address1: s.address1,
          address2: s.address2,
          city: s.city,
          country: s.country,
        },
        clientMutationId: `checkout_${Date.now()}`,
      };

      const res = await checkout({ variables: { input } });

      const created = res?.data?.checkout?.order;
      const orderId = created?.databaseId || created?.id || null;

      toast.success(
        "Order placed — check your email for confirmation (if enabled).",
        { autoClose: 2500, position: "top-center" }
      );

      if (orderId) {
        navigate(`/order-confirmation/${orderId}`);
      } else {
        navigate(`/order-confirmation`);
      }
    } catch (e) {
      console.error("Checkout error:", e);
      const msg =
        e?.graphQLErrors?.[0]?.message || e?.message || "Failed to place order.";
      setError(msg);
    }
  };

  if (cartLoading) return <div className="px-6 py-10">Loading checkout…</div>;

  return (
    <section className="px-6 py-10 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-lg mb-3">Shipping Address</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="border p-2 rounded"
                placeholder="Full Name*"
                name="full_name"
                value={shipping.full_name}
                onChange={onChange(setShipping)}
                required
              />
              <input
                className="border p-2 rounded"
                placeholder="Phone*"
                name="phone"
                value={shipping.phone}
                onChange={onChange(setShipping)}
                required
              />
              <input
                className="border p-2 rounded md:col-span-2"
                placeholder="Address Line 1*"
                name="address1"
                value={shipping.address1}
                onChange={onChange(setShipping)}
                required
              />
              <input
                className="border p-2 rounded md:col-span-2"
                placeholder="Address Line 2"
                name="address2"
                value={shipping.address2}
                onChange={onChange(setShipping)}
              />
              <input
                className="border p-2 rounded"
                placeholder="City*"
                name="city"
                value={shipping.city}
                onChange={onChange(setShipping)}
                required
              />
              <input
                className="border p-2 rounded"
                placeholder="Country*"
                name="country"
                value={shipping.country}
                onChange={onChange(setShipping)}
                required
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <h2 className="font-semibold text-lg mb-3">Payment</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pm"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                />
                <span>Cash on Delivery</span>
              </label>

              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="pm"
                  checked={paymentMethod === "mpesa"}
                  onChange={() => setPaymentMethod("mpesa")}
                />
                <div className="flex flex-col">
                  <span className="font-medium">Mpesa</span>
                  <span className="text-sm text-gray-600 bg-green-50 border border-green-200 rounded px-3 py-1 mt-1">
                    Paybill: <strong>542542</strong> &nbsp; | &nbsp; Acc No:{" "}
                    <strong>952994</strong>
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pm"
                  checked={paymentMethod === "card"}
                  onChange={() => setPaymentMethod("card")}
                />
                <span>Card (Stripe/Flutterwave)</span>
              </label>
            </div>

            {paymentMethod === "card" && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="border p-2 rounded md:col-span-2"
                  placeholder="Name on Card*"
                  name="name_on_card"
                  value={billing.name_on_card}
                  onChange={onChange(setBilling)}
                  required
                />
                <input
                  className="border p-2 rounded"
                  placeholder="Tax ID (optional)"
                  name="tax_id"
                  value={billing.tax_id}
                  onChange={onChange(setBilling)}
                />
              </div>
            )}
          </div>
        </div>

        <aside className="bg-white rounded-xl shadow p-4 h-max">
          <h2 className="font-semibold text-lg mb-3">Order Summary</h2>
          <div className="space-y-2 mb-4">
            {items.map((i, idx) => {
              const p = i.product?.node;
              const price = parsePrice(p?.price ?? 0);
              const qty = Number(i.quantity || 0);
              return (
                <div key={idx} className="flex justify-between text-sm">
                  <span>
                    {p?.name || "Product"} × {qty}
                  </span>
                  <span>Ksh {(price * qty).toFixed(2)}</span>
                </div>
              );
            })}
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span>Ksh {total.toFixed(2)}</span>
            </div>
          </div>

          <button
            className="w-full bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-medium disabled:opacity-50"
            onClick={placeOrder}
            disabled={checkingOut}
          >
            {checkingOut ? "Placing order…" : "Place Order"}
          </button>
        </aside>
      </div>
    </section>
  );
}
