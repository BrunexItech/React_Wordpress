// src/components/ScrollToTop.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Usage:
 *   <BrowserRouter>
 *     <ScrollToTop containerSelector="#app-scroll" />  // optional selector
 *     <App />
 *   </BrowserRouter>
 *
 * If you have a custom scrolling wrapper, give it an id or data attribute, e.g.:
 *   <div id="app-scroll" className="h-screen overflow-y-auto">...</div>
 */
export default function ScrollToTop({ containerSelector } = {}) {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const prev = window.history.scrollRestoration;
    try { window.history.scrollRestoration = "manual"; } catch {}

    const behavior = "auto"; // use instant jump to ensure top is visible immediately

    const scrollAll = () => {
      const nodes = [
        ...(containerSelector ? Array.from(document.querySelectorAll(containerSelector)) : []),
        document.querySelector("[data-scroll-container]"),
        document.querySelector("main"),
        document.getElementById("app"),
        document.getElementById("root"),
        document.scrollingElement,
        document.documentElement,
        document.body,
      ].filter(Boolean);

      const seen = new Set();
      for (const el of nodes) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (typeof el.scrollTo === "function") {
          el.scrollTo({ top: 0, left: 0, behavior });
        } else {
          el.scrollTop = 0;
          el.scrollLeft = 0;
        }
      }
    };

    // If there’s a hash, try to scroll to the anchor (with retries until it exists),
    // otherwise scroll to top.
    if (hash && hash !== "#") {
      let ticks = 0;
      const id = hash.slice(1);
      const handle = window.setInterval(() => {
        const target = document.getElementById(id);
        ticks++;
        if (target) {
          target.scrollIntoView({ behavior, block: "start" });
          window.clearInterval(handle);
        } else if (ticks > 40) { // ~640ms fallback
          scrollAll();
          window.clearInterval(handle);
        }
      }, 16);

      return () => {
        window.clearInterval(handle);
        try { window.history.scrollRestoration = prev || "auto"; } catch {}
      };
    }

    // No hash: scroll to top now + a few rAF passes to beat layout shifts
    scrollAll();
    let tries = 0;
    const raf = () => {
      tries++;
      scrollAll();
      if (tries < 3) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    // Also after 'load' (images/fonts settling)
    const onLoad = () => scrollAll();
    window.addEventListener("load", onLoad, { once: true });

    return () => {
      window.removeEventListener("load", onLoad);
      try { window.history.scrollRestoration = prev || "auto"; } catch {}
    };
  }, [pathname, hash, containerSelector]);

  return null;
}
