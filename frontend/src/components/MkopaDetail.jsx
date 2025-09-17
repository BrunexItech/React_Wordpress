import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

/* ----------------------- GraphQL ----------------------- */

const PRODUCT_DETAIL = gql`
  query MkopaDetail($id: ID!) {
    product(id: $id, idType: DATABASE_ID) {
      __typename
      id
      databaseId
      slug
      name
      image { sourceUrl altText }
      productCategories { nodes { name slug } }
      productTags(first: 40) { nodes { name slug } }

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
        paymentPlanMkopa {
          depositKsh
          weeklyKsh
          termWeeks
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
        paymentPlanMkopa {
          depositKsh
          weeklyKsh
          termWeeks
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

const toNumber = (raw) => {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? null : n;
};

const parseTagValue = (names, key) => {
  const row = names.find((n) => n.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  if (!row) return null;
  const val = row.split(":")[1]?.trim() || "";
  return val || null;
};

const planFromTags = (tags = []) => {
  const names = tags.map((t) => t?.name || "");
  const deposit_ksh = toNumber(parseTagValue(names, "Deposit"));
  const weekly_ksh = toNumber(parseTagValue(names, "Weekly"));
  const term_weeks = toNumber(parseTagValue(names, "Term"));
  return { deposit_ksh, weekly_ksh, term_weeks };
};

const planFromAcf = (node) => {
  const g = node?.paymentPlanMkopa;
  if (!g) return {};
  return {
    deposit_ksh: toNumber(g.depositKsh),
    weekly_ksh: toNumber(g.weeklyKsh),
    term_weeks: toNumber(g.termWeeks),
  };
};

/* ----------------------- component ----------------------- */

export default function MkopaDetail() {
  const { id } = useParams(); // /mkopa/:id -> Woo databaseId
  const navigate = useNavigate();

  const [adding, setAdding] = useState(false);

  // helper to scroll page to top
  const scrollToTop = (behavior = "smooth") => {
    const el =
      document.scrollingElement ||
      document.documentElement ||
      document.body;
    el.scrollTo({ top: 0, behavior });
  };

  // scroll to top when page loads / id changes
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

    // Use only ACF 'meta' values for brand/category/specs
    const brand = p?.meta?.brand?.trim?.() || "Unbranded";
    const category = p?.meta?.category?.trim?.() || "Others";
    const specs = p?.meta?.specs?.trim?.() || ""; // From Woo/ACF only

    // Payment plan: prefer ACF group, fallback to tags
    const fromAcf = planFromAcf(p);
    const fromTags = planFromTags(p.productTags?.nodes || []);
    const deposit_ksh = fromAcf.deposit_ksh ?? fromTags.deposit_ksh ?? null;
    const weekly_ksh  = fromAcf.weekly_ksh  ?? fromTags.weekly_ksh  ?? null;
    const term_weeks  = fromAcf.term_weeks  ?? fromTags.term_weeks  ?? null;

    const current = toNumber(p.salePrice || p.price || p.regularPrice);
    const crossed = p.onSale && p.regularPrice ? toNumber(p.regularPrice) : null;

    return {
      name: p.name,
      brand,
      category,
      image: p.image?.sourceUrl || "",
      price_display: current != null ? `${current.toLocaleString()} KSh` : "",
      price_min_ksh: current,
      price_max_ksh: crossed,
      specs,
      deposit_ksh,
      weekly_ksh,
      term_weeks,
      slug: p.slug,
      product_id: p.databaseId || null,
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

  if (loading) return <div className="p-6 text-center text-gray-600">Loading…</div>;
  if (error || !view)
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 mb-4">Error: Failed to load M-KOPA item.</p>
        <button
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
          onClick={() => { scrollToTop(); navigate(-1); }}
        >
          Go Back
        </button>
      </div>
    );

  const {
    name, brand, category,
    image, price_display, price_min_ksh, price_max_ksh,
    specs, deposit_ksh, weekly_ksh, term_weeks, slug, product_id,
  } = view;

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        className="mb-6 px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
        onClick={() => { scrollToTop(); navigate(-1); }}
      >
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
          <h1 className="text-3xl font-bold mb-2">{name}</h1>
          <p className="text-gray-600 mb-1">{brand}</p>
          <p className="text-gray-600 mb-4">{category}</p>

          <p className="text-green-700 font-semibold text-lg mb-1">
            Deposit: KSh {deposit_ksh?.toLocaleString?.() || deposit_ksh}
          </p>
          <p className="text-gray-800 mb-4">
            Weekly: KSh {weekly_ksh?.toLocaleString?.() || weekly_ksh} • {term_weeks ?? "—"} weeks
          </p>

          <p className="text-blue-600 font-semibold text-lg mb-6">
            {price_display ||
              (price_max_ksh
                ? `${price_min_ksh} – ${price_max_ksh} KSh`
                : `${price_min_ksh ?? ""} KSh`)}
          </p>

          {/* SPECIFICALLY: show Woo/ACF "specs" next to "slug" */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <DetailItem label="Slug" value={slug || "—"} />
            <DetailItem label="Specs" value={specs || "—"} />
          </div>

          <div className="flex gap-3">
            <button
              className={`px-5 py-2 rounded-xl ${
                product_id ? "bg-green-600 hover:bg-green-700 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"
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
              onClick={() => {
                if (!product_id) {
                  toast.error("This item is not available for purchase yet.");
                  return;
                }
                scrollToTop();
                navigate(`/checkout?product_id=${product_id}`);
              }}
              disabled={!product_id}
            >
              Checkout
            </button>
          </div>
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
