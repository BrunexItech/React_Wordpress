// src/Pages/SearchResults.jsx
import React, { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { gql, useQuery } from "@apollo/client";

/* ---------- helpers you already had ---------- */
const getTitle = (x) =>
  x?.name || x?.title || x?.model || x?.slug || x?.username || "Untitled";
const getImage = (x) =>
  x?.image || x?.thumbnail || x?.main_image || x?.photo || x?.cover || null;
const getPrice = (x) => x?.price ?? x?.sale_price ?? x?.amount ?? null;

const getDetailPath = (type, x) => {
  const id = x?.id ?? x?.pk ?? x?.slug ?? "";
  switch (type) {
    case "smartphones":       return `/smartphones/${id}`;
    case "tablets":           return `/tablets/${id}`;
    case "reallaptops":       return `/reallaptops/${id}`;
    case "televisions":       return `/televisions/${id}`;
    case "audio":             return `/audio/${id}`;
    case "accessories":       return `/mobile-accessories/${id}`;
    case "storages":          return `/storage/${id}`;
    case "mkopa":             return `/mkopa/${id}`;
    case "newIphones":        return `/new-iphones/${id}`;
    case "budgetSmartphones": return `/budget-smartphones/${id}`;
    case "dialPhones":        return `/dial-phones/${id}`;
    case "latestOffers":      return `/latest-offers/${id}`;
    default:                  return `/${type}/${id}`;
  }
};

/* ---------- GraphQL ---------- */
/* Adjust any category slugs to match your WP categories if different */
const SEARCH_ALL = gql`
  query SearchAll($q: String, $first: Int = 12) {
    smartphones: products(first: $first, where: { categoryIn: ["smartphones"], search: $q }) {
      nodes { ...ProductLite }
    }
    tablets: products(first: $first, where: { categoryIn: ["tablets"], search: $q }) {
      nodes { ...ProductLite }
    }
    reallaptops: products(first: $first, where: { categoryIn: ["laptops"], search: $q }) {
      nodes { ...ProductLite }
    }
    televisions: products(first: $first, where: { categoryIn: ["televisions"], search: $q }) {
      nodes { ...ProductLite }
    }
    audio: products(first: $first, where: { categoryIn: ["audio"], search: $q }) {
      nodes { ...ProductLite }
    }
    accessories: products(first: $first, where: { categoryIn: ["mobile-accessories"], search: $q }) {
      nodes { ...ProductLite }
    }
    storages: products(first: $first, where: { categoryIn: ["storage"], search: $q }) {
      nodes { ...ProductLite }
    }
    mkopa: products(first: $first, where: { categoryIn: ["mkopa-items"], search: $q }) {
      nodes { ...ProductLite }
    }
    newIphones: products(first: $first, where: { categoryIn: ["new-iphones"], search: $q }) {
      nodes { ...ProductLite }
    }
    budgetSmartphones: products(first: $first, where: { categoryIn: ["budget-smartphones"], search: $q }) {
      nodes { ...ProductLite }
    }
    dialPhones: products(first: $first, where: { categoryIn: ["dial-phones"], search: $q }) {
      nodes { ...ProductLite }
    }
    latestOffers: products(first: $first, where: { categoryIn: ["latest-offers"], search: $q }) {
      nodes { ...ProductLite }
    }
  }

  fragment ProductLite on Product {
    id
    databaseId
    slug
    name
    image { sourceUrl altText }
    ... on SimpleProduct {
      price
      regularPrice
      salePrice
      onSale
    }
    ... on VariableProduct {
      price
      regularPrice
      salePrice
      onSale
    }
  }
`;

/* Normalize GraphQL node → your Section-shape */
const priceNumber = (raw) => {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? null : n;
};
const toItem = (n) => ({
  id: n.databaseId ?? n.id,
  name: n.name,
  image: n.image?.sourceUrl || null,
  // Section expects a numeric `price` so it can format with Intl.NumberFormat
  price: priceNumber(n.salePrice || n.price || n.regularPrice),
  slug: n.slug,
});

/* ---------- UI blocks ---------- */
const Section = ({ title, type, items }) => {
  if (!items || !items.length) return null;
  return (
    <section className="mb-8">
      <h3 className="mb-3 text-lg font-semibold text-gray-900">{title}</h3>
      <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const img = getImage(item);
          const href = getDetailPath(type, item);
          return (
            <li
              key={`${type}-${item.id || item.slug}`}
              className="border rounded-lg p-3 hover:shadow-sm"
            >
              <Link to={href} className="block">
                {img ? (
                  <img
                    src={img}
                    alt={getTitle(item)}
                    className="w-full h-40 object-contain mb-2"
                    loading="lazy"
                  />
                ) : null}
                <div className="text-sm text-gray-900 line-clamp-2">
                  {getTitle(item)}
                </div>
                {getPrice(item) != null && (
                  <div className="mt-1 font-semibold">
                    {Intl.NumberFormat().format(Number(getPrice(item)))}
                  </div>
                )}
                <div className="mt-1 text-xs text-gray-500">{title}</div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default function SearchResults() {
  const [params] = useSearchParams();
  const q = useMemo(() => (params.get("q") || "").trim(), [params]);

  const { data, loading, error } = useQuery(SEARCH_ALL, {
    variables: { q, first: 12 },
    skip: !q, // don’t query until there’s a term
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  // Normalize each alias bucket into your item shape
  const buckets = useMemo(() => {
    if (!data) {
      return {
        smartphones: [],
        tablets: [],
        reallaptops: [],
        televisions: [],
        audio: [],
        accessories: [],
        storages: [],
        mkopa: [],
        newIphones: [],
        budgetSmartphones: [],
        dialPhones: [],
        latestOffers: [],
      };
    }
    const mapConn = (conn) => (conn?.nodes || []).map(toItem);
    return {
      smartphones: mapConn(data.smartphones),
      tablets: mapConn(data.tablets),
      reallaptops: mapConn(data.reallaptops),
      televisions: mapConn(data.televisions),
      audio: mapConn(data.audio),
      accessories: mapConn(data.accessories),
      storages: mapConn(data.storages),
      mkopa: mapConn(data.mkopa),
      newIphones: mapConn(data.newIphones),
      budgetSmartphones: mapConn(data.budgetSmartphones),
      dialPhones: mapConn(data.dialPhones),
      latestOffers: mapConn(data.latestOffers),
    };
  }, [data]);

  const totalCount = useMemo(
    () => Object.values(buckets).reduce((n, arr) => n + (arr?.length || 0), 0),
    [buckets]
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <h2 className="text-2xl font-semibold text-gray-900">Search results</h2>
      <p className="text-sm text-gray-500 mb-6">
        {q ? (
          <>
            Showing results for <span className="font-medium">“{q}”</span>
          </>
        ) : (
          "Enter a query to search."
        )}
      </p>

      {error ? (
        <div className="text-red-600">Error: {error.message}</div>
      ) : loading && q ? (
        <div className="text-gray-600">Searching…</div>
      ) : !q ? (
        <div className="text-gray-600">Try searching by brand or model name.</div>
      ) : totalCount === 0 ? (
        <div className="text-gray-700 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          Item not found. Try a different keyword or check the spelling.
        </div>
      ) : (
        <>
          <Section title="Smartphones"        type="smartphones"        items={buckets.smartphones} />
          <Section title="Tablets"            type="tablets"            items={buckets.tablets} />
          <Section title="Laptops"            type="reallaptops"        items={buckets.reallaptops} />
          <Section title="Televisions"        type="televisions"        items={buckets.televisions} />
          <Section title="Audio"              type="audio"              items={buckets.audio} />
          <Section title="Mobile accessories" type="accessories"        items={buckets.accessories} />
          <Section title="Storage devices"    type="storages"           items={buckets.storages} />
          <Section title="M-KOPA Phones"      type="mkopa"              items={buckets.mkopa} />
          <Section title="New iPhones"        type="newIphones"         items={buckets.newIphones} />
          <Section title="Budget smartphones" type="budgetSmartphones"  items={buckets.budgetSmartphones} />
          <Section title="Dial phones"        type="dialPhones"         items={buckets.dialPhones} />
          <Section title="Latest offers"      type="latestOffers"       items={buckets.latestOffers} />
        </>
      )}
    </div>
  );
}
