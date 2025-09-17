/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        slide: {
          '0%': { transform: 'translateX(0%)' },
          '20%': { transform: 'translateX(0%)' },

          '25%': { transform: 'translateX(-100%)' },
          '45%': { transform: 'translateX(-100%)' },

          '50%': { transform: 'translateX(-200%)' },
          '70%': { transform: 'translateX(-200%)' },

          '75%': { transform: 'translateX(-300%)' },
          '95%': { transform: 'translateX(-300%)' },

          '100%': { transform: 'translateX(-400%)' },
        },
      },
      animation: {
        slide: 'slide 20s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
