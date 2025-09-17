import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

// Static filter options (you can make these dynamic later)
const BRAND_OPTIONS = ["All", "Samsung", "M-KOPA", "Nokia", "Tecno", "Infinix", "itel", "Unbranded"];
const CATEGORY_OPTIONS = ["All", "Smartphones", "Feature Phones", "Others"];

// Adjust this if your M-KOPA items live under a different Woo category
const MKOPA_CATEGORY_SLUG = "mkopa";

/* ----------------------- GraphQL ----------------------- */

const LIST_PRODUCTS = gql`
  query MkopaList(
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
        productCategories { nodes { name slug } }
        productTags(first: 40) { nodes { name slug } }

        # ACF group: Meta (GraphQL field name: meta)
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
          # ACF group: paymentPlanMkopa (works already)
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

// Prefer ACF payment plan if present; otherwise fall back to tags
const planFromAcf = (n) => {
  const g = n?.paymentPlanMkopa;
  if (!g) return {};
  return {
    deposit_ksh: toNumber(g.depositKsh),
    weekly_ksh: toNumber(g.weeklyKsh),
    term_weeks: toNumber(g.termWeeks),
  };
};

const planFromTags = (tags = []) => {
  const names = tags.map((t) => t?.name || "");
  const deposit_ksh = toNumber(parseTagValue(names, "Deposit"));
  const weekly_ksh = toNumber(parseTagValue(names, "Weekly"));
  const term_weeks = toNumber(parseTagValue(names, "Term"));
  return { deposit_ksh, weekly_ksh, term_weeks };
};

// Map ordering select → WPGraphQL orderby (non-price custom sorts handled client-side)
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
    default: break; // weekly/deposit sorts happen client-side
  }
  return { field, order };
};

/* ----------------------- component ----------------------- */

export default function Mkopa() {
  const navigate = useNavigate();

  // data/pagination (cursor)
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(null); // unknown without extra plugin
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [endCursorStack, setEndCursorStack] = useState([null]); // index = page-1

  // UI state
  const [brand, setBrand] = useState("All");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("");

  // per-card add state
  const [addingMap, setAddingMap] = useState({});

  const { field: orderbyField, order } = useMemo(
    () => mapOrdering(ordering),
    [ordering]
  );

  const { data, loading, error, refetch, fetchMore } = useQuery(LIST_PRODUCTS, {
    variables: {
      categorySlugs: [MKOPA_CATEGORY_SLUG],
      first: pageSize,
      after: endCursorStack[page - 1] || null,
      search: search || null,
      orderbyField,
      order,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  // Normalize nodes to your UI shape
  const baseItems = useMemo(() => {
    const nodes = data?.products?.nodes || [];
    return nodes.map((n) => {
      // Use ONLY ACF 'meta' group values for branding/category
      const brand_from_meta = n?.meta?.brand?.trim?.() || "Unbranded";
      const category_from_meta = n?.meta?.category?.trim?.() || "Others";

      // Payment plan (ACF > tags)
      const acfPlan = planFromAcf(n);
      const tagPlan = planFromTags(n.productTags?.nodes || []);
      const deposit_ksh = acfPlan.deposit_ksh ?? tagPlan.deposit_ksh ?? null;
      const weekly_ksh  = acfPlan.weekly_ksh  ?? tagPlan.weekly_ksh  ?? null;
      const term_weeks  = acfPlan.term_weeks  ?? tagPlan.term_weeks  ?? null;

      const current = toNumber(n.salePrice || n.price || n.regularPrice);
      const crossed = n.onSale && n.regularPrice ? toNumber(n.regularPrice) : null;

      return {
        id: n.databaseId ?? n.id,
        slug: n.slug,
        name: n.name,
        image: n.image?.sourceUrl || "",
        brand: brand_from_meta,
        category: category_from_meta,
        deposit_ksh,
        weekly_ksh,
        term_weeks,
        price_display: current != null ? `KSh ${current.toLocaleString()}` : "",
        price_min_ksh: current,
        price_max_ksh: crossed,
        product_id: n.databaseId || null,
      };
    });
  }, [data]);

  // Client-side filters to preserve your UX
  const filtered = useMemo(() => {
    return baseItems.filter((it) => {
      const brandOk =
        brand === "All" ||
        (it.brand || "").toLowerCase() === brand.toLowerCase();
      const catOk =
        category === "All" ||
        (it.category || "").toLowerCase() === category.toLowerCase();
      const haystack = [it.name, it.brand, it.category];
      const searchOk =
        !search ||
        haystack.filter(Boolean).some((t) => t.toLowerCase().includes(search.toLowerCase()));
      return brandOk && catOk && searchOk;
    });
  }, [baseItems, brand, category, search]);

  // Handle weekly/deposit custom sorting client-side if selected
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmpNum = (a, b, key, asc = true) => {
      const va = a[key] ?? Number.POSITIVE_INFINITY;
      const vb = b[key] ?? Number.POSITIVE_INFINITY;
      return asc ? va - vb : vb - va;
    };
    switch (ordering) {
      case "weekly_ksh": arr.sort((a, b) => cmpNum(a, b, "weekly_ksh", true)); break;
      case "-weekly_ksh": arr.sort((a, b) => cmpNum(a, b, "weekly_ksh", false)); break;
      case "deposit_ksh": arr.sort((a, b) => cmpNum(a, b, "deposit_ksh", true)); break;
      case "-deposit_ksh": arr.sort((a, b) => cmpNum(a, b, "deposit_ksh", false)); break;
      default: /* server-side handled for other options */ break;
    }
    return arr;
  }, [filtered, ordering]);

  // Group by category for sectioning (like Audio)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const it of sorted) {
      const key = it.category || "Others";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return map;
  }, [sorted]);

  const sectionCategories = useMemo(() => {
    if (category === "All") return Array.from(grouped.keys());
    return grouped.has(category) ? [category] : [];
  }, [category, grouped]);

  // Reset to page 1 when changing filters/search/order
  useEffect(() => {
    setPage(1);
    setEndCursorStack([null]);
    refetch({
      categorySlugs: [MKOPA_CATEGORY_SLUG],
      first: pageSize,
      after: null,
      search: search || null,
      orderbyField,
      order,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, category, search, ordering, orderbyField, order, pageSize, refetch]);

  // Keep items state for your summary text
  useEffect(() => {
    setItems(sorted);
    setCount(null);
  }, [sorted]);

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
        categorySlugs: [MKOPA_CATEGORY_SLUG],
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
      categorySlugs: [MKOPA_CATEGORY_SLUG],
      first: pageSize,
      after,
      search: search || null,
      orderbyField,
      order,
    });
  };

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  const handleBuyNow = async (offer) => {
    if (!offer?.product_id) {
      toast.error("This item is not available for purchase yet.");
      return;
    }
    const id = offer.id;
    setAddingMap((m) => ({ ...m, [id]: true }));
    try {
      const res = await mutateAddToCart({
        variables: { productId: offer.product_id, quantity: 1 },
      });
      const newCount = res?.data?.addToCart?.cart?.contents?.itemCount;
      if (typeof newCount === "number") {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { count: newCount } }));
      } else {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: 1 } }));
      }
      toast.success(`${offer.name} added to cart`);
    } catch (e) {
      toast.error(e?.message || "Failed to add to cart");
    } finally {
      setAddingMap((m) => { const copy = { ...m }; delete copy[id]; return copy; });
    }
  };

  // helper: go to details and scroll to top for nicer UX
  const goToDetail = (id) => {
    try {
      (document.scrollingElement || document.documentElement || document.body)
        ?.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
    navigate(`/mkopa/${id}`);
  };

  // keyboard support for full-card click
  const handleCardKeyDown = (e, id) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToDetail(id);
    }
  };

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error("GraphQL error (M-KOPA):", error);
    }
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Title */}
      <h1 className="text-3xl font-bold mb-2 text-center">M-KOPA Phones in Kenya (2025)</h1>
      <p className="text-center text-gray-600 mb-6">
        Small deposit today. Easy weekly payments. Take it home now.
      </p>

      {/* Filters Row */}
      <div className="flex flex-wrap justify-center gap-3 mb-5">
        {/* Brand */}
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="border rounded px-3 py-2">
          {BRAND_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name/brand/category…"
          className="border rounded px-3 py-2 w-72"
        />

        {/* Ordering */}
        <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className="border rounded px-3 py-2">
          <option value="">Default order</option>
          <option value="created_at">Created (oldest first)</option>
          <option value="-created_at">Created (newest first)</option>
          <option value="price_min_ksh">Price (low first)</option>
          <option value="-price_min_ksh">Price (high first)</option>
          <option value="weekly_ksh">Weekly (low first)</option>
          <option value="-weekly_ksh">Weekly (high first)</option>
          <option value="deposit_ksh">Deposit (low first)</option>
          <option value="-deposit_ksh">Deposit (high first)</option>
          <option value="name">Name (A→Z)</option>
          <option value="-name">Name (Z→A)</option>
        </select>
      </div>

      {/* Category pills (same UI as Audio) */}
      <div className="mb-6">
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORY_OPTIONS.map((c) => {
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={active}
                className={
                  `px-3 py-1.5 rounded-full text-sm transition ` +
                  (active
                    ? "bg-green-600 text-white shadow"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-800")
                }
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results summary */}
      <div className="text-center mb-6 text-sm text-gray-600">
        {loading && !items.length
          ? "Loading…"
          : items.length === 0
          ? "No M-KOPA items found."
          : count !== null ? `Showing ${items.length} of ${count}` : `Showing ${items.length}`}
      </div>

      {/* Category Sections */}
      {sectionCategories.map((cat) => (
        <section key={cat} className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-center">{cat}</h2>

          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {grouped.get(cat)?.map((o) => {
              const isAdding = !!addingMap[o.id];
              return (
                <div
                  key={o.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => goToDetail(o.id)}
                  onKeyDown={(e) => handleCardKeyDown(e, o.id)}
                  className="group flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                  aria-label={`View details for ${o.name}`}
                >
                  <div className="relative">
                    <div className="h-56 w-full overflow-hidden rounded-t-2xl bg-white flex items-center justify-center">
                      <img
                        src={o.image || FallbackImg}
                        alt={o.name}
                        className="w-full h-full object-contain transform transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = FallbackImg; }}
                      />
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-lg font-semibold leading-snug mb-1 line-clamp-2">{o.name}</h3>

                    {/* Only brand & category from ACF meta */}
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {`${o.brand} • ${o.category}`}
                    </p>

                    <div className="text-green-700 font-bold text-base mb-1">
                      Deposit: KSh {o.deposit_ksh?.toLocaleString?.() || o.deposit_ksh}
                    </div>
                    <div className="text-gray-800 text-sm mb-4">
                      Weekly: KSh {o.weekly_ksh?.toLocaleString?.() || o.weekly_ksh} • {o.term_weeks ?? "—"} weeks
                    </div>

                    <div className="text-blue-600 font-bold text-base mb-4">{o.price_display}</div>

                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <button
                        className="inline-flex items-center justify-center rounded-xl border bg-white hover:bg-gray-50 text-gray-900 py-2 px-3 transition"
                        onClick={(e) => { e.stopPropagation(); goToDetail(o.id); }}
                      >
                        View Details
                      </button>

                      <button
                        className={`inline-flex items-center justify-center rounded-xl py-2 px-3 transition ${
                          o.product_id
                            ? isAdding
                              ? "bg-green-600 text-white opacity-70 cursor-wait"
                              : "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-gray-200 text-gray-500 cursor-not-allowed"
                        }`}
                        onClick={(e) => { 
                          e.stopPropagation();
                          if (!o.product_id || isAdding) return; 
                          handleBuyNow(o); 
                        }}
                        disabled={!o.product_id || isAdding}
                        title={o.product_id ? "Add to cart" : "Unavailable"}
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
            className={`px-4 py-2 rounded ${hasNext ? "bg-gray-200 hover:bg-gray-300" : "bg-gray-100 text-gray-400"}`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
