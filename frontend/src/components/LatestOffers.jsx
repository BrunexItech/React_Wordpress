// src/components/LatestOffers.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import { toast } from "react-toastify";

const FallbackImg = "/images/fallback.jpg";
const LABEL_FILTERS = ["All", "NEW", "HOT", "SALE"];
const LATEST_OFFERS_PRODUCT_CATEGORY_SLUG = "latest-offers";

/* ----------------------- GraphQL ----------------------- */

const LATEST_WC_PRODUCTS = gql`
  query LatestWCProducts(
    $categorySlugs: [String]!
    $first: Int = 12
    $after: String
    $search: String
    $order: OrderEnum = DESC
  ) {
    products(
      first: $first
      after: $after
      where: {
        categoryIn: $categorySlugs
        search: $search
        orderby: { field: DATE, order: $order }
      }
    ) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      nodes {
        __typename
        id
        databaseId
        slug
        name
        date
        type
        image { sourceUrl altText }
        productCategories { nodes { slug name } }
        productTags(first: 20) { nodes { id name slug } }
        ... on SimpleProduct {
          price
          regularPrice
          salePrice
          onSale
          stockStatus
        }
        ... on VariableProduct {
          price
          regularPrice
          salePrice
          onSale
          stockStatus
        }
      }
    }
  }
`;

const ADD_TO_CART = gql`
  mutation AddToCart($productId: Int!, $quantity: Int = 1) {
    addToCart(input: { productId: $productId, quantity: $quantity }) {
      cartItem { key quantity total }
      cart {
        contents { itemCount }
        subtotal
        total
      }
    }
  }
`;

/* ----------------------- helpers ----------------------- */

const labelColor = (label) => {
  const l = (label || "").toLowerCase();
  if (l === "new") return "bg-green-500";
  if (l === "hot") return "bg-blue-500";
  if (l === "sale") return "bg-red-500";
  return "bg-yellow-400";
};

const money = (raw) => {
  if (raw === null || raw === undefined || raw === "") return "";
  const n = Number(raw);
  return Number.isNaN(n) ? String(raw) : n.toLocaleString();
};

const deriveLabelsAndBrand = (tags = []) => {
  const names = tags.map((t) => t?.name || "");
  const labels = names.filter((n) =>
    ["new", "hot", "sale"].includes(n.toLowerCase())
  );
  // simple brand convention: a tag like "Brand: Samsung"
  const brandTag = names.find((n) => /^brand\s*:/.test(n.toLowerCase()));
  const brand = brandTag ? brandTag.replace(/^brand\s*:\s*/i, "").trim() : "Unknown";
  return { labels, brand };
};

/* ----------------------- component ----------------------- */

const LatestOffers = () => {
  const navigate = useNavigate();

  // UI state
  const [brand, setBrand] = useState("All");
  const [label, setLabel] = useState("All");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("-created_at"); // maps to DESC/ASC
  const [pageSize] = useState(12);

  // cursor pagination
  const [after, setAfter] = useState(null);
  const [page, setPage] = useState(1);

  // per-item "adding" state
  const [addingMap, setAddingMap] = useState({});

  const orderEnum = ordering === "-created_at" ? "DESC" : "ASC";

  const { data, loading, error, refetch } = useQuery(LATEST_WC_PRODUCTS, {
    variables: {
      categorySlugs: [LATEST_OFFERS_PRODUCT_CATEGORY_SLUG],
      first: pageSize,
      after,
      search: search || null,
      order: orderEnum,
    },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: "cache-and-network",
  });

  // reset page when query params change
  useEffect(() => {
    setPage(1);
    setAfter(null);
    refetch({
      categorySlugs: [LATEST_OFFERS_PRODUCT_CATEGORY_SLUG],
      first: pageSize,
      after: null,
      search: search || null,
      order: orderEnum,
    });
  }, [search, ordering, pageSize, orderEnum, refetch]);

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  // normalize products
  const items = useMemo(() => {
    const nodes = data?.products?.nodes || [];
    return nodes.map((n) => {
      const { labels, brand } = deriveLabelsAndBrand(n.productTags?.nodes || []);
      const priceRaw = n.salePrice || n.price || n.regularPrice || "";
      const oldPriceRaw = n.onSale ? n.regularPrice : null;

      return {
        id: n.databaseId ?? n.id,          // for routing
        slug: n.slug,
        name: n.name,
        image: n.image?.sourceUrl || "",
        labels,
        brand,
        date: n.date,
        price_display: priceRaw ? `${money(priceRaw)}` : "",
        old_price_ksh: oldPriceRaw ? money(oldPriceRaw) : null,
        product_id: n.databaseId,          // for add-to-cart
        stockStatus: n.stockStatus,
        onSale: !!n.onSale,
      };
    });
  }, [data]);

  // brand list for filter
  const brands = useMemo(() => {
    const set = new Set(items.map((x) => x.brand).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [items]);

  // client-side filters
  const filtered = useMemo(() => {
    return items.filter((it) => {
      const brandOk =
        brand === "All" || (it.brand || "").toLowerCase() === brand.toLowerCase();
      const labelOk =
        label === "All" ||
        (it.labels || []).some((l) => l.toLowerCase() === label.toLowerCase());
      return brandOk && labelOk;
    });
  }, [items, brand, label]);

  // pagination helpers
  const pageInfo = data?.products?.pageInfo;
  const hasNext = !!pageInfo?.hasNextPage;
  const hasPrev = page > 1; // since we reset to start on filter/order changes

  const goNext = async () => {
    if (!hasNext) return;
    setAfter(pageInfo.endCursor);
    setPage((p) => p + 1);
    await refetch({
      categorySlugs: [LATEST_OFFERS_PRODUCT_CATEGORY_SLUG],
      first: pageSize,
      after: pageInfo.endCursor,
      search: search || null,
      order: orderEnum,
    });
  };

  const goPrev = async () => {
    if (!hasPrev) return;
    // simplest: jump back to first page (or track a stack of cursors if you want true back nav)
    setAfter(null);
    setPage(1);
    await refetch({
      categorySlugs: [LATEST_OFFERS_PRODUCT_CATEGORY_SLUG],
      first: pageSize,
      after: null,
      search: search || null,
      order: orderEnum,
    });
  };

  const goToDetails = (product) => {
    // your route uses numeric id; adjust if you want slug instead
    navigate(`/latest-offers/${product.id}`);
  };

  const handleAddToCart = async (product) => {
    if (!product?.product_id) {
      toast.error("This offer is not available for purchase yet.", {
        autoClose: 1500,
        position: "top-center",
      });
      return;
    }
    const pid = product.product_id;
    setAddingMap((m) => ({ ...m, [pid]: true }));
    try {
      const res = await mutateAddToCart({ variables: { productId: pid, quantity: 1 } });

      // ✅ Best: get exact itemCount from server response
      const newCount = res?.data?.addToCart?.cart?.contents?.itemCount;

      if (typeof newCount === "number") {
        window.dispatchEvent(
          new CustomEvent("cart-updated", { detail: { count: newCount } })
        );
      } else {
        // Fallback: optimistic +1 if server didn't return it
        window.dispatchEvent(
          new CustomEvent("cart-updated", { detail: { delta: 1 } })
        );
      }

      toast.success(`${product.name} added to cart`, {
        autoClose: 1500,
        position: "top-center",
      });
    } catch (e) {
      console.error("Add to cart failed:", e);
      toast.error("Failed to add to cart", {
        autoClose: 1500,
        position: "top-center",
      });
    } finally {
      setAddingMap((m) => {
        const copy = { ...m };
        delete copy[pid];
        return copy;
      });
    }
  };

  if (error) {
    console.error("GraphQL error (LatestOffers):", error);
  }

  return (
    <section className="px-4 py-10">
      <h2 className="text-2xl font-bold mb-6 text-center">Latest Offers</h2>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
        {/* Brand */}
        <select
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="border rounded px-3 py-2"
        >
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search offers…"
          className="border rounded px-3 py-2 w-64"
        />

        {/* Label quick pills */}
        <div className="flex flex-wrap gap-2">
          {LABEL_FILTERS.map((l) => {
            const active = l === label;
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLabel(l)}
                className={`px-3 py-1.5 rounded-full text-sm transition ${
                  active
                    ? "bg-blue-600 text-white shadow"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>

        {/* Ordering (DATE asc/desc) */}
        <select
          value={ordering}
          onChange={(e) => setOrdering(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="-created_at">Newest first</option>
          <option value="created_at">Oldest first</option>
        </select>
      </div>

      {/* Results summary */}
      <div className="text-center mb-6 text-sm text-gray-600">
        {loading && filtered.length === 0
          ? "Loading offers…"
          : filtered.length === 0
          ? "No offers found."
          : `Showing ${filtered.length}${hasNext ? " (more available…)" : ""}`}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filtered.map((product) => {
          const isAdding = !!addingMap[product.product_id];
          return (
            <div
              key={product.id}
              className="border rounded-lg p-3 shadow hover:shadow-xl relative bg-white transform transition-transform duration-300 hover:scale-105 cursor-pointer"
              onClick={() => goToDetails(product)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goToDetails(product);
                }
              }}
              aria-label={`View details for ${product.name}`}
            >
              {/* Labels */}
              <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                {(product.labels || []).map((label, index) => (
                  <span
                    key={index}
                    className={`${labelColor(
                      label
                    )} text-white text-xs px-2 py-0.5 rounded`}
                  >
                    {String(label || "").toUpperCase()}
                  </span>
                ))}
              </div>

              {/* Product Image */}
              <img
                src={product.image || FallbackImg}
                alt={product.name}
                className="w-full h-48 object-contain rounded-md mt-6 bg-gray-100 transform transition-transform duration-300 hover:scale-110"
                onError={(e) => {
                  e.currentTarget.src = FallbackImg;
                }}
                loading="lazy"
              />

              {/* Product Name */}
              <h3 className="mt-3 text-sm font-medium line-clamp-2">
                {product.name}
              </h3>

              {/* Price */}
              <div className="text-sm font-semibold mb-3">
                {product.price_display ? (
                  <p className="text-blue-600">{product.price_display}</p>
                ) : (
                  <p className="text-gray-500">Price unavailable</p>
                )}
                {product.old_price_ksh ? (
                  <p className="text-gray-400 line-through">
                    {product.old_price_ksh}
                  </p>
                ) : null}
              </div>

              {/* Actions */}
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="w-full border bg-white text-gray-900 py-2 text-sm font-medium rounded-lg hover:bg-gray-50 shadow-sm transition"
                  onClick={() => navigate(`/latest-offers/${product.id}`)}
                >
                  View Details
                </button>

                <button
                  className={`w-full py-2 text-sm font-medium rounded-lg shadow-sm transition ${
                    product.product_id
                      ? isAdding
                        ? "bg-blue-600 text-white opacity-70 cursor-wait"
                        : "bg-black hover:bg-gray-800 text-white"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                  onClick={() => {
                    if (!product.product_id || isAdding) return;
                    handleAddToCart(product);
                  }}
                  disabled={!product.product_id || isAdding}
                  title={product.product_id ? "Add to cart" : "Unavailable"}
                >
                  {isAdding ? "Adding…" : "ADD TO CART"}
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
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            Next →
          </button>
        </div>
      )}
    </section>
  );
};

export default LatestOffers;
