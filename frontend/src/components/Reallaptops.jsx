import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

// Woo category slug for laptops
const LAPTOPS_CATEGORY_SLUG = "laptops";

/* ----------------------- GraphQL ----------------------- */

const LIST_LAPTOP_PRODUCTS = gql`
  query LaptopProducts(
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
      pageInfo { hasNextPage endCursor }
      nodes {
        __typename
        id
        databaseId
        slug
        name
        image { sourceUrl altText }
        productTags(first: 50) { nodes { name slug } }

        # Pull ACF meta group (brand, category, specs). Specs is NOT displayed here.
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

const normalizeNode = (n) => {
  const names = (n.productTags?.nodes || []).map((t) => t?.name || "");

  // Prefer ACF meta for brand/category/specs (like Budget Smartphones)
  const brand_from_meta = n?.meta?.brand?.trim?.() || "Unbranded";
  const category_from_meta = n?.meta?.category?.trim?.() || "";
  const specs_from_meta = n?.meta?.specs?.trim?.() || ""; // kept for search only; not displayed here

  // Optional discount tag (if you still use it)
  const discount = parseTagValue(names, "Discount") || "";

  const current = toNumber(n.salePrice || n.price || n.regularPrice);
  const crossed = n.onSale && n.regularPrice ? toNumber(n.regularPrice) : null;

  return {
    id: n.databaseId ?? n.id,
    slug: n.slug,
    name: n.name,
    image: n.image?.sourceUrl || "",
    brand: brand_from_meta,
    category: category_from_meta,
    // keep specs for search but DO NOT render on list
    specs_text: specs_from_meta,
    price_display: current != null ? `KSh ${current.toLocaleString()}` : "",
    price_min_ksh: current,
    price_max_ksh: crossed,
    discount,
    product_id: n.databaseId || null,
  };
};

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

/* ----------------------- component ----------------------- */

export default function Reallaptops() {
  const navigate = useNavigate();

  // Data + pagination (cursor)
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [endCursorStack, setEndCursorStack] = useState([null]); // index = page-1

  // UI state
  const [filter, setFilter] = useState("All"); // brand filter
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("");

  // add-to-cart busy state
  const [addingMap, setAddingMap] = useState({});

  const { field: orderbyField, order } = useMemo(
    () => mapOrdering(ordering),
    [ordering]
  );

  const { data, loading, error, refetch, fetchMore } = useQuery(LIST_LAPTOP_PRODUCTS, {
    variables: {
      categorySlugs: [LAPTOPS_CATEGORY_SLUG],
      first: pageSize,
      after: endCursorStack[page - 1] || null,
      search: search || null,
      orderbyField,
      order,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  // Normalize
  const baseItems = useMemo(() => {
    const nodes = data?.products?.nodes || [];
    return nodes.map(normalizeNode);
  }, [data]);

  // Group by brand (like others)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const t of baseItems) {
      const key = (t.brand || "Unbranded").trim() || "Unbranded";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return map;
  }, [baseItems]);

  const brandOptions = useMemo(() => {
    const arr = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
    return ["All", ...arr];
  }, [grouped]);

  // Filters (brand + search across name/brand/category/specs_text)
  const filtered = useMemo(() => {
    return baseItems.filter((t) => {
      const brandOK = filter === "All" || (t.brand || "Unbranded").toLowerCase() === filter.toLowerCase();
      const searchOK =
        !search ||
        [t.name, t.brand, t.category, t.specs_text]
          .filter(Boolean)
          .some((s) => s.toLowerCase().includes(search.toLowerCase()));
      return brandOK && searchOK;
    });
  }, [baseItems, filter, search]);

  const filteredGrouped = useMemo(() => {
    const map = new Map();
    for (const t of filtered) {
      const key = (t.brand || "Unbranded").trim() || "Unbranded";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return map;
  }, [filtered]);

  const sectionBrands = useMemo(() => {
    if (filter === "All") return Array.from(filteredGrouped.keys());
    return filteredGrouped.has(filter) ? [filter] : [];
  }, [filter, filteredGrouped]);

  // expose items for the summary text
  useEffect(() => {
    setItems(filtered);
    setCount(null);
  }, [filtered]);

  // reset pagination on filters/search/order change
  useEffect(() => {
    setPage(1);
    setEndCursorStack([null]);
    refetch({
      categorySlugs: [LAPTOPS_CATEGORY_SLUG],
      first: pageSize,
      after: null,
      search: search || null,
      orderbyField,
      order,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search, ordering, orderbyField, order, pageSize, refetch]);

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
        categorySlugs: [LAPTOPS_CATEGORY_SLUG],
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
      categorySlugs: [LAPTOPS_CATEGORY_SLUG],
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
      toast.error("This item is not available for purchase yet.");
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
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { count: newCount } }));
      } else {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: 1 } }));
      }
      toast.success(`${item.name} added to cart`);
    } catch (e) {
      toast.error(e?.message || "Failed to add to cart");
    } finally {
      setAddingMap((m) => {
        const copy = { ...m };
        delete copy[id];
        return copy;
      });
    }
  };

  const scrollToTop = (behavior = "smooth") => {
    try {
      (document.scrollingElement || document.documentElement || document.body)?.scrollTo({ top: 0, behavior });
    } catch {}
  };
  const goToDetail = (id) => {
    scrollToTop();
    navigate(`/reallaptop/${id}`);
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
      console.error("GraphQL error (Reallaptops):", error);
    }
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Title */}
      <h1 className="text-3xl font-bold mb-6 text-center">Top Laptops in Kenya (2025)</h1>

      {/* Brand filter as pills */}
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {brandOptions.map((b) => (
          <button
            key={b}
            onClick={() => setFilter(b)}
            className={`py-2 px-4 rounded-full border text-sm transition ${
              filter === b
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Search + ordering */}
      <div className="flex flex-wrap gap-3 justify-center mb-8">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name/brand/category…"
          className="border rounded px-3 py-2 w-72"
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

      {/* Summary */}
      <div className="text-center mb-6 text-sm text-gray-600">
        {loading && !items.length
          ? "Loading…"
          : items.length === 0
          ? "No laptops found."
          : count !== null
          ? `Showing ${items.length} of ${count}`
          : `Showing ${items.length}`}
      </div>

      {/* Sections by brand */}
      {sectionBrands.map((brand) => (
        <section key={brand} className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-center">{brand}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {filteredGrouped.get(brand)?.map((t) => {
              const isAdding = !!addingMap[t.id];
              const priceText =
                t.price_display ||
                (t.price_min_ksh != null ? `KSh ${t.price_min_ksh.toLocaleString()}` : "");
              const oldPriceText = t.price_max_ksh ? `KSh ${t.price_max_ksh.toLocaleString()}` : null;

              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${t.name}`}
                  onClick={() => goToDetail(t.id)}
                  onKeyDown={(e) => handleCardKeyDown(e, t.id)}
                  className="group flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-lg transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <div className="relative w-full h-48 bg-white rounded-t-2xl flex items-center justify-center">
                    {t.discount && (
                      <span className="absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-semibold bg-green-600 text-white shadow">
                        {t.discount}
                      </span>
                    )}
                    <img
                      src={t.image || FallbackImg}
                      alt={t.name}
                      className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                      onError={(e) => { e.currentTarget.src = FallbackImg; }}
                      loading="lazy"
                    />
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-lg font-semibold leading-snug line-clamp-2">{t.name}</h3>

                    {/* brand • category (like Budget Smartphones) */}
                    <p className="text-gray-600 text-sm mt-1">
                      {[t.brand, t.category].filter(Boolean).join(" • ") || "—"}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-blue-600 font-bold">{priceText}</span>
                      {oldPriceText && (
                        <span className="text-gray-400 line-through text-xs">{oldPriceText}</span>
                      )}
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                      <button
                        className="rounded-md border bg-white hover:bg-gray-50 text-gray-900 py-2 px-3 text-sm transition"
                        onClick={(e) => { e.stopPropagation(); goToDetail(t.id); }}
                      >
                        View Details
                      </button>
                      <button
                        className={`rounded-md py-2 px-3 text-sm transition ${
                          t.product_id
                            ? isAdding
                              ? "bg-blue-600 text-white opacity-70 cursor-wait"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-gray-200 text-gray-500 cursor-not-allowed"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!t.product_id || isAdding) return;
                          handleBuyNow(t);
                        }}
                        disabled={!t.product_id || isAdding}
                        title={t.product_id ? "Add to cart" : "Unavailable"}
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
              hasNext ? "bg-gray-200 hover:bg-gray-300" : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
