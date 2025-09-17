import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

const BRAND_OPTIONS = ["All", "Samsung", "LG", "Sony", "Hisense", "Vitron", "TCL", "Unbranded"];
const PANEL_OPTIONS = ["All", "LED", "QLED", "OLED", "NanoCell", "Crystal", "Other"];
const RES_OPTIONS = ["All", "HD", "FHD", "UHD", "8K"];

// Change this if your Woo category for TVs is different
const TV_CATEGORY_SLUG = "televisions";

/* ----------------------- GraphQL ----------------------- */

const LIST_TVS = gql`
  query TvList(
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
        date
        image { sourceUrl altText }
        productCategories { nodes { name slug } }
        productTags(first: 50) { nodes { name slug } }

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

const parseTagValue = (names, key) => {
  const row = names.find((n) => n.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  if (!row) return null;
  const val = row.split(":")[1]?.trim() || "";
  return val || null;
};

const derivePanel = (tags = []) => {
  const names = tags.map((t) => t?.name || "");
  return parseTagValue(names, "Panel") || "Other";
};

const deriveResolution = (tags = []) => {
  const names = tags.map((t) => t?.name || "");
  return parseTagValue(names, "Resolution") || "";
};

const deriveSmart = (tags = []) => {
  const names = tags.map((t) => t?.name || "");
  const v = (parseTagValue(names, "Smart") || "").toLowerCase();
  return v === "yes" || v === "true" || v === "1";
};

const deriveHDR = (tags = []) => {
  const names = tags.map((t) => t?.name || "");
  const v = (parseTagValue(names, "HDR") || "").toLowerCase();
  return v === "yes" || v === "true" || v === "1";
};

const deriveRefreshHz = (tags = []) => {
  const names = tags.map((t) => t?.name || "");
  return toNumber(parseTagValue(names, "Refresh")) || null; // e.g., "Refresh: 120"
};

const deriveSizeInches = (tags = []) => {
  const names = tags.map((t) => t?.name || "");
  return (
    toNumber(parseTagValue(names, "Size")) ??
    toNumber(parseTagValue(names, "Screen")) ??
    null
  );
};

// Map ordering select → WPGraphQL orderby (size handled client-side)
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

export default function Televisions() {
  const navigate = useNavigate();

  // data/pagination (cursor)
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(null); // unknown without extra plugin
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [endCursorStack, setEndCursorStack] = useState([null]); // index = page-1

  // UI state
  const [brand, setBrand] = useState("All");
  const [panel, setPanel] = useState("All");
  const [resolution, setResolution] = useState("All");
  const [minSize, setMinSize] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("");

  // per-card add state
  const [addingMap, setAddingMap] = useState({});

  const { field: orderbyField, order } = useMemo(
    () => mapOrdering(ordering),
    [ordering]
  );

  const { data, loading, error, refetch, fetchMore } = useQuery(LIST_TVS, {
    variables: {
      categorySlugs: [TV_CATEGORY_SLUG],
      first: pageSize,
      after: endCursorStack[page - 1] || null,
      search: search || null,
      orderbyField,
      order,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  // Normalize Woo → UI shape (brand/category from ACF meta; DO NOT show specs on list)
  const baseItems = useMemo(() => {
    const nodes = data?.products?.nodes || [];
    return nodes.map((n) => {
      const tags = n.productTags?.nodes || [];
      const panel_display = derivePanel(tags);
      const resolution_display = deriveResolution(tags);
      const smart = deriveSmart(tags);
      const hdr = deriveHDR(tags);
      const refresh_rate_hz = deriveRefreshHz(tags);
      const screen_size_inches = deriveSizeInches(tags);

      const brand_display = n?.meta?.brand?.trim?.() || "Unbranded";
      const category_display = n?.meta?.category?.trim?.() || "";

      const current = toNumber(n.salePrice || n.price || n.regularPrice);
      const crossed = n.onSale && n.regularPrice ? toNumber(n.regularPrice) : null;

      return {
        id: n.databaseId ?? n.id,
        slug: n.slug,
        name: n.name,
        image: n.image?.sourceUrl || "",
        brand_display,
        category_display,
        panel_display,
        resolution_display,
        smart,
        hdr,
        refresh_rate_hz,
        screen_size_inches,
        price_display: current != null ? `KSh ${current.toLocaleString()}` : "",
        price_min_ksh: current,
        price_max_ksh: crossed,
        product_id: n.databaseId || null,
      };
    });
  }, [data]);

  // Client-side filters (brand/panel/resolution/size/search)
  const filtered = useMemo(() => {
    const min = toNumber(minSize);
    const max = toNumber(maxSize);
    return baseItems.filter((it) => {
      const brandOk =
        brand === "All" ||
        (it.brand_display || "").toLowerCase() === brand.toLowerCase();

      const panelOk =
        panel === "All" ||
        (it.panel_display || "Other").toLowerCase() === panel.toLowerCase();

      const resOk =
        resolution === "All" ||
        (it.resolution_display || "").toLowerCase() === resolution.toLowerCase();

      const sizeOk =
        (min == null || (it.screen_size_inches ?? Infinity) >= min) &&
        (max == null || (it.screen_size_inches ?? -Infinity) <= max);

      const searchOk =
        !search ||
        [it.name, it.brand_display, it.category_display, it.panel_display, it.resolution_display]
          .filter(Boolean)
          .some((t) => t.toLowerCase().includes(search.toLowerCase()));

      return brandOk && panelOk && resOk && sizeOk && searchOk;
    });
  }, [baseItems, brand, panel, resolution, minSize, maxSize, search]);

  // Size ordering (client-side)
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp = (a, b, key, asc = true) => {
      const va = a[key] ?? Number.NEGATIVE_INFINITY;
      const vb = b[key] ?? Number.NEGATIVE_INFINITY;
      return asc ? va - vb : vb - va;
    };
    switch (ordering) {
      case "screen_size_inches": arr.sort((a, b) => cmp(a, b, "screen_size_inches", true)); break;
      case "-screen_size_inches": arr.sort((a, b) => cmp(a, b, "screen_size_inches", false)); break;
      default: /* server handles others */ break;
    }
    return arr;
  }, [filtered, ordering]);

  // Group by brand as in your UI
  const grouped = useMemo(() => {
    const map = new Map();
    for (const tv of sorted) {
      const key = tv?.brand_display || "Unbranded";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(tv);
    }
    return map;
  }, [sorted]);

  const sectionOrder = useMemo(() => Array.from(grouped.keys()), [grouped]);

  // reflect into items for the summary text
  useEffect(() => {
    setItems(sorted);
    setCount(null);
  }, [sorted]);

  // reset pagination when inputs change
  useEffect(() => {
    setPage(1);
    setEndCursorStack([null]);
    refetch({
      categorySlugs: [TV_CATEGORY_SLUG],
      first: pageSize,
      after: null,
      search: search || null,
      orderbyField,
      order,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, panel, resolution, minSize, maxSize, search, ordering, orderbyField, order, pageSize, refetch]);

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
        categorySlugs: [TV_CATEGORY_SLUG],
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
      categorySlugs: [TV_CATEGORY_SLUG],
      first: pageSize,
      after,
      search: search || null,
      orderbyField,
      order,
    });
  };

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  const handleBuyNow = async (tv) => {
    if (!tv?.product_id) {
      toast.error("This item is not available for purchase yet.");
      return;
    }
    const id = tv.id;
    setAddingMap((m) => ({ ...m, [id]: true }));
    try {
      const res = await mutateAddToCart({
        variables: { productId: tv.product_id, quantity: 1 },
      });
      const newCount = res?.data?.addToCart?.cart?.contents?.itemCount;
      if (typeof newCount === "number") {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { count: newCount } }));
      } else {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: 1 } }));
      }
      toast.success(`${tv.name} added to cart`);
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

  const goToDetail = (id) => {
    try {
      (document.scrollingElement || document.documentElement || document.body)?.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
    navigate(`/televisions/${id}`);
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
      console.error("GraphQL error (Televisions):", error);
    }
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Title */}
      <h1 className="text-3xl font-bold mb-2 text-center">Shop Televisions in Kenya (2025)</h1>
      <p className="text-center text-gray-600 mb-6">
        OLED, QLED, LED, 4K &amp; 8K smart TVs—find your perfect screen size and panel.
      </p>

      {/* Brand filter as pills */}
      <div className="flex flex-wrap justify-center gap-2 mb-5">
        {BRAND_OPTIONS.map((b) => (
          <button
            key={b}
            onClick={() => setBrand(b)}
            className={`px-4 py-2 rounded-full border text-sm transition ${
              brand === b
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* Other Filters */}
      <div className="flex flex-wrap justify-center gap-3 mb-5">
        {/* Panel */}
        <select value={panel} onChange={(e) => setPanel(e.target.value)} className="border rounded px-3 py-2">
          {PANEL_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Resolution */}
        <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="border rounded px-3 py-2">
          {RES_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {/* Size range */}
        <input
          value={minSize}
          onChange={(e) => setMinSize(e.target.value)}
          placeholder="Min size (inches)"
          className="border rounded px-3 py-2 w-40"
          inputMode="numeric"
        />
        <input
          value={maxSize}
          onChange={(e) => setMaxSize(e.target.value)}
          placeholder="Max size (inches)"
          className="border rounded px-3 py-2 w-40"
          inputMode="numeric"
        />

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name/brand/category/panel…"
          className="border rounded px-3 py-2 w-72"
        />

        {/* Ordering */}
        <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className="border rounded px-3 py-2">
          <option value="">Default order</option>
          <option value="created_at">Created (oldest first)</option>
          <option value="-created_at">Created (newest first)</option>
          <option value="price_min_ksh">Price (low first)</option>
          <option value="-price_min_ksh">Price (high first)</option>
          <option value="screen_size_inches">Size (small→large)</option>
          <option value="-screen_size_inches">Size (large→small)</option>
          <option value="name">Name (A→Z)</option>
          <option value="-name">Name (Z→A)</option>
        </select>
      </div>

      {/* Results summary */}
      <div className="text-center mb-6 text-sm text-gray-600">
        {loading && !items.length
          ? "Loading…"
          : items.length === 0
          ? "No televisions found."
          : count !== null
          ? `Showing ${items.length} of ${count}`
          : `Showing ${items.length}`}
      </div>

      {/* Brand sections */}
      {sectionOrder.map((brandKey) => (
        <section key={brandKey} className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-center">{brandKey}</h2>

          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {grouped.get(brandKey)?.map((tv) => {
              const isAdding = !!addingMap[tv.id];
              const sizeBadge = `${tv?.screen_size_inches ?? ""}"`;
              const panelBadge = tv?.panel_display || "";

              return (
                <div
                  key={tv.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => goToDetail(tv.id)}
                  onKeyDown={(e) => handleCardKeyDown(e, tv.id)}
                  className="group flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg transition-shadow overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                  aria-label={`View details for ${tv.name}`}
                >
                  {/* Subtle gradient header bar */}
                  <div className="h-1.5 bg-gradient-to-r from-blue-500/70 via-indigo-500/70 to-purple-500/70" />

                  <div className="p-4 flex flex-col flex-1">
                    <div className="relative w-full h-56 bg-white rounded-xl border flex items-center justify-center mb-3">
                      <img
                        src={tv.image || FallbackImg}
                        alt={tv.name}
                        className="max-h-full max-w-full object-contain transform transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = FallbackImg; }}
                      />

                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex gap-2">
                        {tv.smart && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Smart TV
                          </span>
                        )}
                        {tv.hdr && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            HDR
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-2 right-2 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border">
                        {sizeBadge} • {panelBadge}
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold leading-snug mb-1 line-clamp-2">{tv.name}</h3>

                    {/* brand • category only (no specs in list) */}
                    <p className="text-gray-600 text-sm mb-3">
                      {[tv.brand_display, tv.category_display].filter(Boolean).join(" • ") || "Unbranded"}
                    </p>

                    <div className="text-indigo-600 font-bold text-base mb-4">{tv.price_display}</div>

                    {/* Vertical buttons */}
                    <div className="mt-auto grid grid-cols-1 gap-2">
                      <button
                        className="inline-flex items-center justify-center rounded-xl border bg-white hover:bg-gray-50 text-gray-900 py-2 px-3 transition"
                        onClick={(e) => { e.stopPropagation(); goToDetail(tv.id); }}
                      >
                        View Details
                      </button>

                      <button
                        className={`inline-flex items-center justify-center rounded-xl py-2 px-3 transition ${
                          tv.product_id
                            ? isAdding
                              ? "bg-indigo-600 text-white opacity-70 cursor-wait"
                              : "bg-indigo-600 hover:bg-indigo-700 text-white"
                            : "bg-gray-200 text-gray-500 cursor-not-allowed"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!tv.product_id || isAdding) return;
                          handleBuyNow(tv);
                        }}
                        disabled={!tv.product_id || isAdding}
                        title={tv.product_id ? "Add to cart" : "Unavailable"}
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
            className={`px-4 py-2 rounded ${hasPrev ? "bg-gray-200 hover:bg-gray-300" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-600">Page {page}</span>
          <button
            disabled={!hasNext}
            onClick={goNext}
            className={`px-4 py-2 rounded ${hasNext ? "bg-gray-200 hover:bg-gray-300" : "bg-gray-100 text-gray-400"}`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
