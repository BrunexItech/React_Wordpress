// src/pages/TabletDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gql, useMutation, useQuery } from "@apollo/client";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

/* ----------------------- GraphQL ----------------------- */

const TABLET_DETAIL = gql`
  query TabletDetail($id: ID!) {
    product(id: $id, idType: DATABASE_ID) {
      __typename
      id
      databaseId
      slug
      name
      description
      image { sourceUrl altText }

      # ACF meta, same as other cleaned components
      ... on SimpleProduct {
        price
        regularPrice
        salePrice
        onSale
        stockStatus
        meta { brand category specs }
      }
      ... on VariableProduct {
        price
        regularPrice
        salePrice
        onSale
        stockStatus
        meta { brand category specs }
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

const deriveDetail = (p) => {
  if (!p) return null;

  const brand_display = p?.meta?.brand?.trim?.() || "Unbranded";
  const category_display = p?.meta?.category?.trim?.() || "";
  const specs_text = p?.meta?.specs?.trim?.() || "";

  const current = toNumber(p.salePrice || p.price || p.regularPrice);
  const crossed = p.onSale && p.regularPrice ? toNumber(p.regularPrice) : null;

  return {
    name: p.name,
    brand_display,
    category_display,
    image: p.image?.sourceUrl || "",
    price_display: current != null ? `KSh ${current.toLocaleString()}` : "",
    price_min_ksh: current,
    price_max_ksh: crossed,
    specs_text,
    slug: p.slug,
    product_id: p.databaseId || null,
    description: p.description || "",
  };
};

/* ----------------------- component ----------------------- */

export default function TabletDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  const { data, loading, error } = useQuery(TABLET_DETAIL, {
    variables: { id: String(id) },
    fetchPolicy: "cache-and-network",
  });

  // smooth scroll on load / id changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);

  const view = useMemo(() => deriveDetail(data?.product), [data]);

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  const handleAddToCart = async () => {
    if (!view?.product_id) {
      toast.error("This tablet is not available for purchase yet.");
      return;
    }
    try {
      setAdding(true);
      const res = await mutateAddToCart({
        variables: { productId: view.product_id, quantity: 1 },
      });
      const newCount = res?.data?.addToCart?.cart?.contents?.itemCount;
      if (typeof newCount === "number") {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { count: newCount } }));
      } else {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: 1 } }));
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
        <p className="text-red-600 mb-4">Error: {error?.message || "Failed to load tablet."}</p>
        <button className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );

  const {
    name,
    brand_display,
    category_display,
    image,
    price_display,
    price_min_ksh,
    price_max_ksh,
    specs_text,
    slug,
    product_id,
    description,
  } = view;

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        className="mb-6 px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
        onClick={() => navigate(-1)}
      >
        ← Back
      </button>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="w-full h-96 bg-white border rounded-2xl flex items-center justify-center">
          <img
            src={image || FallbackImg}
            alt={name}
            className="max-h-full max-w-full object-contain"
            onError={(e) => {
              e.currentTarget.src = FallbackImg;
            }}
          />
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-2">{name}</h1>

          {/* Brand & category */}
          <p className="text-gray-600 mb-1">{brand_display}</p>
          {category_display ? <p className="text-gray-600 mb-4">{category_display}</p> : null}

          <p className="text-blue-600 font-semibold text-lg mb-4">
            {price_display || (price_min_ksh != null ? `KSh ${price_min_ksh.toLocaleString()}` : "—")}
          </p>
          {price_max_ksh ? (
            <p className="text-gray-400 text-sm line-through -mt-3 mb-4">
              {`KSh ${price_max_ksh.toLocaleString()}`}
            </p>
          ) : null}

          {/* Only Slug + Specs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <DetailItem label="Slug" value={slug || "—"} />
            <DetailItem label="Specs" value={specs_text || "—"} />
          </div>

          <div className="flex gap-3">
            <button
              className={`px-5 py-2 rounded ${
                product_id ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
              onClick={handleAddToCart}
              disabled={!product_id || adding}
            >
              {adding ? "Adding…" : "Add to Cart"}
            </button>

            <button
              className={`px-5 py-2 rounded ${
                product_id
                  ? "bg-gray-100 hover:bg-gray-200 text-gray-900"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
              onClick={() => {
                if (!product_id) {
                  toast.error("This tablet is not available for purchase yet.");
                  return;
                }
                navigate(`/checkout?product_id=${product_id}`);
              }}
              disabled={!product_id}
            >
              Checkout
            </button>
          </div>

          {/* Optional Woo description */}
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
    <div className="border rounded p-3">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="text-sm mt-1 whitespace-pre-line">{value}</div>
    </div>
  );
}
