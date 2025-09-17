import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

import ip7 from "../assets/ip7.jpg"; // fallback local
const FallbackImg = "/images/fallback.jpg";

// Adjust if this collection uses another Woo category
const NEW_IPHONES_CATEGORY_SLUG = "new-iphones";

/* ----------------------- GraphQL ----------------------- */

const LIST_PRODUCTS = gql`
  query NewIphonesList(
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
        productTags(first: 20) { nodes { name slug } }
        ... on SimpleProduct {
          price
          regularPrice
          salePrice
          onSale
          stockStatus
          # ACF meta group
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

// Optional banner source for the LIST page only
const TRY_BANNER = gql`
  query NewIphonesBanner {
    page(id: "new-iphones", idType: URI) {
      featuredImage { node { sourceUrl } }
    }
  }
`;

/* ----------------------- helpers ----------------------- */

const toNumber = (raw) => {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? null : n;
};

const deriveBadge = (tags = []) => {
  const names = tags.map((t) => (t?.name || "").toUpperCase());
  if (names.includes("HOT")) return "HOT";
  if (names.includes("NEW")) return "NEW";
  if (names.includes("SALE")) return "SALE";
  return "NONE";
};

// Map your ordering select → WPGraphQL orderby
const mapOrdering = (ordering) => {
  let field = "DATE";
  let order = "DESC";
  switch (ordering) {
    case "-created_at":
      field = "DATE";
      order = "DESC";
      break;
    case "new_price_ksh":
      field = "PRICE";
      order = "ASC";
      break;
    case "-new_price_ksh":
      field = "PRICE";
      order = "DESC";
      break;
    case "name":
      field = "TITLE";
      order = "ASC";
      break;
    default:
      // Default order
      break;
  }
  return { field, order };
};

/* ----------------------- component ----------------------- */

export default function NewIphones() {
  const navigate = useNavigate();

  const [badgeFilter, setBadgeFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);

  const [addingMap, setAddingMap] = useState({});
  const [wishlist, setWishlist] = useState([]);

  // Cursor stack to emulate prev/next
  const [endCursorStack, setEndCursorStack] = useState([null]); // index = page-1

  // Banner (LIST page only; falls back to ip7)
  const { data: bannerData } = useQuery(TRY_BANNER, {
    fetchPolicy: "cache-first",
  });
  const pageBanner =
    bannerData?.page?.featuredImage?.node?.sourceUrl || ip7;

  const { field: orderbyField, order } = useMemo(
    () => mapOrdering(ordering),
    [ordering]
  );

  const { data, loading, error, refetch, fetchMore } = useQuery(LIST_PRODUCTS, {
    variables: {
      categorySlugs: [NEW_IPHONES_CATEGORY_SLUG],
      first: pageSize,
      after: endCursorStack[page - 1] || null,
      search: search || null,
      orderbyField,
      order,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  // Reset pagination when filters/search/order change
  useEffect(() => {
    setPage(1);
    setEndCursorStack([null]);
    refetch({
      categorySlugs: [NEW_IPHONES_CATEGORY_SLUG],
      first: pageSize,
      after: null,
      search: search || null,
      orderbyField,
      order,
    });
  }, [badgeFilter, search, ordering, orderbyField, order, pageSize, refetch]);

  // Normalize list to your UI shape (brand/category from ACF meta; do NOT display specs here)
  const items = useMemo(() => {
    const nodes = data?.products?.nodes || [];
    return nodes
      .map((n) => {
        const badge = deriveBadge(n.productTags?.nodes || []);
        const current = toNumber(n.salePrice || n.price || n.regularPrice);
        const crossed =
          n.onSale && n.regularPrice ? toNumber(n.regularPrice) : null;

        const brand = n?.meta?.brand?.trim?.() || "Unbranded";
        const category = n?.meta?.category?.trim?.() || "";

        return {
          id: n.databaseId ?? n.id,
          name: n.name,
          image: n.image?.sourceUrl || "",
          brand,
          category,
          // Prices
          new_price_ksh: current,
          old_price_ksh: crossed,
          price_display: current != null ? `KSh ${current.toLocaleString()}` : "",
          // Badge logic from tags (fallback to "NONE")
          badge,
          // Cart
          product_id: n.databaseId || null,
        };
      })
      .filter((p) => {
        // Apply badge filter client-side to preserve your existing UX
        if (badgeFilter === "All") return true;
        if (badgeFilter === "NONE") return p.badge === "NONE";
        return p.badge === badgeFilter;
      });
  }, [data, badgeFilter]);

  // Total count unknown without extra plugin — keep null to match your summary behavior
  const count = null;

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
        categorySlugs: [NEW_IPHONES_CATEGORY_SLUG],
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
      categorySlugs: [NEW_IPHONES_CATEGORY_SLUG],
      first: pageSize,
      after,
      search: search || null,
      orderbyField,
      order,
    });
  };

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  const toggleWishlist = (id) => {
    setWishlist((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

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
        window.dispatchEvent(
          new CustomEvent("cart-updated", { detail: { count: newCount } })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent("cart-updated", { detail: { delta: 1 } })
        );
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

  const goToDetail = (id) => {
    try {
      (document.scrollingElement ||
        document.documentElement ||
        document.body)?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (_) {}
    navigate(`/new-iphones/${id}`);
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
      console.error("GraphQL error (NewIphones):", error);
    }
  }, [error]);

  return (
    <section className="max-w-7xl mx-auto px-4 py-10 font-sans">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
          New iPhones
        </h2>
        <span className="text-lg font-medium text-green-500 italic">
          Premium Collection
        </span>
      </div>

      {/* Banner (LIST page) */}
      <div className="mb-10 rounded-2xl overflow-hidden shadow-2xl relative">
        <img
          src={pageBanner}
          alt="iPhone Banner"
          className="w-full h-[450px] object-cover transition-transform duration-700 hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = FallbackImg;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div className="flex items-center gap-3">
          <select
            value={badgeFilter}
            onChange={(e) => setBadgeFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option>All</option>
            <option>HOT</option>
            <option>NEW</option>
            <option>SALE</option>
            <option>NONE</option>
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name/brand/category…"
            className="border rounded px-3 py-2 w-72"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">Default order</option>
            <option value="-created_at">Newest</option>
            <option value="new_price_ksh">Price (low → high)</option>
            <option value="-new_price_ksh">Price (high → low)</option>
            <option value="name">Name (A→Z)</option>
          </select>
        </div>
      </div>

      {/* Results summary */}
      <div className="text-center mb-6 text-sm text-gray-600">
        {loading && !items.length
          ? "Loading…"
          : items.length === 0
          ? "No iPhones found."
          : count !== null
          ? `Showing ${items.length} of ${count}`
          : `Showing ${items.length}`}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-8">
        {items.map((product) => {
          const isAdding = !!addingMap[product.id];

          return (
            <div
              key={product.id}
              role="button"
              tabIndex={0}
              onClick={() => goToDetail(product.id)}
              onKeyDown={(e) => handleCardKeyDown(e, product.id)}
              className="group bg-white rounded-xl shadow hover:shadow-lg transition-all duration-200 overflow-hidden border border-gray-200 hover:-translate-y-0.5 relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`View details for ${product.name}`}
            >
              <div className="relative overflow-hidden">
                {product.badge && product.badge !== "NONE" && (
                  <span
                    className={`absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow ${
                      product.badge === "SALE"
                        ? "bg-red-500 text-white"
                        : product.badge === "NEW"
                        ? "bg-blue-600 text-white"
                        : "bg-green-600 text-white"
                    }`}
                  >
                    {product.badge}
                  </span>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setWishlist((prev) =>
                      prev.includes(product.id)
                        ? prev.filter((p) => p !== product.id)
                        : [...prev, product.id]
                    );
                  }}
                  className="absolute top-3 right-3 bg-white/95 p-2 rounded-full shadow hover:scale-110 transition"
                  aria-label="Toggle wishlist"
                >
                  <Heart
                    size={18}
                    className={
                      (wishlist || []).includes(product.id)
                        ? "fill-red-500 text-red-500"
                        : "text-gray-600"
                    }
                  />
                </button>

                <img
                  src={product.image || FallbackImg}
                  alt={product.name}
                  className="w-full h-[280px] md:h-[320px] object-contain bg-white group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    e.currentTarget.src = FallbackImg;
                  }}
                />
              </div>

              <div className="p-5 relative z-10 bg-white">
                <h3 className="text-[15px] font-semibold text-gray-900 group-hover:text-gray-700 transition">
                  {product.name}
                </h3>

                {/* brand • category (no specs on list) */}
                <p className="text-xs text-gray-500 mt-0.5">
                  {([product.brand, product.category].filter(Boolean).join(" • ")) || "Unbranded"}
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-base text-black font-semibold">
                    KSh {product.new_price_ksh?.toLocaleString()}
                  </span>
                  {product.old_price_ksh ? (
                    <span className="text-gray-400 line-through text-xs">
                      KSh {product.old_price_ksh?.toLocaleString()}
                    </span>
                  ) : null}
                </div>

                <div className="text-green-600 text-xs mt-1">
                  Save{" "}
                  {product.old_price_ksh
                    ? Math.round(
                        ((product.old_price_ksh - product.new_price_ksh) /
                          product.old_price_ksh) *
                          100
                      )
                    : 0}
                  %
                </div>

                {/* Slim, stacked buttons */}
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    className="w-full inline-flex items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-900 py-2 px-3 text-sm font-medium transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      goToDetail(product.id);
                    }}
                  >
                    View Details
                  </button>

                  <button
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-md py-2 px-3 text-sm font-medium transition ${
                      product.product_id
                        ? isAdding
                          ? "bg-blue-600 text-white opacity-70 cursor-wait"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-gray-200 text-gray-500 cursor-not-allowed"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!product.product_id || isAdding) return;
                      handleBuyNow(product);
                    }}
                    disabled={!product.product_id || isAdding}
                  >
                    {isAdding ? "Adding…" : (<><ShoppingCart size={15} /> Add to Cart</>)}
                  </button>
                </div>
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
    </section>
  );
}
