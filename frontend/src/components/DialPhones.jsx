import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

// Adjust if you use a different Woo category for dial phones
const DIAL_PHONES_CATEGORY_SLUG = "dial-phones";

/* ----------------------- GraphQL ----------------------- */

const LIST_PRODUCTS = gql`
  query DialPhonesList(
    $categorySlugs: [String]!
    $first: Int = 50
    $after: String
    $search: String
    $orderbyField: ProductsOrderByEnum = DATE
    $order: OrderEnum = DESC
  ) {
    products(
      first: $first
      after: $after
      where: {
        categoryIn: $categorySlugs
        search: $search
        orderby: { field: $orderbyField, order: $order }
      }
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        __typename
        id
        databaseId
        slug
        name
        image { sourceUrl altText }
        productTags(first: 20) { nodes { name slug } }

        ... on SimpleProduct {
          price
          regularPrice
          salePrice
          onSale
          stockStatus
          # Pull ACF meta group
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

// Map existing ordering options → WPGraphQL orderby
const mapOrdering = (ordering) => {
  let field = "DATE";
  let order = "DESC";
  switch (ordering) {
    case "created_at":
      field = "DATE"; order = "ASC"; break;
    case "-created_at":
      field = "DATE"; order = "DESC"; break;
    case "name":
      field = "TITLE"; order = "ASC"; break;
    case "-name":
      field = "TITLE"; order = "DESC"; break;
    case "price_min_ksh":
      field = "PRICE"; order = "ASC"; break;
    case "-price_min_ksh":
      field = "PRICE"; order = "DESC"; break;
    default:
      break;
  }
  return { field, order };
};

/* ----------------------- component ----------------------- */

export default function DialPhones() {
  const navigate = useNavigate();

  // UI state kept the same
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  // emulate previous/next using cursor stack
  const [endCursorStack, setEndCursorStack] = useState([null]); // index = page-1

  // per-card add state
  const [addingMap, setAddingMap] = useState({});

  const { field: orderbyField, order } = useMemo(
    () => mapOrdering(ordering),
    [ordering]
  );

  const { data, loading, error, refetch, fetchMore } = useQuery(LIST_PRODUCTS, {
    variables: {
      categorySlugs: [DIAL_PHONES_CATEGORY_SLUG],
      first: pageSize,
      after: endCursorStack[page - 1] || null,
      search: search || null,
      orderbyField,
      order,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  // reset to page 1 when inputs change
  useEffect(() => {
    setPage(1);
    setEndCursorStack([null]);
    refetch({
      categorySlugs: [DIAL_PHONES_CATEGORY_SLUG],
      first: pageSize,
      after: null,
      search: search || null,
      orderbyField,
      order,
    });
  }, [search, ordering, orderbyField, order, pageSize, refetch]);

  // normalize to your UI shape (use ACF meta for brand/category; do NOT show specs here)
  const items = useMemo(() => {
    const nodes = data?.products?.nodes || [];
    return nodes.map((n) => {
      const brand = n?.meta?.brand?.trim?.() || "Unbranded";
      const category = n?.meta?.category?.trim?.() || "";
      const badge = deriveBadge(n.productTags?.nodes || []);
      const priceRaw = n.salePrice || n.price || n.regularPrice || null;
      const crossed =
        n.onSale && n.regularPrice
          ? Number(String(n.regularPrice).replace(/[^\d.]/g, ""))
          : null;

      return {
        id: n.databaseId ?? n.id,
        name: n.name,
        image: n.image?.sourceUrl || "",
        brand,
        category,
        badge: badge || "",
        price_display: money(priceRaw) || "",
        price_min_ksh: priceRaw ? Number(String(priceRaw).replace(/[^\d.]/g, "")) : null,
        price_max_ksh: crossed,
        product_id: n.databaseId || null,
      };
    });
  }, [data]);

  // mimic your summary (no total count from WPGraphQL without extras)
  const count = null;

  const hasNext = !!data?.products?.pageInfo?.hasNextPage;
  const hasPrev = page > 1;

  const goNext = async () => {
    if (!hasNext) return;
    const after = data?.products?.pageInfo?.endCursor || null;
    setEndCursorStack((stack) => {
      const nextStack = [...stack];
      nextStack[page] = after; // store cursor for next page index
      return nextStack;
    });
    setPage((p) => p + 1);
    await fetchMore({
      variables: {
        categorySlugs: [DIAL_PHONES_CATEGORY_SLUG],
        first: pageSize,
        after,
        search: search || null,
        orderbyField,
        order,
      },
    });
  };

  const goPrev = async () => {
    if (!hasPrev) return;
    const prevIndex = Math.max(0, page - 2);
    const after = endCursorStack[prevIndex] || null;
    setPage((p) => Math.max(1, p - 1));
    await refetch({
      categorySlugs: [DIAL_PHONES_CATEGORY_SLUG],
      first: pageSize,
      after,
      search: search || null,
      orderbyField,
      order,
    });
  };

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  const handleBuyNow = async (item) => {
    if (!item?.product_id) {
      toast.error("This item is not available for purchase yet.", {
        autoClose: 1500,
        position: "top-center",
      });
      return;
    }
    const id = item.id;
    setAddingMap((m) => ({ ...m, [id]: true }));
    try {
      const res = await mutateAddToCart({
        variables: { productId: item.product_id, quantity: 1 },
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
      toast.success(`${item.name} added to cart`, {
        autoClose: 1500,
        position: "top-center",
      });
    } catch (e) {
      toast.error(e?.message || "Failed to add to cart", {
        autoClose: 1500,
        position: "top-center",
      });
    } finally {
      setAddingMap((m) => {
        const copy = { ...m };
        delete copy[id];
        return copy;
      });
    }
  };

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error("GraphQL error (DialPhones):", error);
    }
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Title */}
      <h1 className="text-3xl font-bold mb-2 text-center">Kenyan Dial Phone Deals</h1>
      <p className="text-center text-gray-600 mb-6">Classic dial phones & low-cost feature phones.</p>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name/brand/category…"
          className="border rounded px-3 py-2 w-64"
        />
        <select
          value={ordering}
          onChange={(e) => setOrdering(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">Default order</option>
          <option value="created_at">Created (oldest first)</option>
          <option value="-created_at">Created (newest first)</option>
          <option value="price_min_ksh">Price (low first)</option>
          <option value="-price_min_ksh">Price (high first)</option>
          <option value="name">Name (A→Z)</option>
          <option value="-name">Name (Z→A)</option>
        </select>
      </div>

      {/* Results summary */}
      <div className="text-center mb-6 text-sm text-gray-600">
        {loading && !items.length
          ? "Loading…"
          : items.length === 0
          ? "No dial phones found."
          : count !== null
          ? `Showing ${items.length} of ${count}`
          : `Showing ${items.length}`}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {items.map((product) => {
          const isAdding = !!addingMap[product.id];
          const priceText =
            product.price_display ||
            (product.price_min_ksh ? `${Number(product.price_min_ksh).toLocaleString()} KSh` : "");
          const oldPriceText = product.price_max_ksh
            ? `${Number(product.price_max_ksh).toLocaleString()} KSh`
            : null;
          const clickable = !!product.id;

          return (
            <div
              key={product.id}
              className={[
                "relative bg-white border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 flex flex-col items-center p-4 group",
                clickable ? "cursor-pointer" : "cursor-default",
              ].join(" ")}
              onClick={() => clickable && navigate(`/dialphones/${product.id}`)}
              onKeyDown={(e) => {
                if (!clickable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/dialphones/${product.id}`);
                }
              }}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : -1}
              aria-label={clickable ? `View details for ${product.name}` : undefined}
            >
              {/* Badge */}
              {product.badge && (
                <span
                  className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold shadow-md z-20 ${
                    product.badge.includes("HOT")
                      ? "bg-gradient-to-r from-red-500 to-orange-500 text-white"
                      : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                  }`}
                >
                  {product.badge}
                </span>
              )}

              {/* Product Image */}
              <div className="relative w-full flex justify-center z-10">
                <img
                  src={product.image || FallbackImg}
                  alt={product.name}
                  className="w-full h-40 object-contain transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => { e.currentTarget.src = FallbackImg; }}
                />
              </div>

              {/* Product Name */}
              <h3 className="mt-4 text-base font-semibold text-gray-800 text-center">
                {product.name}
              </h3>
              {/* brand • category (no specs) */}
              <p className="text-xs text-gray-500">
                {([product.brand, product.category].filter(Boolean).join(" • ")) || "—"}
              </p>

              {/* Prices */}
              <div className="mt-3 text-center">
                <p className="text-lg font-bold text-green-600">{priceText}</p>
                {oldPriceText && <p className="text-sm text-gray-400 line-through">{oldPriceText}</p>}
              </div>

              {/* Buttons */}
              <div
                className="mt-4 w-full flex flex-col gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => navigate(`/dialphones/${product.id}`)}
                  className="w-full inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-900 px-4 h-11 text-sm font-medium shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                  aria-label={`View details for ${product.name}`}
                >
                  View Details
                </button>

                <button
                  className={`w-full inline-flex items-center justify-center rounded-md px-4 h-11 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition ${
                    product.product_id
                      ? isAdding
                        ? "bg-blue-600 text-white opacity-70 cursor-wait"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                  onClick={() => { if (!product.product_id || isAdding) return; handleBuyNow(product); }}
                  disabled={!product.product_id || isAdding}
                  title={product.product_id ? "Add to cart" : "Unavailable"}
                  aria-label={product.product_id ? `Buy ${product.name} now` : "Unavailable"}
                >
                  {isAdding ? "Adding…" : "Buy Now"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {(hasPrev || hasNext) && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            disabled={!hasPrev}
            onClick={goPrev}
            className={`px-4 py-2 rounded ${
              hasPrev ? "bg-gray-200 hover:bg-gray-300" : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-600">Page {page}</span>
          <button
            disabled={!hasNext}
            onClick={goNext}
            className={`px-4 py-2 rounded ${
              hasNext ? "bg-gray-200 hover:bg-gray-300" : "bg-gray-100 text-gray-400"
            }`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
