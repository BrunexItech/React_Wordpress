import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

// Match audio.jsx UX: brand + category filters (with "All")
const BRAND_OPTIONS = ["All", "Apple", "Samsung", "Anker", "UGreen", "Baseus", "Oraimo", "Xiaomi", "Huawei", "OnePlus", "Amaya", "Unbranded"];
const CATEGORY_OPTIONS = ["All", "Chargers", "Powerbanks", "Phone Covers", "Protectors", "Cables", "Mounts", "Earbuds Cases", "Others"];

// Adjust if your Woo category slug differs
const ACCESSORIES_CATEGORY_SLUG = "mobile-accessories";

/* ----------------------- GraphQL ----------------------- */

const LIST_ACCESSORIES = gql`
  query Accessories(
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

const normalizeNode = (n) => {
  const brand_display = n?.meta?.brand?.trim?.() || "Unbranded";
  const category_display = n?.meta?.category?.trim?.() || "Others";
  const specs_text = n?.meta?.specs?.trim?.() || "";

  const current = toNumber(n.salePrice || n.price || n.regularPrice);
  const crossed = n.onSale && n.regularPrice ? toNumber(n.regularPrice) : null;

  return {
    id: n.databaseId ?? n.id,
    slug: n.slug,
    name: n.name,
    image: n.image?.sourceUrl || "",
    brand_display,
    category_display,
    specs_text,
    price_display: current != null ? `KSh ${current.toLocaleString()}` : "",
    price_min_ksh: current,
    price_max_ksh: crossed,
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

export default function MobileAccessories() {
  const navigate = useNavigate();

  // data/pagination (cursor)
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(null); // unknown w/o extra extension
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

  const { data, loading, error, refetch, fetchMore } = useQuery(LIST_ACCESSORIES, {
    variables: {
      categorySlugs: [ACCESSORIES_CATEGORY_SLUG],
      first: pageSize,
      after: endCursorStack[page - 1] || null,
      search: search || null,
      orderbyField,
      order,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  // Normalize from Woo
  const baseItems = useMemo(() => {
    const nodes = data?.products?.nodes || [];
    return nodes.map(normalizeNode);
  }, [data]);

  // Client filters to mirror your UX
  const filtered = useMemo(() => {
    return baseItems.filter((it) => {
      const brandOk =
        brand === "All" ||
        (it.brand_display || "Unbranded").toLowerCase() === brand.toLowerCase();
      const catOk =
        category === "All" ||
        (it.category_display || "Others").toLowerCase() === category.toLowerCase();
      const searchOk =
        !search ||
        [it.name, it.brand_display, it.category_display /* keep specs searchable but not displayed */, it.specs_text]
          .filter(Boolean)
          .some((t) => t.toLowerCase().includes(search.toLowerCase()));
      return brandOk && catOk && searchOk;
    });
  }, [baseItems, brand, category, search]);

  // Group by category for sections
  const grouped = useMemo(() => {
    const map = new Map();
    for (const a of filtered) {
      const key = a.category_display || "Others";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    return map;
  }, [filtered]);

  const sectionCategories = useMemo(() => {
    if (category === "All") return Array.from(grouped.keys());
    return grouped.has(category) ? [category] : [];
  }, [category, grouped]);

  // surface items for summary text (count remains nullable)
  useEffect(() => {
    setItems(filtered);
    setCount(null);
  }, [filtered]);

  // reset pagination when filters/search/order change
  useEffect(() => {
    setPage(1);
    setEndCursorStack([null]);
    refetch({
      categorySlugs: [ACCESSORIES_CATEGORY_SLUG],
      first: pageSize,
      after: null,
      search: search || null,
      orderbyField,
      order,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, category, search, ordering, orderbyField, order, pageSize, refetch]);

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
        categorySlugs: [ACCESSORIES_CATEGORY_SLUG],
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
      categorySlugs: [ACCESSORIES_CATEGORY_SLUG],
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

  // 🔹 Card navigation helpers (same as "View Details")
  const navigateTop = () => {
    try {
      (document.scrollingElement || document.documentElement || document.body)?.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  };
  const goToDetails = (id) => { navigateTop(); navigate(`/accessories/${id}`); };
  const onCardKey = (e, id) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToDetails(id);
    }
  };

  useEffect(() => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error("GraphQL error (MobileAccessories):", error);
    }
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Title */}
      <h1 className="text-3xl font-bold mb-2 text-center">Shop Mobile Accessories in Kenya (2025)</h1>
      <p className="text-center text-gray-600 mb-6">
        Explore chargers, powerbanks, phone covers, protectors, cables, mounts &amp; more.
      </p>

      {/* Filters Row */}
      <div className="flex flex-wrap justify-center gap-3 mb-5">
        {/* Brand dropdown */}
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="border rounded px-3 py-2">
          {BRAND_OPTIONS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
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
          <option value="name">Name (A→Z)</option>
          <option value="-name">Name (Z→A)</option>
        </select>
      </div>

      {/* Category pills */}
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
                    ? "bg-blue-600 text-white shadow"
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
          ? "No accessories found."
          : count !== null
          ? `Showing ${items.length} of ${count}`
          : `Showing ${items.length}`}
      </div>

      {/* Category Sections */}
      {sectionCategories.map((cat) => (
        <section key={cat} className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-center">{cat}</h2>

          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {grouped.get(cat)?.map((a) => {
              const isAdding = !!addingMap[a.id];
              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`View details for ${a.name}`}
                  onClick={() => goToDetails(a.id)}
                  onKeyDown={(e) => onCardKey(e, a.id)}
                  className="group flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                >
                  <div className="relative">
                    <div className="h-56 w-full overflow-hidden rounded-t-2xl bg-white flex items-center justify-center">
                      <img
                        src={a.image || FallbackImg}
                        alt={a.name}
                        className="w-full h-full object-contain transform transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = FallbackImg; }}
                      />
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-lg font-semibold leading-snug mb-1 line-clamp-2">{a.name}</h3>

                    {/* brand • category only (do not display specs on list) */}
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {[a.brand_display, a.category_display].filter(Boolean).join(" • ") || "Unbranded"}
                    </p>

                    <div className="text-blue-600 font-bold text-base mb-4">{a.price_display}</div>

                    <div className="mt-auto grid grid-cols-2 gap-2">
                      <button
                        className="inline-flex items-center justify-center rounded-xl border bg-white hover:bg-gray-50 text-gray-900 py-2 px-3 transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          goToDetails(a.id);
                        }}
                      >
                        View Details
                      </button>

                      <button
                        className={`inline-flex items-center justify-center rounded-xl py-2 px-3 transition ${
                          a.product_id
                            ? isAdding
                              ? "bg-blue-600 text-white opacity-70 cursor-wait"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                            : "bg-gray-200 text-gray-500 cursor-not-allowed"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!a.product_id || isAdding) return;
                          handleBuyNow(a);
                        }}
                        disabled={!a.product_id || isAdding}
                        title={a.product_id ? "Add to cart" : "Unavailable"}
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
