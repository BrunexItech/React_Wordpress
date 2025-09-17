import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";
// If your list route is different, change this:
const LIST_ROUTE = "/budget-smartphones";

/* ----------------------- GraphQL ----------------------- */

const PRODUCT_DETAIL = gql`
  query BudgetPhoneDetail($id: ID!) {
    product(id: $id, idType: DATABASE_ID) {
      __typename
      id
      databaseId
      name
      slug
      description
      image { sourceUrl altText }
      productTags(first: 20) { nodes { name slug } }
      galleryImages(first: 10) { nodes { sourceUrl altText } }

      ... on SimpleProduct {
        price
        regularPrice
        salePrice
        onSale
        stockStatus
        meta {
          brand
          category
          specs
        }
      }
      ... on VariableProduct {
        price
        regularPrice
        salePrice
        onSale
        stockStatus
        meta {
          brand
          category
          specs
        }
      }
    }
  }
`;

const ADD_TO_CART = gql`
  mutation AddToCart($productId: Int!, $quantity: Int = 1) {
    addToCart(input: { productId: $productId, quantity: $quantity }) {
      cartItem { key quantity total }
      cart { contents { itemCount } subtotal total }
    }
  }
`;

/* ----------------------- helpers ----------------------- */

const money = (raw) => {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? String(raw) : `${n.toLocaleString()} KSh`;
};

const deriveBadge = (tags = []) => {
  const names = tags.map((t) => (t?.name || "").toUpperCase());
  if (names.includes("OPEN HOT")) return "OPEN HOT";
  if (names.includes("OPEN")) return "OPEN";
  return "";
};

/* ----------------------- component ----------------------- */

export default function BudgetSmartphoneDetail() {
  const { id } = useParams(); // /budget-smartphones/:id
  const navigate = useNavigate();

  const [adding, setAdding] = useState(false);

  // Helper: scroll the actual page (handles different browsers)
  const scrollPageTop = (behavior = "smooth") => {
    const el =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    el.scrollTo({ top: 0, behavior });
  };

  // Disable browser's automatic scroll restoration while this page is active
  useEffect(() => {
    const prev = window.history.scrollRestoration;
    try {
      window.history.scrollRestoration = "manual";
    } catch {}
    // Ensure we start at top when opening/changing id
    scrollPageTop("auto");
    return () => {
      try {
        window.history.scrollRestoration = prev || "auto";
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const { data, loading, error } = useQuery(PRODUCT_DETAIL, {
    variables: { id: String(id) },
    fetchPolicy: "cache-and-network",
  });

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  const handleAddToCart = async () => {
    const pid = data?.product?.databaseId;
    const pname = data?.product?.name || "Item";
    if (!pid) {
      toast.error("This item is not available for purchase yet.");
      return;
    }
    try {
      setAdding(true);
      const res = await mutateAddToCart({
        variables: { productId: pid, quantity: 1 },
      });
      const newCount = res?.data?.addToCart?.cart?.contents?.itemCount;
      if (typeof newCount === "number") {
        window.dispatchEvent(
          new CustomEvent("cart-updated", { detail: { count: newCount } })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("cart-updated", { detail: { delta: 1 } })
        );
      }
      toast.success(`${pname} added to cart`);
    } catch (e) {
      toast.error(e?.message || "Failed to add to cart");
    } finally {
      setAdding(false);
    }
  };

  const handleBack = () => {
    scrollPageTop();
    navigate(LIST_ROUTE);
  };

  const handleCheckout = () => {
    const pid = data?.product?.databaseId;
    if (!pid) {
      toast.error("This item is not available for purchase yet.");
      return;
    }
    scrollPageTop();
    navigate(`/checkout?product_id=${pid}`);
  };

  if (loading) return <div className="p-6 text-center text-gray-600">Loading…</div>;
  if (error || !data?.product) {
    // eslint-disable-next-line no-console
    console.error("Product detail error:", error);
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 mb-4">Error: Failed to load smartphone.</p>
        <button className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={handleBack}>
          Go Back
        </button>
      </div>
    );
  }

  const p = data.product;

  // Pull ACF meta group
  const brand = p?.meta?.brand?.trim?.() || "Unbranded";
  const category = p?.meta?.category?.trim?.() || "";
  const specs = p?.meta?.specs?.trim?.() || ""; // Show specs only on detail page (here)

  const badge = deriveBadge(p.productTags?.nodes || []);
  const priceDisplay =
    money(p.salePrice || p.price || p.regularPrice || null) || "";
  const crossedPrice =
    p.onSale && p.regularPrice ? money(p.regularPrice) : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <button className="mb-6 px-4 py-2 rounded bg-gray-100 hover:bg-gray-200" onClick={handleBack}>
        ← Back
      </button>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="w-full h-96 bg-white border rounded-2xl flex items-center justify-center">
          <img
            src={p.image?.sourceUrl || FallbackImg}
            alt={p.name}
            className="max-h-full max-w-full object-contain"
            onError={(e) => { e.currentTarget.src = FallbackImg; }}
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold">{p.name}</h1>
            {badge ? (
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${badge.includes("HOT") ? "bg-blue-600 text-white" : "bg-red-600 text-white"}`}>{badge}</span>
            ) : null}
          </div>

          <p className="text-gray-600 mb-1">{brand}</p>
          {category ? <p className="text-gray-600 mb-4">{category}</p> : null}

          <p className="text-blue-600 font-semibold text-lg mb-4">
            {priceDisplay || (crossedPrice ? crossedPrice : "—")}
          </p>
          {crossedPrice ? (
            <p className="text-gray-400 text-sm line-through -mt-3 mb-4">{crossedPrice}</p>
          ) : null}

          {/* SPECIFICALLY: show Woo/ACF "specs" next to "slug" */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <DetailItem label="Slug" value={p.slug || "—"} />
            <DetailItem label="Specs" value={specs || "—"} />
          </div>

          <div className="flex gap-3">
            <button
              className={`px-5 py-2 rounded-xl ${
                p.databaseId ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
              onClick={handleAddToCart}
              disabled={!p.databaseId || adding}
            >
              {adding ? "Adding…" : "Add to Cart"}
            </button>

            <button
              className={`px-5 py-2 rounded-xl ${
                p.databaseId ? "bg-gray-100 hover:bg-gray-200 text-gray-900" : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
              onClick={handleCheckout}
              disabled={!p.databaseId}
            >
              Checkout
            </button>
          </div>

          {/* Description */}
          {p.description ? (
            <div className="prose max-w-none mt-6" dangerouslySetInnerHTML={{ __html: p.description }} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="border rounded-xl p-3">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-sm mt-1 whitespace-pre-line">{value}</div>
    </div>
  );
}
