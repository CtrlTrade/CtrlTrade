export const TRADE_CATEGORY_SEED: Array<{
  slug: string;
  name: string;
  jobTypes: string[];
  sortOrder: number;
}> = [
  {
    slug: "roofing",
    name: "Roofing",
    sortOrder: 10,
    jobTypes: [
      "Roof repair",
      "Roof replacement",
      "Gutter installation",
      "Flat roof installation",
      "Skylight installation",
      "Chimney repair",
    ],
  },
  {
    slug: "electrical",
    name: "Electrical",
    sortOrder: 20,
    jobTypes: [
      "Consumer unit upgrade",
      "Rewire",
      "EV charger install",
      "EICR inspection",
      "Lighting install",
      "Fault finding",
    ],
  },
  {
    slug: "plumbing",
    name: "Plumbing",
    sortOrder: 30,
    jobTypes: [
      "Bathroom install",
      "Boiler install / repair",
      "Leak detection",
      "Pipework",
      "Power flush",
      "Tap & fixture install",
    ],
  },
  {
    slug: "hvac",
    name: "HVAC",
    sortOrder: 40,
    jobTypes: [
      "AC install",
      "Ventilation install",
      "Heat pump install",
      "Service & maintenance",
      "Ductwork",
    ],
  },
  {
    slug: "general-building",
    name: "General Building",
    sortOrder: 50,
    jobTypes: [
      "Extensions",
      "Loft conversion",
      "Renovation",
      "Brickwork",
      "Structural repair",
    ],
  },
  {
    slug: "carpentry",
    name: "Carpentry & Joinery",
    sortOrder: 60,
    jobTypes: [
      "Bespoke furniture",
      "Kitchen install",
      "Door & window install",
      "Decking",
      "Skirting & architrave",
    ],
  },
  {
    slug: "painting-decorating",
    name: "Painting & Decorating",
    sortOrder: 70,
    jobTypes: [
      "Interior painting",
      "Exterior painting",
      "Wallpapering",
      "Plaster repair",
      "Spray finishing",
    ],
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    sortOrder: 80,
    jobTypes: [
      "Garden design",
      "Patio & paving",
      "Fencing",
      "Lawn install",
      "Tree work",
    ],
  },
  {
    slug: "tiling",
    name: "Tiling",
    sortOrder: 90,
    jobTypes: ["Wall tiling", "Floor tiling", "Wet rooms", "Splashbacks"],
  },
  {
    slug: "glazing",
    name: "Glazing",
    sortOrder: 100,
    jobTypes: [
      "Window install",
      "Conservatory install",
      "Glass repair",
      "Bi-fold doors",
    ],
  },
];
