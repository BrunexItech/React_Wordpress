import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";
const BRAND_OPTIONS = ["All", "Samsung", "Apple", "Tecno", "Infinix", "Xiaomi/POCO", "OPPO", "Unbranded"];

// Adjust this if your smartphones live under a different Woo category
const SMARTPHONES_CATEGORY_SLUG = "smartphones";

/* ----------------------- GraphQL ----------------------- */

const LIST_PRODUCTS = gql`
  query SmartphonesList(
    $categorySlugs: [String]!
    $first: Int = 12
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
        productTags(first: 30) { nodes { name slug } }
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

const toNumber = (raw) => {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? null : n;
};

/* ----------------------- component ----------------------- */

export default function Smartphones() {
  const navigate = useNavigate();

  // Data + pagination (cursor)
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [endCursorStack, setEndCursorStack] = useState([null]); // index = page-1

  // UI state
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("");

  // Per-card add-to-cart busy state
  const [addingMap, setAddingMap] = useState({}); // { [phoneId]: true }

  // Map ordering select → WPGraphQL orderby
  const mapOrdering = (ordering) => {
    let field = "DATE";
    let order = "DESC";
    switch (ordering) {
      case "created_at": field = "DATE"; order = "ASC"; break;
      case "-created_at": field = "DATE"; order = "DESC"; break;
      case "name": field = "TITLE"; order = "ASC"; break;
      case "-name": field = "TITLE"; order = "DESC"; break;
      case "price_min_ksh": field = "PRICE"; order = "ASC"; break;
      case "-price_min_ksh": field = "PRICE"; order = "DESC"; break;
      default: break;
    }
    return { field, order };
  };

  const { field: orderbyField, order } = useMemo(
    () => mapOrdering(ordering),
    [ordering]
  );

  const { data, loading, error, refetch, fetchMore } = useQuery(LIST_PRODUCTS, {
    variables: {
      categorySlugs: [SMARTPHONES_CATEGORY_SLUG],
      first: pageSize,
      after: endCursorStack[page - 1] || null,
      search: search || null,
      orderbyField,
      order,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  // Normalize raw nodes to UI shape (brand/category from ACF meta; DO NOT show specs on list)
  const allItems = useMemo(() => {
    const nodes = data?.products?.nodes || [];
    return nodes.map((n) => {
      const brand = n?.meta?.brand?.trim?.() || "Unbranded";
      const category = n?.meta?.category?.trim?.() || "";

      const current = toNumber(n.salePrice || n.price || n.regularPrice);
      const crossed = n.onSale && n.regularPrice ? toNumber(n.regularPrice) : null;

      return {
        id: n.databaseId ?? n.id,
        slug: n.slug,
        name: n.name,
        image: n.image?.sourceUrl || "",
        brand_display: brand,
        category_display: category,
        price_display: current != null ? `${current.toLocaleString()} KSh` : "",
        price_min_ksh: current,
        price_max_ksh: crossed,
        product_id: n.databaseId || null,
      };
    });
  }, [data]);

  // Client-side brand filter
  const itemsFiltered = useMemo(() => {
    if (filter === "All") return allItems;
    // Special case "Xiaomi/POCO": treat either value as a match if your data varies
    const normalized = (s) => (s || "").toLowerCase();
    return allItems.filter((p) => {
      const b = normalized(p.brand_display);
      const f = normalized(filter);
      if (f === "xiaomi/poco") return b.includes("xiaomi") || b.includes("poco");
      return b === f;
    });
  }, [allItems, filter]);

  // Group by brand for sections (keeps your section UI)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const p of itemsFiltered) {
      const key = p.brand_display || "Unbranded";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    }
    return map;
  }, [itemsFiltered]);

  const sectionBrands = useMemo(() => Array.from(grouped.keys()), [grouped]);

  // Reset to page 1 when changing filters/search/order
  useEffect(() => {
    setPage(1);
    setEndCursorStack([null]);
    refetch({
      categorySlugs: [SMARTPHONES_CATEGORY_SLUG],
      first: pageSize,
      after: null,
      search: search || null,
      orderbyField,
      order,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, ordering, orderbyField, order, pageSize, refetch]);

  // Keep items for summary
  useEffect(() => {
    setItems(itemsFiltered);
    setCount(null);
  }, [itemsFiltered]);

  const hasNext = !!data?.products?.pageInfo?.hasNextPage;
  const hasPrev = page > 1;

  const goNext = async () => {
    if (!hasNext) return;
    const after = data?.products?.pageInfo?.endCursor || null;
    setEndCursorStack((stack) => {
      const nextStack = [...stack];
      nextStack[page] = after;
      return nextStack;
    });
    setPage((p) => p + 1);
    await fetchMore({
      variables: {
        categorySlugs: [SMARTPHONES_CATEGORY_SLUG],
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
      categorySlugs: [SMARTPHONES_CATEGORY_SLUG],
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
      toast.error("This smartphone is not available for purchase yet.");
      return;
    }
    const pid = phone.id;
    setAddingMap((m) => ({ ...m, [pid]: true }));
    try {
      const res = await mutateAddToCart({
        variables: { productId: phone.product_id, quantity: 1 },
      });
      const newCount = res?.data?.addToCart?.cart?.contents?.itemCount;
      if (typeof newCount === "number") {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { count: newCount } }));
      } else {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: 1 } }));
      }
      toast.success(`${phone.name} added to cart`);
    } catch (e) {
      toast.error(e?.message || "Failed to add to cart");
    } finally {
      setAddingMap((m) => { const copy = { ...m }; delete copy[pid]; return copy; });
    }
  };

  const goToDetail = (id) => {
    try {
      (document.scrollingElement || document.documentElement || document.body)
        ?.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
    navigate(`/smartphone/${id}`);
  };

  const handleCardKeyDown = (e, id) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToDetail(id);
    }
  };

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error("GraphQL error (Smartphones):", error);
    }
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-center text-3xl font-bold">Top Smartphones in Kenya (2025)</h1>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {BRAND_OPTIONS.map((b) => (
          <button
            key={b}
            onClick={() => setFilter(b)}
            className={`rounded px-4 py-2 shadow ${
              filter === b ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap justify-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name/brand/category…"
          className="w-72 rounded border px-3 py-2"
        />
        <select
          value={ordering}
          onChange={(e) => setOrdering(e.target.value)}
          className="rounded border px-3 py-2"
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
      <div className="mb-6 text-center text-sm text-gray-600">
        {loading && !items.length
          ? "Loading…"
          : items.length === 0
          ? "No smartphones found."
          : count !== null
          ? `Showing ${items.length} of ${count}`
          : `Showing ${items.length}`}
      </div>

      {/* Sections */}
      {sectionBrands.map((brand) => (
        <section key={brand} className="mb-12">
          <h2 className="mb-4 text-center text-2xl font-semibold">{brand}</h2>
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {grouped.get(brand)?.map((p) => {
              const isAdding = !!addingMap[p.id];
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => goToDetail(p.id)}
                  onKeyDown={(e) => handleCardKeyDown(e, p.id)}
                  className="flex flex-col rounded-lg border bg-white shadow transition hover:shadow-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={`View details for ${p.name}`}
                >
                  <div className="flex h-48 w-full items-center justify-center rounded-t-lg bg-white">
                    <img
                      src={p.image || FallbackImg}
                      alt={p.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = FallbackImg; }}
                    />
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="mb-1 text-xl font-semibold">{p.name}</h3>

                    {/* brand • category only */}
                    <p className="mb-2 text-gray-700 text-sm">
                      {[p.brand_display, p.category_display].filter(Boolean).join(" • ") || "Unbranded"}
                    </p>

                    <p className="mb-4 font-bold text-blue-600">
                      {p.price_display ||
                        (p.price_max_ksh
                          ? `${p.price_min_ksh} – ${p.price_max_ksh} KSh`
                          : `${p.price_min_ksh ?? ""} KSh`)}
                    </p>

                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <button
                        className="rounded bg-gray-100 py-2 text-gray-900 transition hover:bg-gray-200"
                        onClick={(e) => { e.stopPropagation(); goToDetail(p.id); }}
                      >
                        View Details
                      </button>

                      <button
                        className={`rounded py-2 transition ${
                          p.product_id
                            ? isAdding
                              ? "cursor-wait bg-blue-600 text-white opacity-70"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                            : "cursor-not-allowed bg-gray-200 text-gray-500"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!p.product_id || isAdding) return;
                          handleBuyNow(p);
                        }}
                        disabled={!p.product_id || isAdding}
                        title={p.product_id ? "Add to cart" : "Unavailable"}
                      >
                        {isAdding ? "Adding…" : "Buy Now"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Pagination */}
      {(hasPrev || hasNext) && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            disabled={!hasPrev}
            onClick={goPrev}
            className={`rounded px-4 py-2 ${
              hasPrev ? "bg-gray-200 hover:bg-gray-300" : "cursor-not-allowed bg-gray-100 text-gray-400"
            }`}
          >
            ← Previous
          </button>

          <span className="text-sm text-gray-600">Page {page}</span>

          <button
            disabled={!hasNext}
            onClick={goNext}
            className={`rounded px-4 py-2 ${
              hasNext ? "bg-gray-200 hover:bg-gray-300" : "cursor-not-allowed bg-gray-100 text-gray-400"
            }`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
