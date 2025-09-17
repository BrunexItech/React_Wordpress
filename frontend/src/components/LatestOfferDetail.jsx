// src/components/LatestOfferDetail.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

/* ----------------------- GraphQL ----------------------- */

const PRODUCT_DETAIL = gql`
  query ProductDetail($id: ID!) {
    product(id: $id, idType: DATABASE_ID) {
      __typename
      id
      databaseId
      name
      slug
      description
      date
      image { sourceUrl altText }
      galleryImages(first: 8) { nodes { sourceUrl altText } }
      productCategories { nodes { name slug } }
      productTags(first: 20) { nodes { name slug } }
      ... on SimpleProduct {
        price
        regularPrice
        salePrice
        onSale
        stockStatus
      }
      ... on VariableProduct {
        price
        regularPrice
        salePrice
        onSale
        stockStatus
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

const normalizeSpace = (s = "") => s.replace(/\u00A0|&nbsp;/g, " ");
const money = (raw) => {
  if (raw == null || raw === "") return "";
  const n = Number(raw);
  return Number.isNaN(n) ? String(raw) : n.toLocaleString();
};

// Tags convention: labels are NEW/HOT/SALE, brand is "Brand: Samsung" etc.
const deriveLabelsAndBrand = (tags = []) => {
  const names = tags.map((t) => t?.name || "");
  const labels = names.filter((n) =>
    ["new", "hot", "sale"].includes(n.toLowerCase())
  );
  const brandTag = names.find((n) => /^brand\s*:/.test(n.toLowerCase()));
  const brand = brandTag ? brandTag.replace(/^brand\s*:\s*/i, "").trim() : "";
  return { labels, brand };
};

const LabelPill = ({ text }) => (
  <span className="bg-gray-900 text-white text-xs px-2 py-0.5 rounded">
    {String(text).toUpperCase()}
  </span>
);

/* ----------------------- component ----------------------- */

export default function LatestOfferDetail() {
  const { id } = useParams(); // we pass Woo databaseId from the grid
  const navigate = useNavigate();

  // sticky-header aware anchor (kept from your version)
  const topRef = useRef(null);
  const [adding, setAdding] = useState(false);

  const { data, loading, error } = useQuery(PRODUCT_DETAIL, {
    variables: { id: String(id) },
    fetchPolicy: "cache-and-network",
  });

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  // scroll offset behavior (kept)
  useEffect(() => {
    if (!loading) {
      const header =
        document.querySelector("header.sticky, header.fixed, [data-header]") ||
        null;
      const headerH = header?.offsetHeight || 0;
      const anchorY =
        (topRef.current?.getBoundingClientRect().top || 0) +
        window.pageYOffset;
      const y = Math.max(0, anchorY - headerH - 8);
      window.scrollTo({ top: y, behavior: "auto" });
    }
  }, [id, loading]);

  if (loading)
    return <div className="p-6 text-center text-gray-600">Loading…</div>;
  if (error || !data?.product) {
    console.error("Product detail error:", error);
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 mb-4">Failed to load product.</p>
        <button
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
          onClick={() => navigate(-1)}
        >
          Go Back
        </button>
      </div>
    );
  }

  const p = data.product;
  const { labels, brand } = deriveLabelsAndBrand(p.productTags?.nodes || []);
  const priceDisplay = normalizeSpace(
    String(p.salePrice || p.price || p.regularPrice || "")
  );
  const oldPrice =
    p.onSale && p.regularPrice
      ? normalizeSpace(String(p.regularPrice))
      : null;

  const handleAddToCart = async () => {
    if (!p?.databaseId) {
      toast.error("This product is not purchasable yet.", {
        autoClose: 1500,
        position: "top-center",
      });
      return;
    }
    try {
      setAdding(true);
      const res = await mutateAddToCart({
        variables: { productId: p.databaseId, quantity: 1 },
      });

      // ✅ Fire header update with exact itemCount if available
      const newCount = res?.data?.addToCart?.cart?.contents?.itemCount;
      if (typeof newCount === "number") {
        window.dispatchEvent(
          new CustomEvent("cart-updated", { detail: { count: newCount } })
        );
      } else {
        // fallback: optimistic +1
        window.dispatchEvent(
          new CustomEvent("cart-updated", { detail: { delta: 1 } })
        );
      }

      toast.success(`${p.name} added to cart`, {
        autoClose: 1500,
        position: "top-center",
      });
    } catch (e) {
      console.error("Add to cart failed:", e);
      toast.error("Failed to add to cart", {
        autoClose: 1500,
        position: "top-center",
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      {/* invisible anchor for accurate top scrolling */}
      <div ref={topRef} />

      <div className="container mx-auto px-4 py-8">
        <button
          className="mb-6 px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Images */}
          <div>
            <div className="w-full h-96 bg-white border rounded-2xl flex items-center justify-center">
              <img
                src={p.image?.sourceUrl || FallbackImg}
                alt={p.image?.altText || p.name}
                className="max-h-full max-w-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = FallbackImg;
                }}
              />
            </div>

            {p.galleryImages?.nodes?.length ? (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {p.galleryImages.nodes.map((g, i) => (
                  <img
                    key={i}
                    src={g.sourceUrl}
                    alt={g.altText || `gallery-${i}`}
                    className="w-full h-20 object-contain border rounded bg-white"
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* Info */}
          <div>
            <h1 className="text-3xl font-bold mb-2">{p.name}</h1>
            {!!brand && <p className="text-gray-600 mb-1">{brand}</p>}
            <div className="flex flex-wrap gap-2 mb-3">
              {labels.map((l, i) => (
                <LabelPill key={i} text={l} />
              ))}
            </div>

            <div className="text-lg font-semibold mb-4">
              {priceDisplay ? (
                <p className="text-blue-600">{priceDisplay}</p>
              ) : (
                <p className="text-gray-500">Price unavailable</p>
              )}
              {oldPrice && (
                <p className="text-gray-400 line-through">{oldPrice}</p>
              )}
              {p.stockStatus && (
                <p className="text-sm mt-1">
                  Stock:{" "}
                  <span className="font-medium">
                    {String(p.stockStatus).replace(/_/g, " ")}
                  </span>
                </p>
              )}
            </div>

            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: p.description || "" }}
            />

            <div className="mt-6 flex items-center gap-3">
              <button
                className={`px-5 py-2 rounded-xl ${
                  p.databaseId
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
                onClick={handleAddToCart}
                disabled={!p.databaseId || adding}
              >
                {adding ? "Adding…" : "Add to Cart"}
              </button>

              <button
                className={`px-5 py-2 rounded-xl ${
                  p.databaseId
                    ? "bg-gray-100 hover:bg-gray-200 text-gray-900"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (!p.databaseId) {
                    toast.error(
                      "This product is not available for checkout yet.",
                      { autoClose: 1500, position: "top-center" }
                    );
                    return;
                  }
                  navigate(`/checkout?product_id=${p.databaseId}`);
                }}
                disabled={!p.databaseId}
              >
                Checkout
              </button>
            </div>

            {/* Meta */}
            <div className="mt-6 text-sm text-gray-600">
              {p.productCategories?.nodes?.length ? (
                <p>
                  Categories:{" "}
                  {p.productCategories.nodes.map((c) => c.name).join(", ")}
                </p>
              ) : null}
              {p.productTags?.nodes?.length ? (
                <p>Tags: {p.productTags.nodes.map((t) => t.name).join(", ")}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
