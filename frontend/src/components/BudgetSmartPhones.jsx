import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

const BRAND_OPTIONS = ["All", "Xiaomi", "Infinix", "Samsung", "Tecno", "Itel", "Realme", "Nokia", "Vivo", "Oppo", "Villaon", "Unbranded"];
const BADGE_OPTIONS = ["All", "OPEN", "OPEN HOT"];

const skeleton = new Array(10).fill(0);

// Adjust this if you filed these under another category
const BUDGET_SMARTPHONES_CATEGORY_SLUG = "budget-smartphones";

/* ----------------------- GraphQL ----------------------- */

const LIST_PRODUCTS = gql`
  query BudgetPhones(
    $categorySlugs: [String]!
    $first: Int = 20
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

        # Pull ACF meta group (brand, category, specs)
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
  // You’re using OPEN / OPEN HOT in UI
  if (names.includes("OPEN HOT")) return "OPEN HOT";
  if (names.includes("OPEN")) return "OPEN";
  return "";
};

// Map your ordering select → WPGraphQL orderby
const mapOrdering = (ordering) => {
  // Defaults
  let field = "DATE";
  let order = "DESC";

  switch (ordering) {
    case "created_at":
      field = "DATE";
      order = "ASC";
      break;
    case "-created_at":
      field = "DATE";
      order = "DESC";
      break;
    case "name":
      field = "TITLE";
      order = "ASC";
      break;
    case "-name":
      field = "TITLE";
      order = "DESC";
      break;
    case "price_min_ksh":
      field = "PRICE";
      order = "ASC";
      break;
    case "-price_min_ksh":
      field = "PRICE";
      order = "DESC";
      break;
    default:
      // keep default (DATE DESC)
      break;
  }
  return { field, order };
};

/* ----------------------- component ----------------------- */

export default function BudgetSmartphoneDeals() {
  const navigate = useNavigate();

  const [brand, setBrand] = useState("All");
  const [badge, setBadge] = useState("All");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [addingMap, setAddingMap] = useState({});
  const [endCursorStack, setEndCursorStack] = useState([null]); // index = page-1

  const { field: orderbyField, order } = useMemo(
    () => mapOrdering(ordering),
    [ordering]
  );

  const { data, loading, error, refetch, fetchMore } = useQuery(LIST_PRODUCTS, {
    variables: {
      categorySlugs: [BUDGET_SMARTPHONES_CATEGORY_SLUG],
      first: pageSize,
      after: endCursorStack[page - 1] || null,
      search: search || null,
      orderbyField,
      order,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  // Reset to page 1 when filters/search/order change
  useEffect(() => {
    setPage(1);
    setEndCursorStack([null]);
    refetch({
      categorySlugs: [BUDGET_SMARTPHONES_CATEGORY_SLUG],
      first: pageSize,
      after: null,
      search: search || null,
      orderbyField,
      order,
    });
  }, [search, ordering, orderbyField, order, pageSize, refetch]);

  // Normalize products to your UI shape
  const items = useMemo(() => {
    const nodes = data?.products?.nodes || [];
    return nodes.map((n) => {
      // Use ACF meta group only for brand/category; DO NOT display specs here
      const brand_from_meta = n?.meta?.brand?.trim?.() || "Unbranded";
      const category_from_meta = n?.meta?.category?.trim?.() || "";

      const badgeName = deriveBadge(n.productTags?.nodes || []);
      const priceRaw = n.salePrice || n.price || n.regularPrice || null;

      return {
        id: n.databaseId ?? n.id,
        name: n.name,
        image: n.image?.sourceUrl || "",
        brand: brand_from_meta,
        category: category_from_meta,
        badge: badgeName || "",
        price_display: money(priceRaw) || "—",
        price_max_ksh:
          n.onSale && n.regularPrice ? Number(String(n.regularPrice).replace(/[^\d.]/g, "")) : null,
        product_id: n.databaseId || null,
      };
    });
  }, [data]);

  // Client-side filters to preserve your UI (brand/badge)
  const filtered = useMemo(() => {
    return items.filter((p) => {
      const brandOk =
        brand === "All" ||
        (p.brand || "").toLowerCase() === brand.toLowerCase();
      const badgeOk =
        badge === "All" ||
        (p.badge || "").toUpperCase() === badge.toUpperCase();
      // simple search across name/brand/category
      const searchOk =
        !search ||
        [p.name, p.brand, p.category]
          .filter(Boolean)
          .some((t) => t.toLowerCase().includes(search.toLowerCase()));
      return brandOk && badgeOk && searchOk;
    });
  }, [items, brand, badge, search]);

  // Pagination flags
  const hasNext = !!data?.products?.pageInfo?.hasNextPage;
  const hasPrev = page > 1;

  // Count-like summary (WPGraphQL doesn’t give total easily without extra plugins)
  const count = null; // keep null to preserve your summary logic

  const goNext = async () => {
    if (!hasNext) return;
    const after = data?.products?.pageInfo?.endCursor || null;
    // store cursor for the next page
    setEndCursorStack((stack) => {
      const nextStack = [...stack];
      nextStack[page] = after; // index for next page
      return nextStack;
    });
    setPage((p) => p + 1);

    await fetchMore({
      variables: {
        categorySlugs: [BUDGET_SMARTPHONES_CATEGORY_SLUG],
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
      categorySlugs: [BUDGET_SMARTPHONES_CATEGORY_SLUG],
      first: pageSize,
      after,
      search: search || null,
      orderbyField,
      order,
    });
  };

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  const handleBuyNow = async (phone) => {
    if (!phone?.product_id) {
      toast.error("This item is not available for purchase yet.", {
        autoClose: 1500,
        position: "top-center",
      });
      return;
    }
    const id = phone.id;
    setAddingMap((m) => ({ ...m, [id]: true }));
    try {
      const res = await mutateAddToCart({
        variables: { productId: phone.product_id, quantity: 1 },
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
      toast.success(`${phone.name} added to cart`, {
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
      console.error("GraphQL error (BudgetSmartphoneDeals):", error);
    }
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Title */}
      <h2 className="text-lg font-bold mb-6 text-gray-800 text-center">Budget Smartphone Deals</h2>

      {/* Filters */}
      <div className="flex flex-wrap justify-center gap-3 mb-5">
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="border rounded px-3 py-2">
          {BRAND_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>

        <select value={badge} onChange={(e) => setBadge(e.target.value)} className="border rounded px-3 py-2">
          {BADGE_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search phone/model/brand/category…"
          className="border rounded px-3 py-2 w-72"
        />

        <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className="border rounded px-3 py-2">
          <option value="">Default order</option>
          <option value="created_at">Created (oldest first)</option>
          <option value="-created_at">Created (newest first)</option>
          <option value="price_min_ksh">Price (low first)</option>
          <option value="-price_min_ksh">Price (high first)</option>
          <option value="name">Name (A→Z)</option>
          <option value="-name">Name (Z→A)</option>
        </select>
      </div>

      {/* Summary */}
      <div className="text-center mb-6 text-sm text-gray-600">
        {loading && !items.length
          ? "Loading…"
          : (filtered.length === 0 ? "No budget smartphones found." :
            (count !== null ? `Showing ${filtered.length} of ${count}` : `Showing ${filtered.length}`))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {(filtered.length ? filtered : skeleton).map((p, idx) => {
          const k = p?.id ?? `s-${idx}`;
          const isAdding = !!addingMap[p?.id];
          const clickable = !!p?.id;

          return (
            <div
              key={k}
              className={[
                "relative border border-gray-300 rounded-lg p-3 pt-8 flex flex-col items-center group shadow-sm hover:shadow-lg hover:border-blue-500 transition-all duration-300 ease-in-out transform hover:-translate-y-2 bg-white",
                clickable ? "cursor-pointer" : "cursor-default"
              ].join(" ")}
              onClick={() => clickable && navigate(`/budget-smartphones/${p.id}`)}
              onKeyDown={(e) => {
                if (!clickable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/budget-smartphones/${p.id}`);
                }
              }}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : -1}
              aria-label={clickable ? `View details for ${p?.name ?? "item"}` : undefined}
            >
              {/* Badge */}
              {p?.badge && (
                <span
                  className={`absolute top-2 left-2 z-10 ${
                    p.badge.includes("HOT") ? "bg-gradient-to-r from-blue-500 to-blue-700" : "bg-gradient-to-r from-red-500 to-red-700"
                  } text-white text-xs font-bold px-2 py-1 rounded-full shadow-md`}
                >
                  {p.badge}
                </span>
              )}

              {/* Image */}
              <div className="relative w-full overflow-hidden rounded-lg">
                {p ? (
                  <img
                    src={p.image || FallbackImg}
                    alt={p.name || "item"}
                    className="w-full h-40 object-contain transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => { e.currentTarget.src = FallbackImg; }}
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-40 bg-gray-100 animate-pulse rounded-lg" />
                )}
                <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-blue-500 transition-all duration-300 group-hover:w-full" />
              </div>

              {/* Name & meta (brand • category) */}
              <h3 className="mt-3 text-sm font-semibold text-center text-gray-800 group-hover:text-blue-600 transition-colors duration-300">
                {p?.name || "—"}
              </h3>
              <p className="text-xs text-gray-500">
                {([p?.brand, p?.category].filter(Boolean).join(" • ")) || "—"}
              </p>

              {/* Prices */}
              <div className="mt-2 text-center">
                <p className="text-red-500 font-bold">{p?.price_display || "—"}</p>
                {p?.price_max_ksh ? (
                  <p className="text-gray-400 text-sm line-through">
                    {`${Number(p.price_max_ksh).toLocaleString()} KSh`}
                  </p>
                ) : null}
              </div>

              {/* Actions */}
              <div
                className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* View Details */}
                <button
                  className="w-full inline-flex items-center justify-center rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm font-medium shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                  onClick={() => p?.id && navigate(`/budget-smartphones/${p.id}`)}
                  disabled={!p?.id}
                  title="View Details"
                >
                  View Details
                </button>

                {/* Buy Now */}
                <button
                  className={`w-full inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition ${
                    p?.product_id
                      ? isAdding
                        ? "bg-blue-600 text-white opacity-70 cursor-wait"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                  onClick={() => {
                    if (!p?.product_id || isAdding) return;
                    handleBuyNow(p);
                  }}
                  disabled={!p?.product_id || isAdding}
                  title={p?.product_id ? "Add to cart" : "Unavailable"}
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
              hasPrev
                ? "bg-gray-200 hover:bg-gray-300"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-600">Page {page}</span>
          <button
            disabled={!hasNext}
            onClick={goNext}
            className={`px-4 py-2 rounded ${
              hasNext
                ? "bg-gray-200 hover:bg-gray-300"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
