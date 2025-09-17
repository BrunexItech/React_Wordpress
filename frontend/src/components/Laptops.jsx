// src/Pages/Laptops.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { gql, useQuery, useMutation } from "@apollo/client";
import { toast } from "react-toastify";

const placeholder = "https://via.placeholder.com/600x400?text=Product";
const FallbackImg = placeholder;
const LAPTOPS_CATEGORY_SLUG = "laptops";

/* ---------------- GraphQL ---------------- */

const LIST_LAPTOP_PRODUCTS = gql`
  query LaptopProducts(
    $categorySlugs: [String]!
    $first: Int = 20
    $after: String
    $orderbyField: ProductsOrderByEnum = DATE
    $order: OrderEnum = DESC
  ) {
    products(
      first: $first
      after: $after
      where: {
        categoryIn: $categorySlugs
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
        shortDescription
        image { sourceUrl altText }
        productTags(first: 50) { nodes { name slug } }
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
      cart { contents { itemCount } subtotal total }
    }
  }
`;

/* ---------------- helpers ---------------- */

const money = (raw) => {
  if (!raw && raw !== 0) return "";
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? String(raw) : `Ksh ${n.toLocaleString()}`;
};

const firstTagValue = (tags = [], key) => {
  const row = tags.find((t) =>
    (t?.name || "").toLowerCase().startsWith(`${key.toLowerCase()}:`)
  );
  if (!row) return null;
  return (row.name.split(":")[1] || "").trim();
};

const normalize = (n) => {
  const tags = n?.productTags?.nodes || [];
  const brand = firstTagValue(tags, "Brand") || "";
  const discount = firstTagValue(tags, "Discount") || "";

  const current = n.salePrice || n.price || n.regularPrice || null;
  const old = n.onSale && n.regularPrice ? n.regularPrice : null;

  return {
    id: n.databaseId ?? n.id,
    image: n.image?.sourceUrl || FallbackImg,
    name: n.name,
    brand,
    price: money(current),
    oldPrice: old ? money(old) : null,
    discount,
    desc: n.shortDescription || "",
    product_id: n.databaseId || null,
  };
};

/** Card Component */
const LaptopCard = ({
  id,
  image,
  name,
  brand,
  price,
  oldPrice,
  discount,
  onAddToCart,
  adding = false,
}) => {
  return (
    <div className="group relative bg-white rounded-xl overflow-hidden shadow-md border transition-all duration-300 hover:shadow-xl">
      {discount && (
        <span className="absolute top-2 left-2 z-10 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
          {discount}
        </span>
      )}

      {/* Product Image */}
      <div className="relative overflow-hidden">
        <Link to={`/product/${id}`} className="block">
          <img
            src={image}
            alt={name}
            className="w-full h-56 object-cover transform transition-transform duration-500 group-hover:scale-110"
            onError={(e) => { e.currentTarget.src = FallbackImg; }}
            loading="lazy"
          />
        </Link>
      </div>

      {/* Hover Buttons BELOW image */}
      <div className="h-0 overflow-hidden group-hover:h-20 transition-all duration-300 bg-white border-t border-gray-200 flex items-center justify-center gap-3 px-4">
        <Link
          to={`/product/${id}`}
          className="flex-1 bg-orange-600 text-white text-center py-2 rounded-lg shadow-md hover:bg-orange-700 hover:scale-105 transform transition text-sm font-medium"
        >
          QUICK VIEW
        </Link>

        <button
          onClick={() => onAddToCart(id, name)}
          disabled={adding}
          className="flex-1 bg-orange-600 text-white py-2 rounded-lg shadow-md hover:bg-orange-700 hover:scale-105 transform transition text-sm font-medium disabled:opacity-60 disabled:hover:scale-100"
        >
          {adding ? "Adding…" : "Add to Cart"}
        </button>
      </div>

      {/* Card Content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mt-1">{name}</h3>
        <p className="text-gray-600 text-sm">{brand}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-orange-600 font-bold">{price}</span>
          {oldPrice && <span className="text-gray-400 line-through text-sm">{oldPrice}</span>}
        </div>
      </div>
    </div>
  );
};

/** Main Laptops Section */
const Laptops = () => {
  const [addingMap, setAddingMap] = useState({}); // { [productId]: true }

  const { data, loading, error } = useQuery(LIST_LAPTOP_PRODUCTS, {
    variables: {
      categorySlugs: [LAPTOPS_CATEGORY_SLUG],
      first: 20,
      after: null,
      orderbyField: "DATE",
      order: "DESC",
    },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const [mutateAddToCart] = useMutation(ADD_TO_CART);

  const products = useMemo(() => {
    const nodes = data?.products?.nodes || [];
    return nodes.map(normalize);
  }, [data]);

  // Add to cart handler with toast (GraphQL)
  const handleAddToCart = async (productId, productName = "Item") => {
    try {
      setAddingMap((m) => ({ ...m, [productId]: true }));
      const res = await mutateAddToCart({ variables: { productId, quantity: 1 } });
      const newCount = res?.data?.addToCart?.cart?.contents?.itemCount;

      // keep your header/cart badge in sync
      if (typeof newCount === "number") {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { count: newCount } }));
      } else {
        window.dispatchEvent(new CustomEvent("cart-updated", { detail: { delta: 1 } }));
      }
      toast.success(`${productName} added to cart`);
    } catch (err) {
      toast.error(err?.message || "Failed to add to cart");
    } finally {
      setAddingMap((m) => {
        const copy = { ...m };
        delete copy[productId];
        return copy;
      });
    }
  };

  if (loading) return <section className="px-6 py-10">Loading…</section>;
  if (error)   return <section className="px-6 py-10 text-red-600">Error: {error.message}</section>;

  return (
    <section className="px-6 py-10">
      <div className="text-center max-w-3xl mx-auto mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Top Laptops for Work, School & Play</h2>
        <p className="text-gray-600 mt-2">
          Choose from trusted global brands at the best local prices in Ksh.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {products.map((p) => (
          <LaptopCard
            key={p.id}
            {...p}
            onAddToCart={handleAddToCart}
            adding={!!addingMap[p.id]}
          />
        ))}
      </div>
    </section>
  );
};

export default Laptops;
