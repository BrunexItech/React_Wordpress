// src/pages/StoragePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql, useMutation, useQuery } from "@apollo/client";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";

// Adjust if your Woo category slug differs
const STORAGE_CATEGORY_SLUG = "storage";

const BRAND_OPTIONS = [
  "All","SanDisk","WD","Seagate","Toshiba","Samsung","Crucial","Transcend","LaCie","Verbatim","PNY","Others",
];

/* ---------------- GraphQL ---------------- */

const LIST_STORAGE_PRODUCTS = gql`
  query StorageProducts(
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
        productTags(first: 50) { nodes { name } }

        # Use ACF meta group to match other cleaned components
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

/* ---------------- helpers ---------------- */

const num = (raw) => {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? null : n;
};

const tag = (tags, key) => {
  const row = tags.find((n) => n.toLowerCase().startsWith(`${key.toLowerCase()}:`));
  return row ? (row.split(":")[1] || "").trim() : null;
};

const normalize = (n) => {
  const tagNames = (n.productTags?.nodes || []).map((t) => t?.name || "");

  // Prefer ACF meta with graceful fallbacks to tags
  const brand = n?.meta?.brand?.trim?.() || tag(tagNames, "Brand") || "Others";
  const category = n?.meta?.category?.trim?.() || "Others";
  const specs_text = n?.meta?.specs?.trim?.() || tag(tagNames, "Specs") || "";

  const cur = num(n.salePrice || n.price || n.regularPrice);
  const crossed = n.onSale && n.regularPrice ? num(n.regularPrice) : null;

  return {
    id: n.databaseId ?? n.id,
    slug: n.slug,
    name: n.name,
    image: n.image?.sourceUrl || "",
    brand_display: brand,
    category_display: category,
    // keep specs for DETAIL page only; do not render on list
    specs_text,
    price_min_ksh: cur,
    price_max_ksh: crossed,
    price_display: cur != null ? `KSh ${cur.toLocaleString()}` : "",
    product_id: n.databaseId || null,
  };
};

const mapOrdering = (ordering) => {
  // "latest" | "price_low" | "price_high"
  switch (ordering) {
    case "price_low":  return { field: "PRICE", order: "ASC" };
    case "price_high": return { field: "PRICE", order: "DESC" };
    default:           return { field: "DATE",  order: "DESC" };
  }
};

/* ---------------- component ---------------- */

const StoragePage = () => {
  const navigate = useNavigate();

  // UI state
  const [brand, setBrand] = useState("All");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("latest");

  // cursor pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [cursorStack, setCursorStack] = useState([null]); // index = page-1

  const { field: orderbyField, order } = useMemo(
    () => mapOrdering(ordering),
    [ordering]
  );

  const { data, loading, error, refetch, fetchMore } = useQuery(LIST_STORAGE_PRODUCTS, {
    variables: {
      categorySlugs: [STORAGE_CATEGORY_SLUG],
      first: pageSize,
      after: cursorStack[page - 1] || null,
      search: search || null,
      orderbyField,
      order,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  const baseItems = useMemo(() => (data?.products?.nodes || []).map(normalize), [data]);

  // brand & search filter (no specs on list)
  const items = useMemo(() => {
    return baseItems.filter((p) => {
      const brandOK = brand === "All" || (p.brand_display || "Others").toLowerCase() === brand.toLowerCase();
      const searchOK =
        !search ||
        [p.name, p.brand_display, p.category_display]
          .filter(Boolean)
          .some((s) => s.toLowerCase().includes(search.toLowerCase()));
      return brandOK && searchOK;
    });
  }, [baseItems, brand, search]);

  // results/flags
  const hasNext = !!data?.products?.pageInfo?.hasNextPage;
  const hasPrev = page > 1;
  const endCursor = data?.products?.pageInfo?.endCursor || null;

  useEffect(() => { if (error) console.error("GraphQL error (Storage):", error); }, [error]);

  // reset pagination when sort/filter/search change
  useEffect(() => {
    setPage(1);
    setCursorStack([null]);
    refetch({
      categorySlugs: [STORAGE_CATEGORY_SLUG],
      first: pageSize,
      after: null,
      search: search || null,
      orderbyField,
      order,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordering, brand, search, orderbyField, order]);

  const goNext = async () => {
    if (!hasNext) return;
    setCursorStack((s) => { const next = [...s]; next[page] = endCursor; return next; });
    setPage((p) => p + 1);
    await fetchMore({
      variables: {
        categorySlugs: [STORAGE_CATEGORY_SLUG],
        first: pageSize,
        after: endCursor,
        search: search || null,
        orderbyField,
        order,
      },
    });
  };

  const goPrev = async () => {
    if (!hasPrev) return;
    const prevIndex = Math.max(0, page - 2);
    const after = cursorStack[prevIndex] || null;
    setPage((p) => Math.max(1, p - 1));
    await refetch({
      categorySlugs: [STORAGE_CATEGORY_SLUG],
      first: pageSize,
      after,
      search: search || null,
      orderbyField,
      order,
    });
  };

  // add to cart
  const [mutateAddToCart] = useMutation(ADD_TO_CART);
  const [addingMap, setAddingMap] = useState({});

  const handleBuyNow = async (item) => {
    if (!item?.product_id) {
      toast.error("This item is not available for purchase yet.");
      return;
    }
    setAddingMap((m) => ({ ...m, [item.id]: true }));
    try {
      const res = await mutateAddToCart({ variables: { productId: item.product_id, quantity: 1 } });
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
      setAddingMap((m) => { const c = { ...m }; delete c[item.id]; return c; });
    }
  };

  // card helpers
  const navigateDetail = (id) => navigate(`/storage/${id}`);
  const onCardKey = (e, id) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigateDetail(id); } };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Title */}
      <h1 className="text-3xl font-bold mb-2 text-center">Shop Storage Devices in Kenya (2025)</h1>
      <p className="text-center text-gray-600 mb-6">
        External drives, SSDs, flash drives & more.
      </p>

      {/* Filters Row (clean like other pages) */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <select value={brand} onChange={(e) => setBrand(e.target.value)} className="border rounded px-3 py-2">
          {BRAND_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name/brand/category…"
          className="border rounded px-3 py-2 w-72"
        />

        <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className="border rounded px-3 py-2">
          <option value="latest">Latest</option>
          <option value="price_low">Price (low first)</option>
          <option value="price_high">Price (high first)</option>
        </select>
      </div>

      {/* Results summary */}
      <div className="text-center mb-6 text-sm text-gray-600">
        {loading && !items.length ? "Loading…" : (items.length === 0 ? "No storage devices found." : `Showing ${items.length}`)}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {items.map((p) => {
          const isAdding = !!addingMap[p.id];
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              aria-label={`View details for ${p.name}`}
              onClick={() => navigateDetail(p.id)}
              onKeyDown={(e) => onCardKey(e, p.id)}
              className="group border rounded-2xl p-3 shadow-sm bg-white hover:shadow-lg transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            >
              <div className="w-full h-40 flex items-center justify-center overflow-hidden rounded-lg bg-white">
                <img
                  src={p.image || FallbackImg}
                  alt={p.name}
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                  onError={(e) => { e.currentTarget.src = FallbackImg; }}
                  loading="lazy"
                />
              </div>

              <h4 className="text-sm font-semibold mt-3 line-clamp-2">{p.name}</h4>

              {/* brand • category (no specs here) */}
              <p className="text-xs text-gray-500">
                {[p.brand_display, p.category_display].filter(Boolean).join(" • ") || "—"}
              </p>

              <div className="mt-2">
                <p className="text-blue-600 font-bold">{p.price_display || "—"}</p>
                {p.price_max_ksh ? (
                  <p className="text-gray-400 text-xs line-through">
                    {`KSh ${Number(p.price_max_ksh).toLocaleString()}`}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="bg-white border rounded-md py-2 text-sm hover:bg-gray-50"
                  onClick={(e) => { e.stopPropagation(); navigateDetail(p.id); }}
                >
                  View Details
                </button>
                <button
                  className={`rounded-md py-2 text-sm ${
                    p.product_id
                      ? isAdding
                        ? "bg-blue-600 text-white opacity-70 cursor-wait"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
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
          );
        })}
      </div>

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
            className={`px-4 py-2 rounded ${hasNext ? "bg-gray-200 hover:bg-gray-300" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default StoragePage;
