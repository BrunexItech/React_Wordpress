// src/Pages/ProductDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { gql, useQuery, useMutation } from "@apollo/client";
import { toast } from "react-toastify";

const FallbackImg = "https://via.placeholder.com/600x400?text=Product";

/* ---------------- GraphQL ---------------- */

const PRODUCT_DETAIL = gql`
  query ProductDetail($id: ID!) {
    product(id: $id, idType: DATABASE_ID) {
      __typename
      id
      databaseId
      slug
      name
      description
      shortDescription
      image { sourceUrl altText }
      productTags(first: 50) { nodes { name slug } }

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

/* ---------------- helpers ---------------- */

const money = (raw) => {
  if (raw == null || raw === "") return "";
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? String(raw) : `Ksh ${n.toLocaleString()}`;
};

const parseTagValue = (names, key) => {
  const row = names.find((n) =>
    (n || "").toLowerCase().startsWith(`${key.toLowerCase()}:`)
  );
  if (!row) return null;
  const val = row.split(":")[1]?.trim() || "";
  return val || null;
};

const stripHtml = (html) =>
  typeof html === "string" ? html.replace(/<[^>]+>/g, "").trim() : "";

/* Normalize GraphQL product → UI shape */
const deriveView = (p) => {
  if (!p) return null;
  const tagNames = (p.productTags?.nodes || []).map((t) => t?.name || "");

  const brand = parseTagValue(tagNames, "Brand") || "";

  // Current and old prices
  const current = p.salePrice || p.price || p.regularPrice || null;
  const old = p.onSale && p.regularPrice ? p.regularPrice : null;

  return {
    id: p.databaseId ?? p.id,
    name: p.name,
    brand,
    image: p.image?.sourceUrl || FallbackImg,
    priceText: money(current),
    oldPriceText: old ? money(old) : null,
    descText: stripHtml(p.shortDescription || p.description || ""),
    product_id: p.databaseId || null,
  };
};

/* ---------------- component ---------------- */

const ProductDetail = () => {
  const { id } = useParams();
  const [adding, setAdding] = useState(false);

  // Optional: ensure we start at top when navigating here
  useEffect(() => {
    try {
      (document.scrollingElement || document.documentElement || document.body)
        ?.scrollTo({ top: 0, behavior: "auto" });
    } catch {}
  }, [id]);

  const { data, loading, error } = useQuery(PRODUCT_DETAIL, {
    variables: { id: String(id) },
    fetchPolicy: "cache-and-network",
  });

  const view = useMemo(() => deriveView(data?.product), [data]);

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  const handleAddToCart = async () => {
    if (!view?.product_id) return;
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
    } catch (err) {
      toast.error(err?.message || "Failed to add to cart");
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <section className="px-6 py-10">Loading…</section>;
  if (error || !view)
    return (
      <section className="px-6 py-10 text-red-600">
        Error: {error?.message || "Product not found."}
      </section>
    );

  const { name, brand, image, priceText, oldPriceText, descText } = view;

  return (
    <section className="px-6 py-10 max-w-6xl mx-auto">
      <div className="grid md:grid-cols-2 gap-10 bg-white shadow-xl rounded-2xl overflow-hidden">
        {/* Left: Product Image */}
        <div className="flex items-center justify-center bg-gray-100 p-6">
          <img
            src={image}
            alt={name}
            className="max-h-[500px] object-contain rounded-lg"
            onError={(e) => { e.currentTarget.src = FallbackImg; }}
            loading="lazy"
          />
        </div>

        {/* Right: Product Details */}
        <div className="flex flex-col justify-between p-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
            {brand ? <p className="text-gray-600 mt-1">{brand}</p> : null}
            {descText ? (
              <p className="text-gray-700 leading-relaxed mt-4">{descText}</p>
            ) : null}

            {/* Pricing */}
            <div className="mt-6 flex items-center gap-3">
              <span className="text-2xl font-bold text-orange-600">
                {priceText || "—"}
              </span>
              {oldPriceText ? (
                <span className="text-gray-400 line-through text-lg">
                  {oldPriceText}
                </span>
              ) : null}
            </div>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={adding || !view.product_id}
            className="mt-8 w-full bg-orange-600 text-white py-3 px-6 rounded-xl font-medium 
                       hover:bg-orange-700 hover:scale-105 transform transition duration-300 shadow-md
                       disabled:opacity-60 disabled:hover:scale-100"
          >
            {adding ? "Adding…" : "Add to Cart"}
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProductDetail;
