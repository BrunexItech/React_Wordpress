// src/components/Hero.jsx
import React, { useEffect, useRef, useState } from "react";
import { gql} from "@apollo/client";
import {useQuery } from "@apollo/client/react";

const HERO_AND_PRODUCTS = gql`
  query HeroAndProducts($heroFirst: Int = 10, $productFirst: Int = 12) {
    hero: posts(where: { categoryName: "hero" }, first: $heroFirst) {
      nodes {
        id
        title
        excerpt
        date
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
      }
    }
    products: posts(where: { categoryName: "product" }, first: $productFirst) {
      nodes {
        id
        title
        excerpt
        date
        featuredImage {
          node {
            sourceUrl
            altText
          }
        }
      }
    }
  }
`;

function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, "").trim();
}

const Hero = () => {
  const [heroImages, setHeroImages] = useState([]);
  const [productImages, setProductImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const sliderRef = useRef(null);

  // ✅ Fetch from WordPress via WPGraphQL
  const { data, loading, error } = useQuery(HERO_AND_PRODUCTS, {
    variables: { heroFirst: 10, productFirst: 12 },
  });

  // Map WP data into your previous shape
  useEffect(() => {
    if (!data) return;

    const heroes =
      data?.hero?.nodes?.map((n) => ({
        id: n.id,
        title: stripHtml(n.title),
        description: stripHtml(n.excerpt),
        category: "hero",
        image: n.featuredImage?.node?.sourceUrl || "",
        created_at: n.date,
      })) || [];

    const products =
      data?.products?.nodes?.map((n) => ({
        id: n.id,
        title: stripHtml(n.title),
        description: stripHtml(n.excerpt),
        category: "product",
        image: n.featuredImage?.node?.sourceUrl || "",
        created_at: n.date,
      })) || [];

    setHeroImages(heroes);
    setProductImages(products);
  }, [data]);

  // Auto-slide effect (unchanged)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTransitionEnd = () => {
    if (heroImages.length === 0) return;
    if (currentIndex === heroImages.length) {
      setIsTransitioning(false);
      setCurrentIndex(0);
      setTimeout(() => {
        setIsTransitioning(true);
      }, 50);
    }
  };

  // Basic loading/error states
  if (error) {
    console.error("GraphQL error in Hero:", error);
  }

  return (
    <>
      {/* Sliding Hero Section */}
      <div
        className="
        relative w-full h-[45vh] md:h-[500px] overflow-hidden
        border-t-4 border-gray-300
        shadow-lg shadow-gray-500/30
        rounded-xl md:rounded-none mt-4 mb-6
        bg-black
      "
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent z-10 pointer-events-none"></div>

        {/* Text & Button Overlay */}
        <div className="absolute inset-0 z-20 flex flex-col items-center md:items-start justify-center text-center md:text-left px-4 md:px-12">
          <h1 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">
            Upgrade Your Lifestyle
          </h1>
          <p className="text-sm md:text-lg text-gray-200 mt-2 mb-4 max-w-md">
            Discover our premium collection of electronics and accessories tailored just for you.
          </p>
          <button className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-5 rounded-full shadow-lg transition-transform transform hover:scale-105">
            Shop Now
          </button>
        </div>

        {/* Slider Images */}
        <div
          ref={sliderRef}
          className="flex h-full"
          onTransitionEnd={handleTransitionEnd}
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
            transition: isTransitioning ? "transform 1s ease-in-out" : "none",
            willChange: "transform",
          }}
        >
          {loading ? (
            <div className="w-full h-full flex items-center justify-center text-white">
              Loading slider...
            </div>
          ) : heroImages.length > 0 ? (
            // append first to enable seamless loop
            [...heroImages, heroImages[0]].map((img, i) => (
              <img
                key={i}
                src={img.image}
                alt={img.title || `slide-${i}`}
                className="min-w-full h-[45vh] md:h-[500px] object-cover flex-shrink-0 transition-transform duration-1000 ease-in-out transform hover:scale-105"
                loading="lazy"
              />
            ))
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              No hero images found.
            </div>
          )}
        </div>
      </div>

      {/* Product Cards with text overlays */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-10 px-3 md:px-4">
        {loading ? (
          <div className="col-span-4 text-center text-gray-500">Loading products...</div>
        ) : productImages.length > 0 ? (
          productImages.map((item, i) => (
            <div
              key={i}
              className="relative bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden group hover:shadow-xl transition-shadow duration-300"
            >
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-[180px] md:h-[300px] object-contain bg-white transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              {/* Overlay Text */}
              <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3">
                <h3 className="text-white font-semibold text-sm md:text-base">
                  {item.title}
                </h3>
                <p className="text-gray-200 text-xs md:text-sm">
                  {item.description}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-4 text-center text-gray-500">No products found.</div>
        )}
      </div>
    </>
  );
};

export default Hero;
