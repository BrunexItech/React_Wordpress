import React from "react";

const accessories = [
  {
    id: 1,
    name: "Samsung Galaxy Watch Ultra 2025",
    price: "KSh 76,000",
    oldPrice: null,
    badge: "NEW",
    image: "/images/watch-ultra-2025.jpg",
  },
  {
    id: 2,
    name: "Samsung Galaxy Watch 8 Classic",
    price: "KSh 56,000",
    oldPrice: null,
    badge: "NEW",
    image: "/images/watch-8-classic.jpg",
  },
  {
    id: 3,
    name: "Samsung Galaxy Watch 8",
    price: "KSh 36,500–KSh 43,000",
    oldPrice: null,
    badge: "NEW",
    image: "/images/watch-8.jpg",
  },
  {
    id: 4,
    name: "Anker 323 USB-C Power Bank",
    price: "KSh 5,500",
    oldPrice: "KSh 6,700",
    badge: "SALE",
    image: "/images/anker-323.jpg",
  },
  {
    id: 5,
    name: "Anker Zolo Power Bank (10000 mAh)",
    price: "KSh 5,600",
    oldPrice: null,
    badge: null,
    image: "/images/anker-zolo.jpg",
  },
  {
    id: 6,
    name: "Anker Power Bank with Built-in USB-C Cable and Lanyard 10000mAh 22.5W",
    price: "KSh 5,000",
    oldPrice: "KSh 5,600",
    badge: "SALE",
    image: "/images/anker-lanyard.jpg",
  },
];

const HotestNewPicks = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Section title */}
      <h2 className="text-lg md:text-xl font-bold mb-6">Hotest New Picks</h2>

      {/* Grid layout */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {accessories.map((item) => (
          <div
            key={item.id}
            className="relative border border-gray-200 rounded-lg p-3 flex flex-col items-center group hover:shadow-md transition-shadow duration-300"
          >
            {/* Badge */}
            {item.badge && (
              <span
                className={`absolute top-2 left-2 ${
                  item.badge === "NEW" ? "bg-green-500" : "bg-red-500"
                } text-white text-xs font-bold px-2 py-1 rounded`}
              >
                {item.badge}
              </span>
            )}

            {/* Image with stretch down + hover underline */}
            <div className="relative w-full overflow-hidden">
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-32 object-contain transform transition-transform duration-300 group-hover:scale-y-110"
              />
              <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-blue-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
            </div>

            {/* Name */}
            <h3 className="mt-3 text-xs sm:text-sm font-semibold text-center">
              {item.name}
            </h3>

            {/* Prices */}
            <div className="mt-2 text-center">
              <p className="text-blue-600 font-bold text-sm">{item.price}</p>
              {item.oldPrice && (
                <p className="text-gray-400 text-xs line-through">
                  {item.oldPrice}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HotestNewPicks;
