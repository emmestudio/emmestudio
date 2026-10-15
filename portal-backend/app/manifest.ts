import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Emme Studio — Portale", short_name: "Emme Studio",
    description: "Il portale di lavoro del team Emme Studio",
    lang: "it", start_url: "/dashboard", scope: "/", display: "standalone",
    background_color: "#0b0c10", theme_color: "#0b0c10",
    icons: [192, 512].map(size => ({ src: `/app-icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })),
    shortcuts: [
      { name: "Calendario", url: "/calendario" },
      { name: "Artisti", url: "/artisti" },
      { name: "Produzione", url: "/produzione" },
    ],
  };
}
