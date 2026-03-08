/**
 * Supplier portal configurations for embedded webshop access.
 * Each supplier has a home URL and a search URL template.
 */

export interface SupplierPortal {
  id:         string;
  name:       string;
  shortName:  string;
  homeUrl:    string;
  searchUrl:  (query: string) => string;
  color:      string;   // Tailwind bg-color class
  textColor:  string;   // Tailwind text-color class
  icon:       string;   // Emoji or initial letter
}

export const SUPPLIER_PORTALS: SupplierPortal[] = [
  {
    id: "autodoc",
    name: "Autodoc",
    shortName: "Autodoc",
    homeUrl: "https://www.autodoc.se",
    searchUrl: (q) => `https://www.autodoc.se/search?q=${encodeURIComponent(q)}`,
    color: "bg-blue-600",
    textColor: "text-blue-400",
    icon: "A",
  },
  {
    id: "trodo",
    name: "Trodo",
    shortName: "Trodo",
    homeUrl: "https://www.trodo.se",
    searchUrl: (q) => `https://www.trodo.se/search?q=${encodeURIComponent(q)}`,
    color: "bg-orange-600",
    textColor: "text-orange-400",
    icon: "T",
  },
  {
    id: "bilxtra_pro",
    name: "BilXtra Pro",
    shortName: "BilXtra",
    homeUrl: "https://pro.bilxtra.se/INTERSHOP/web/WFS/Mekonomen-BilxtraB2BSE-Site/sv_SE/-/SEK/Default-Start",
    searchUrl: (q) => `https://pro.bilxtra.se/INTERSHOP/web/WFS/Mekonomen-BilxtraB2BSE-Site/sv_SE/-/SEK/ViewParametricSearch-SimpleOfferSearch?SearchTerm=${encodeURIComponent(q)}`,
    color: "bg-red-600",
    textColor: "text-red-400",
    icon: "B",
  },
];

export function getPortalById(id: string): SupplierPortal | undefined {
  return SUPPLIER_PORTALS.find((p) => p.id === id);
}
