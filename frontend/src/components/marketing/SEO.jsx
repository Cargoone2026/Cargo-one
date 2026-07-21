import { useEffect } from "react";

/**
 * Minimal, dependency-free document-head updater. Sets <title>, description,
 * theme-color and canonical/OG/Twitter meta on mount and cleans up on unmount.
 * Matches the shape of the Expo `<SEO />` component.
 */
export function SEO({ title, description, image, path }) {
  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = title;

    const url = path
      ? `https://cargoone.co.uk${path.startsWith("/") ? "" : "/"}${path}`
      : "https://cargoone.co.uk";

    const metas = [
      { name: "description", content: description },
      { name: "theme-color", content: "#D62828" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Cargo One" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      ...(image ? [{ property: "og:image", content: image }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(image ? [{ name: "twitter:image", content: image }] : []),
    ];

    const added = [];
    metas.forEach(({ name, property, content }) => {
      if (!content) return;
      const attr = name ? "name" : "property";
      const key = name || property;
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        added.push(el);
      }
      el.setAttribute("content", content);
    });

    // Canonical
    let canonical = document.head.querySelector("link[rel='canonical']");
    let addedCanonical = false;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
      addedCanonical = true;
    }
    canonical.setAttribute("href", url);

    return () => {
      document.title = previousTitle;
      added.forEach((el) => el.remove());
      if (addedCanonical && canonical) canonical.remove();
    };
  }, [title, description, image, path]);

  return null;
}
