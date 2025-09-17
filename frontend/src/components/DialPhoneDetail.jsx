import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

/* ----------------------- GraphQL ----------------------- */

const PRODUCT_DETAIL = gql`
  query DialPhoneDetail($id: ID!) {
    product(id: $id, idType: DATABASE_ID) {
      __typename
      id
      databaseId
      slug
      name
      description
      image { sourceUrl altText }
      productTags(first: 20) { nodes { name slug } }

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

export default function DialPhoneDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [adding, setAdding] = useState(false);

  // helper to scroll page top
  const scrollToTop = (behavior = "smooth") => {
    const el =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    el.scrollTo({ top: 0, behavior });
  };

  // scroll to top when id changes (new detail page)
  useEffect(() => {
    scrollToTop("auto");
  }, [id]);

  const { data, loading, error } = useQuery(PRODUCT_DETAIL, {
    variables: { id: String(id) },
    fetchPolicy: "cache-and-network",
  });

  const view = useMemo(() => {
    const p = data?.product;
    if (!p) return null;

    // Pull brand/category/specs from Woo/ACF meta
    const brand = p?.meta?.brand?.trim?.() || "Unbranded";
    const category = p?.meta?.category?.trim?.() || "";
    const specs = p?.meta?.specs?.trim?.() || ""; // show only on detail

    // Badge still from tags (unchanged functionality)
    const badge = deriveBadge(p.productTags?.nodes || []);

    const priceRaw = p.salePrice || p.price || p.regularPrice || null;
    const price_display = money(priceRaw) || "";
    const price_min_ksh = priceRaw ? Number(String(priceRaw).replace(/[^\d.]/g, "")) : null;
    const price_max_ksh =
      p.onSale && p.regularPrice
        ? Number(String(p.regularPrice).replace(/[^\d.]/g, ""))
        : null;

    return {
      name: p.name,
      brand,
      category,
      specs,
      badge,
      price_display,
      price_min_ksh,
      price_max_ksh,
      slug: p.slug,
      product_id: p.databaseId || null,
      image: p.image?.sourceUrl || "",
      description: p.description || "",
    };
  }, [data]);

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  const handleAddToCart = async () => {
    if (!view?.product_id) {
      toast.error("This item is not available for purchase yet.");
      return;
    }
    try {
      setAdding(true);
      const res = await mutateAddToCart({
        variables: { productId: view.product_id, quantity: 1 },
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
      toast.success(`${view.name} added to cart`);
    } catch (e) {
      toast.error(e?.message || "Failed to add to cart");
    } finally {
      setAdding(false);
    }
  };

  const handleBack = () => {
    scrollToTop();
    navigate(-1);
  };

  const handleCheckout = () => {
    if (!view?.product_id) {
      toast.error("This item is not available for purchase yet.");
      return;
    }
    scrollToTop();
    navigate(`/checkout?product_id=${view.product_id}`);
  };

  if (loading) return <div className="p-6 text-center text-gray-600">Loading…</div>;
  if (error || !view) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 mb-4">Error: Failed to load dial phone.</p>
        <button className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={handleBack}>
          Go Back
        </button>
      </div>
    );
  }

  const {
    name, brand, category, specs, badge, price_display, price_min_ksh, price_max_ksh,
    slug, product_id, image, description,
  } = view;

  return (
    <div className="container mx-auto px-4 py-8">
      <button className="mb-6 px-4 py-2 rounded bg-gray-100 hover:bg-gray-200" onClick={handleBack}>
        ← Back
      </button>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="w-full h-96 bg-white border rounded-2xl flex items-center justify-center">
          <img
            src={image || FallbackImg}
            alt={name}
            className="max-h-full max-w-full object-contain"
            onError={(e) => { e.currentTarget.src = FallbackImg; }}
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold">{name}</h1>
            {badge ? (
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${badge.includes("HOT") ? "bg-blue-600 text-white" : "bg-red-600 text-white"}`}>{badge}</span>
            ) : null}
          </div>

          <p className="text-gray-600 mb-1">{brand}</p>
          {category ? <p className="text-gray-600 mb-1">{category}</p> : null}

          <p className="text-blue-600 font-semibold text-lg mb-6">
            {price_display ||
              (price_max_ksh
                ? `${price_min_ksh?.toLocaleString?.()} – ${price_max_ksh?.toLocaleString?.()} KSh`
                : `${price_min_ksh?.toLocaleString?.() ?? ""} KSh`)}
          </p>

          {/* FIRST ROW: Slug + Specs (from Woo/ACF), side-by-side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <DetailItem label="Slug" value={slug || "—"} />
            <DetailItem label="Specs" value={specs || "—"} />
          </div>

          {/* SECOND ROW: Badge + Price (min) (keeping your existing data points) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <DetailItem label="Badge" value={badge || "—"} />
            <DetailItem
              label="Price (min)"
              value={price_min_ksh ? `${Number(price_min_ksh).toLocaleString()} KSh` : "—"}
            />
          </div>

          <div className="flex gap-3">
            <button
              className={`px-5 py-2 rounded-xl ${
                product_id ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
              onClick={handleAddToCart}
              disabled={!product_id || adding}
            >
              {adding ? "Adding…" : "Add to Cart"}
            </button>

            <button
              className={`px-5 py-2 rounded-xl ${
                product_id ? "bg-gray-100 hover:bg-gray-200 text-gray-900" : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
              onClick={handleCheckout}
              disabled={!product_id}
            >
              Checkout
            </button>
          </div>

          {/* Description */}
          {description ? (
            <div className="prose max-w-none mt-6" dangerouslySetInnerHTML={{ __html: description }} />
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
