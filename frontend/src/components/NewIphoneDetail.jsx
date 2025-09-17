import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

/* ----------------------- GraphQL ----------------------- */

const PRODUCT_DETAIL = gql`
  query NewIphoneDetail($id: ID!) {
    product(id: $id, idType: DATABASE_ID) {
      __typename
      id
      databaseId
      slug
      name
      description
      image { sourceUrl altText }
      galleryImages(first: 10) { nodes { sourceUrl altText } }
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

const toNumber = (raw) => {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? null : n;
};

/* ----------------------- component ----------------------- */

export default function NewIphoneDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [adding, setAdding] = useState(false);

  // helper function
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

    const newPrice = toNumber(p.salePrice || p.price || p.regularPrice);
    const oldPrice = p.onSale && p.regularPrice ? toNumber(p.regularPrice) : null;

    // ACF meta → brand/category/specs
    const brand = p?.meta?.brand?.trim?.() || "Unbranded";
    const category = p?.meta?.category?.trim?.() || "";
    const specs = p?.meta?.specs?.trim?.() || "";

    return {
      name: p.name,
      price_display: newPrice != null ? `KSh ${newPrice.toLocaleString()}` : "",
      new_price_ksh: newPrice,
      old_price_ksh: oldPrice,
      brand,
      category,
      specs, // show on detail only
      image: p.image?.sourceUrl || "",
      product_id: p.databaseId || null,
      slug: p.slug,
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

  if (loading)
    return (
      <div className="p-6 text-center text-gray-600">Loading…</div>
    );
  if (error || !view)
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 mb-4">Error: Failed to load iPhone.</p>
        <button
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
          onClick={() => {
            scrollToTop();
            navigate(-1);
          }}
        >
          Go Back
        </button>
      </div>
    );

  const {
    name,
    price_display,
    new_price_ksh,
    old_price_ksh,
    brand,
    category,
    specs,
    image,
    product_id,
    slug,
    description,
  } = view;

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        className="mb-6 px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
        onClick={() => {
          scrollToTop();
          navigate(-1);
        }}
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
          {/* Show brand/category (no specs line here) */}
          <p className="text-gray-600 mb-1">{brand}</p>
          {category ? <p className="text-gray-600 mb-1">{category}</p> : null}

          <p className="text-blue-600 font-semibold text-lg mb-6">
            {price_display ||
              (old_price_ksh
                ? `${new_price_ksh?.toLocaleString?.()} – ${old_price_ksh?.toLocaleString?.()} KSh`
                : `${new_price_ksh?.toLocaleString?.() ?? ""} KSh`)}
          </p>

          {/* SPECS next to SLUG (from Woo/ACF) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <DetailItem label="Slug" value={slug || "—"} />
            <DetailItem label="Specs" value={specs || "—"} />
          </div>

          <div className="flex gap-3">
            <button
              className={`px-5 py-2 rounded-xl ${
                product_id
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
              onClick={handleAddToCart}
              disabled={!product_id || adding}
            >
              {adding ? "Adding…" : "Add to Cart"}
            </button>

            <button
              className={`px-5 py-2 rounded-xl ${
                product_id
                  ? "bg-gray-100 hover:bg-gray-200 text-gray-900"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
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
