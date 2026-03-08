/**
 * Default VHC (Vehicle Health Check) categories and inspection points.
 * Swedish labels — used to generate initial checklist for a new VHC.
 */

export interface VhcCategory {
  key: string;
  label: string;
  items: string[];
}

export const VHC_CATEGORIES: VhcCategory[] = [
  {
    key: "brakes",
    label: "Bromsar",
    items: [
      "Bromsbelägg fram",
      "Bromsbelägg bak",
      "Bromsskivor fram",
      "Bromsskivor bak",
      "Bromsrör/slangar",
      "Handbroms",
    ],
  },
  {
    key: "tires",
    label: "Däck",
    items: [
      "Mönsterdjup VF",
      "Mönsterdjup HF",
      "Mönsterdjup VB",
      "Mönsterdjup HB",
      "Däckskador/slitage",
      "Fälgar",
    ],
  },
  {
    key: "lights",
    label: "Belysning",
    items: [
      "Helljus",
      "Halvljus",
      "Blinkers fram/bak",
      "Bromsljus",
      "Bakljus",
      "Skyltbelysning",
      "Dimljus",
    ],
  },
  {
    key: "fluids",
    label: "Vätskor",
    items: [
      "Motorolja (nivå/kvalitet)",
      "Kylvätska",
      "Bromsvätska",
      "Spolarvätska",
      "Servostyrning",
      "Växellådsolja",
    ],
  },
  {
    key: "suspension",
    label: "Fjädring & styrning",
    items: [
      "Stötdämpare fram",
      "Stötdämpare bak",
      "Styrled",
      "Krängningshämmare",
      "Bärarmar",
      "Hjullager",
    ],
  },
  {
    key: "exhaust",
    label: "Avgassystem",
    items: [
      "Avgasrör",
      "Katalysator",
      "Ljuddämpare",
      "Avgasutsläpp/rök",
    ],
  },
  {
    key: "body",
    label: "Kaross & övrigt",
    items: [
      "Vindrutor (sprickor/skador)",
      "Torkarblad",
      "Rostskador",
      "Drivknut/manschett",
      "AC-system",
      "Batteri",
    ],
  },
];

/** Total number of check items across all categories */
export const VHC_TOTAL_ITEMS = VHC_CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);
