// src/Pages/Cart.jsx
import React, { useEffect, useMemo, useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";

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
          subtotal
          total
          product {
            node {
              __typename
              id
              databaseId
              name
              ... on SimpleProduct {
                price
                regularPrice
                salePrice
              }
              ... on VariableProduct {
                price
                regularPrice
                salePrice
              }
              image { sourceUrl altText }
            }
          }
        }
      }
    }
  }
`;

const UPDATE_QTY = gql`
  mutation UpdateQty($items: [CartItemQuantityInput!]!) {
    updateItemQuantities(input: { items: $items }) {
      cart {
        contents { itemCount }
        total
        subtotal
      }
    }
  }
`;

const REMOVE_ITEMS = gql`
  mutation RemoveItems($keys: [ID!]!) {
    removeItemsFromCart(input: { keys: $keys }) {
      cart { contents { itemCount } total subtotal }
    }
  }
`;

/* ---------------- UI helpers ---------------- */

const currencyText = (s) => (s == null ? "" : String(s));

const CartItemRow = memo(function CartItemRow({
  node,
  onInc,
  onDec,
  onRemove,
  busy,
}) {
  const product = node.product?.node;
  const priceDisplay = product?.salePrice || product?.price || product?.regularPrice || "";
  return (
    <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow">
      <div className="flex items-center gap-4">
        <img
          src={product?.image?.sourceUrl || "/images/fallback.jpg"}
          alt={product?.image?.altText || product?.name || "product"}
          className="w-16 h-16 object-contain bg-white border rounded"
          onError={(e) => { e.currentTarget.src = "/images/fallback.jpg"; }}
        />
        <div>
          <h3 className="font-semibold text-gray-900">{product?.name || "Product"}</h3>
          <p className="text-orange-600 font-bold">{currencyText(priceDisplay)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
          onClick={() => onDec(node.key, node.quantity)}
          disabled={busy || node.quantity <= 0}
          aria-label="Decrease quantity"
          title="Decrease quantity"
        >
          −
        </button>
        <span aria-live="polite" aria-atomic="true">{node.quantity}</span>
        <button
          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
          onClick={() => onInc(node.key, node.quantity)}
          disabled={busy}
          aria-label="Increase quantity"
          title="Increase quantity"
        >
          +
        </button>

        <button
          className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          onClick={() => onRemove(node.key)}
          disabled={busy}
        >
          Remove
        </button>
      </div>
    </div>
  );
});

/* ---------------- Component ---------------- */

const Cart = () => {
  const navigate = useNavigate();

  const { data, loading, error, refetch, networkStatus } = useQuery(GET_CART, {
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  const [updateQty, { loading: updating }] = useMutation(UPDATE_QTY);
  const [removeItems, { loading: removing }] = useMutation(REMOVE_ITEMS);

  const [busyKeys, setBusyKeys] = useState({}); // { [key]: true }

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, []);

  const setBusy = (key, v) => setBusyKeys((m) => ({ ...m, [key]: v }));

  // ---- Broadcasting helpers (for Header badge sync) ----
  const broadcastCount = (itemCount) => {
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: { count: itemCount ?? 0 } }));
  };
  const broadcastSnapshot = (items) => {
    window.dispatchEvent(new CustomEvent("cart-snapshot", { detail: { items: items ?? [] } }));
    // also send a count for listeners that prefer the simpler event
    const count = Array.isArray(items)
      ? items.reduce((acc, it) => acc + (Number(it?.quantity ?? it?.qty ?? 0) || 0), 0)
      : 0;
    broadcastCount(count);
  };

  // Current cart derived data
  const contents = data?.cart?.contents;
  const items = contents?.nodes || [];
  const itemCount = contents?.itemCount ?? 0;
  const subtotal = currencyText(data?.cart?.subtotal);
  const total = currencyText(data?.cart?.total);

  const numericTotal = useMemo(() => total, [total]);

  // ✅ NEW: Whenever GET_CART delivers data (including after login or refetch),
  // broadcast the current count so the Header badge updates immediately.
  useEffect(() => {
    if (!loading && data?.cart?.contents) {
      broadcastCount(itemCount);
      // Optional: also share a snapshot of the actual items to be extra robust
      broadcastSnapshot(items);
    }
    // We include `networkStatus` so we also broadcast on refetch completion
  }, [loading, networkStatus, data?.cart?.contents, itemCount, items]);

  // ✅ NEW: Answer "request-cart-snapshot" from Header with the live items
  useEffect(() => {
    const onRequestSnapshot = () => {
      broadcastSnapshot(items);
    };
    window.addEventListener("request-cart-snapshot", onRequestSnapshot);
    return () => window.removeEventListener("request-cart-snapshot", onRequestSnapshot);
  }, [items]);

  // ---- Mutations keep your previous behavior, but we also refetch & broadcast ----
  const onInc = async (key, qty) => {
    setBusy(key, true);
    try {
      const res = await updateQty({ variables: { items: [{ key, quantity: qty + 1 }] } });
      const count = res?.data?.updateItemQuantities?.cart?.contents?.itemCount ?? itemCount;
      broadcastCount(count);
      await refetch();
    } catch (e) {
      console.error(e);
      await refetch();
    } finally {
      setBusy(key, false);
    }
  };

  const onDec = async (key, qty) => {
    setBusy(key, true);
    try {
      if (qty - 1 <= 0) {
        const res = await removeItems({ variables: { keys: [key] } });
        const count = res?.data?.removeItemsFromCart?.cart?.contents?.itemCount ?? itemCount;
        broadcastCount(count);
      } else {
        const res = await updateQty({ variables: { items: [{ key, quantity: qty - 1 }] } });
        const count = res?.data?.updateItemQuantities?.cart?.contents?.itemCount ?? itemCount;
        broadcastCount(count);
      }
      await refetch();
    } catch (e) {
      console.error(e);
      await refetch();
    } finally {
      setBusy(key, false);
    }
  };

  const onRemove = async (key) => {
    setBusy(key, true);
    try {
      const res = await removeItems({ variables: { keys: [key] } });
      const count = res?.data?.removeItemsFromCart?.cart?.contents?.itemCount ?? itemCount;
      broadcastCount(count);
      await refetch();
    } catch (e) {
      console.error(e);
      await refetch();
    } finally {
      setBusy(key, false);
    }
  };

  const handleCheckout = () => {
    if (!items.length) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    navigate("/checkout");
  };

  if (loading && !data) return <div className="px-6 py-10">Loading cart…</div>;
  if (error) return <div className="px-6 py-10 text-red-600">Error: {String(error.message || error)}</div>;
  if (!items.length) return <div className="px-6 py-10">Your cart is empty.</div>;

  return (
    <section className="px-6 py-10 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">My Cart</h2>

      <div className="space-y-4">
        {items.map((node) => (
          <CartItemRow
            key={node.key}
            node={node}
            busy={!!busyKeys[node.key] || updating || removing}
            onInc={onInc}
            onDec={onDec}
            onRemove={onRemove}
          />
        ))}
      </div>

      <div className="mt-6 flex justify-between items-center p-4 bg-white rounded-xl shadow">
        <div>
          <div className="text-sm text-gray-600">Subtotal: {subtotal}</div>
          <div className="text-xl font-bold">Total: {numericTotal}</div>
        </div>
        <button
          className="bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-medium"
          onClick={handleCheckout}
        >
          Checkout
        </button>
      </div>
    </section>
  );
};

export default Cart;
