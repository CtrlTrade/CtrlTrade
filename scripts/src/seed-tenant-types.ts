import { db, tenantTypesTable } from "@workspace/db";

interface TenantTypeSeed {
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  sortOrder: number;
  industrySlug: string | null;
  defaultModules: {
    posEnabled?: boolean;
    hasTradeShop?: boolean;
    hasMobileWorkforce?: boolean;
    appointmentBookingEnabled?: boolean;
    multiBranchEnabled?: boolean;
  };
}

const TENANT_TYPES: TenantTypeSeed[] = [
  // ── Building & Construction ──────────────────────────────────────────────
  { slug: "general-builder", name: "General Builder", category: "🏗️ Building & Construction", categorySlug: "building-construction", sortOrder: 1, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "groundworker", name: "Groundworker", category: "🏗️ Building & Construction", categorySlug: "building-construction", sortOrder: 2, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "bricklayer", name: "Bricklayer / Masonry", category: "🏗️ Building & Construction", categorySlug: "building-construction", sortOrder: 3, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "plasterer", name: "Plasterer", category: "🏗️ Building & Construction", categorySlug: "building-construction", sortOrder: 4, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "carpenter-joiner", name: "Carpenter / Joiner", category: "🏗️ Building & Construction", categorySlug: "building-construction", sortOrder: 5, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "roofer", name: "Roofer", category: "🏗️ Building & Construction", categorySlug: "building-construction", sortOrder: 6, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "scaffolding", name: "Scaffolding Contractor", category: "🏗️ Building & Construction", categorySlug: "building-construction", sortOrder: 7, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "demolition", name: "Demolition Contractor", category: "🏗️ Building & Construction", categorySlug: "building-construction", sortOrder: 8, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "insulation", name: "Insulation Contractor", category: "🏗️ Building & Construction", categorySlug: "building-construction", sortOrder: 9, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },

  // ── Mechanical & Electrical ──────────────────────────────────────────────
  { slug: "plumber", name: "Plumber", category: "⚡ Mechanical & Electrical", categorySlug: "mechanical-electrical", sortOrder: 1, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },
  { slug: "hvac", name: "HVAC / Air Conditioning", category: "⚡ Mechanical & Electrical", categorySlug: "mechanical-electrical", sortOrder: 2, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },
  { slug: "electrician", name: "Electrician", category: "⚡ Mechanical & Electrical", categorySlug: "mechanical-electrical", sortOrder: 3, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },
  { slug: "gas-engineer", name: "Gas Engineer", category: "⚡ Mechanical & Electrical", categorySlug: "mechanical-electrical", sortOrder: 4, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },
  { slug: "fire-security", name: "Fire & Security Installer", category: "⚡ Mechanical & Electrical", categorySlug: "mechanical-electrical", sortOrder: 5, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },
  { slug: "refrigeration", name: "Refrigeration Engineer", category: "⚡ Mechanical & Electrical", categorySlug: "mechanical-electrical", sortOrder: 6, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },
  { slug: "solar-installer-me", name: "Solar / PV Installer", category: "⚡ Mechanical & Electrical", categorySlug: "mechanical-electrical", sortOrder: 7, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },
  { slug: "data-network", name: "Data & Network Cabling", category: "⚡ Mechanical & Electrical", categorySlug: "mechanical-electrical", sortOrder: 8, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },

  // ── Specialist Trades ────────────────────────────────────────────────────
  { slug: "painter-decorator", name: "Painter & Decorator", category: "🎨 Specialist Trades", categorySlug: "specialist-trades", sortOrder: 1, industrySlug: "specialist-trades", defaultModules: { hasMobileWorkforce: true } },
  { slug: "flooring-fitter", name: "Flooring Fitter", category: "🎨 Specialist Trades", categorySlug: "specialist-trades", sortOrder: 2, industrySlug: "specialist-trades", defaultModules: { hasMobileWorkforce: true } },
  { slug: "tiler", name: "Tiler", category: "🎨 Specialist Trades", categorySlug: "specialist-trades", sortOrder: 3, industrySlug: "specialist-trades", defaultModules: { hasMobileWorkforce: true } },
  { slug: "glazier", name: "Glazier / Window Fitter", category: "🎨 Specialist Trades", categorySlug: "specialist-trades", sortOrder: 4, industrySlug: "specialist-trades", defaultModules: { hasMobileWorkforce: true } },
  { slug: "locksmith", name: "Locksmith", category: "🎨 Specialist Trades", categorySlug: "specialist-trades", sortOrder: 5, industrySlug: "specialist-trades", defaultModules: { hasMobileWorkforce: true } },
  { slug: "kitchen-installer", name: "Kitchen Fitter / Installer", category: "🎨 Specialist Trades", categorySlug: "specialist-trades", sortOrder: 6, industrySlug: "specialist-trades", defaultModules: { hasMobileWorkforce: true, appointmentBookingEnabled: true } },
  { slug: "bathroom-installer", name: "Bathroom Fitter / Installer", category: "🎨 Specialist Trades", categorySlug: "specialist-trades", sortOrder: 7, industrySlug: "specialist-trades", defaultModules: { hasMobileWorkforce: true, appointmentBookingEnabled: true } },
  { slug: "stone-masonry", name: "Stone Masonry / Heritage", category: "🎨 Specialist Trades", categorySlug: "specialist-trades", sortOrder: 8, industrySlug: "specialist-trades", defaultModules: { hasMobileWorkforce: true } },

  // ── Showroom & Retail ────────────────────────────────────────────────────
  { slug: "kitchen-showroom", name: "Kitchen Showroom", category: "🏪 Showroom & Retail", categorySlug: "showroom-retail", sortOrder: 1, industrySlug: "retail", defaultModules: { appointmentBookingEnabled: true, posEnabled: true } },
  { slug: "bathroom-showroom", name: "Bathroom Showroom", category: "🏪 Showroom & Retail", categorySlug: "showroom-retail", sortOrder: 2, industrySlug: "retail", defaultModules: { appointmentBookingEnabled: true, posEnabled: true } },
  { slug: "tile-flooring-showroom", name: "Tile & Flooring Showroom", category: "🏪 Showroom & Retail", categorySlug: "showroom-retail", sortOrder: 3, industrySlug: "retail", defaultModules: { appointmentBookingEnabled: true, posEnabled: true } },
  { slug: "furniture-showroom", name: "Furniture Showroom", category: "🏪 Showroom & Retail", categorySlug: "showroom-retail", sortOrder: 4, industrySlug: "retail", defaultModules: { appointmentBookingEnabled: true, posEnabled: true } },
  { slug: "lighting-electrical-showroom", name: "Lighting & Electrical Showroom", category: "🏪 Showroom & Retail", categorySlug: "showroom-retail", sortOrder: 5, industrySlug: "retail", defaultModules: { posEnabled: true } },
  { slug: "plumbing-heating-showroom", name: "Plumbing & Heating Showroom", category: "🏪 Showroom & Retail", categorySlug: "showroom-retail", sortOrder: 6, industrySlug: "retail", defaultModules: { appointmentBookingEnabled: true, posEnabled: true } },
  { slug: "interior-design-studio", name: "Interior Design Studio", category: "🏪 Showroom & Retail", categorySlug: "showroom-retail", sortOrder: 7, industrySlug: "retail", defaultModules: { appointmentBookingEnabled: true } },
  { slug: "smart-home-av", name: "Smart Home / AV Showroom", category: "🏪 Showroom & Retail", categorySlug: "showroom-retail", sortOrder: 8, industrySlug: "retail", defaultModules: { appointmentBookingEnabled: true, posEnabled: true } },

  // ── Trade Counters ───────────────────────────────────────────────────────
  { slug: "builders-merchant", name: "Builders' Merchant", category: "🏭 Trade Counters", categorySlug: "trade-counters", sortOrder: 1, industrySlug: "trade-counter", defaultModules: { posEnabled: true, hasTradeShop: true } },
  { slug: "plumbers-merchant", name: "Plumbers' Merchant", category: "🏭 Trade Counters", categorySlug: "trade-counters", sortOrder: 2, industrySlug: "trade-counter", defaultModules: { posEnabled: true, hasTradeShop: true } },
  { slug: "electrical-merchant", name: "Electrical Merchant", category: "🏭 Trade Counters", categorySlug: "trade-counters", sortOrder: 3, industrySlug: "trade-counter", defaultModules: { posEnabled: true, hasTradeShop: true } },
  { slug: "timber-merchant", name: "Timber Merchant", category: "🏭 Trade Counters", categorySlug: "trade-counters", sortOrder: 4, industrySlug: "trade-counter", defaultModules: { posEnabled: true, hasTradeShop: true } },
  { slug: "tool-hire-counter", name: "Tool Hire Counter", category: "🏭 Trade Counters", categorySlug: "trade-counters", sortOrder: 5, industrySlug: "trade-counter", defaultModules: { posEnabled: true, hasTradeShop: true } },
  { slug: "hvac-merchant", name: "HVAC & Refrigeration Merchant", category: "🏭 Trade Counters", categorySlug: "trade-counters", sortOrder: 6, industrySlug: "trade-counter", defaultModules: { posEnabled: true, hasTradeShop: true } },
  { slug: "paint-decorating-merchant", name: "Paint & Decorating Merchant", category: "🏭 Trade Counters", categorySlug: "trade-counters", sortOrder: 7, industrySlug: "trade-counter", defaultModules: { posEnabled: true, hasTradeShop: true } },
  { slug: "roofing-merchant", name: "Roofing Merchant", category: "🏭 Trade Counters", categorySlug: "trade-counters", sortOrder: 8, industrySlug: "trade-counter", defaultModules: { posEnabled: true, hasTradeShop: true } },
  { slug: "insulation-merchant", name: "Insulation Merchant", category: "🏭 Trade Counters", categorySlug: "trade-counters", sortOrder: 9, industrySlug: "trade-counter", defaultModules: { posEnabled: true, hasTradeShop: true } },

  // ── Landscaping & Outdoors ───────────────────────────────────────────────
  { slug: "landscaper", name: "Landscaper", category: "🌿 Landscaping & Outdoors", categorySlug: "landscaping-outdoors", sortOrder: 1, industrySlug: "landscaping", defaultModules: { hasMobileWorkforce: true } },
  { slug: "tree-surgeon", name: "Tree Surgeon / Arborist", category: "🌿 Landscaping & Outdoors", categorySlug: "landscaping-outdoors", sortOrder: 2, industrySlug: "landscaping", defaultModules: { hasMobileWorkforce: true } },
  { slug: "groundskeeper", name: "Groundskeeper / Grounds Maintenance", category: "🌿 Landscaping & Outdoors", categorySlug: "landscaping-outdoors", sortOrder: 3, industrySlug: "landscaping", defaultModules: { hasMobileWorkforce: true } },
  { slug: "fencing-contractor", name: "Fencing Contractor", category: "🌿 Landscaping & Outdoors", categorySlug: "landscaping-outdoors", sortOrder: 4, industrySlug: "landscaping", defaultModules: { hasMobileWorkforce: true } },
  { slug: "irrigation-drainage", name: "Irrigation & Drainage", category: "🌿 Landscaping & Outdoors", categorySlug: "landscaping-outdoors", sortOrder: 5, industrySlug: "landscaping", defaultModules: { hasMobileWorkforce: true } },
  { slug: "decking-paving", name: "Decking & Paving Specialist", category: "🌿 Landscaping & Outdoors", categorySlug: "landscaping-outdoors", sortOrder: 6, industrySlug: "landscaping", defaultModules: { hasMobileWorkforce: true } },
  { slug: "swimming-pool", name: "Swimming Pool Installer", category: "🌿 Landscaping & Outdoors", categorySlug: "landscaping-outdoors", sortOrder: 7, industrySlug: "landscaping", defaultModules: { hasMobileWorkforce: true, appointmentBookingEnabled: true } },

  // ── Property Services ────────────────────────────────────────────────────
  { slug: "property-maintenance", name: "Property Maintenance", category: "🏠 Property Services", categorySlug: "property-services", sortOrder: 1, industrySlug: "property", defaultModules: { hasMobileWorkforce: true } },
  { slug: "facilities-management", name: "Facilities Management", category: "🏠 Property Services", categorySlug: "property-services", sortOrder: 2, industrySlug: "property", defaultModules: { hasMobileWorkforce: true, multiBranchEnabled: true } },
  { slug: "cleaning-services", name: "Cleaning Services", category: "🏠 Property Services", categorySlug: "property-services", sortOrder: 3, industrySlug: "property", defaultModules: { hasMobileWorkforce: true } },
  { slug: "pest-control", name: "Pest Control", category: "🏠 Property Services", categorySlug: "property-services", sortOrder: 4, industrySlug: "property", defaultModules: { hasMobileWorkforce: true, appointmentBookingEnabled: true } },
  { slug: "drainage-waterproofing", name: "Drainage & Waterproofing", category: "🏠 Property Services", categorySlug: "property-services", sortOrder: 5, industrySlug: "property", defaultModules: { hasMobileWorkforce: true } },
  { slug: "lift-elevator", name: "Lift & Elevator Maintenance", category: "🏠 Property Services", categorySlug: "property-services", sortOrder: 6, industrySlug: "property", defaultModules: { hasMobileWorkforce: true } },
  { slug: "rubbish-removal", name: "Rubbish Removal / Skip Hire", category: "🏠 Property Services", categorySlug: "property-services", sortOrder: 7, industrySlug: "property", defaultModules: { hasMobileWorkforce: true } },

  // ── Automotive & Fleet ───────────────────────────────────────────────────
  { slug: "garage", name: "Garage / MOT Centre", category: "🚗 Automotive & Fleet", categorySlug: "automotive-fleet", sortOrder: 1, industrySlug: "automotive", defaultModules: { posEnabled: true, appointmentBookingEnabled: true } },
  { slug: "bodyshop", name: "Bodyshop", category: "🚗 Automotive & Fleet", categorySlug: "automotive-fleet", sortOrder: 2, industrySlug: "automotive", defaultModules: { posEnabled: true, appointmentBookingEnabled: true } },
  { slug: "tyre-fitter", name: "Tyre Fitter", category: "🚗 Automotive & Fleet", categorySlug: "automotive-fleet", sortOrder: 3, industrySlug: "automotive", defaultModules: { posEnabled: true, appointmentBookingEnabled: true } },
  { slug: "van-truck-fleet", name: "Van / Truck Fleet Maintenance", category: "🚗 Automotive & Fleet", categorySlug: "automotive-fleet", sortOrder: 4, industrySlug: "automotive", defaultModules: { hasMobileWorkforce: true } },
  { slug: "windscreen-repair", name: "Windscreen Repair", category: "🚗 Automotive & Fleet", categorySlug: "automotive-fleet", sortOrder: 5, industrySlug: "automotive", defaultModules: { posEnabled: true, appointmentBookingEnabled: true } },
  { slug: "auto-electrician", name: "Auto Electrician", category: "🚗 Automotive & Fleet", categorySlug: "automotive-fleet", sortOrder: 6, industrySlug: "automotive", defaultModules: { hasMobileWorkforce: true, appointmentBookingEnabled: true } },
  { slug: "hgv-trailer", name: "HGV & Trailer Specialist", category: "🚗 Automotive & Fleet", categorySlug: "automotive-fleet", sortOrder: 7, industrySlug: "automotive", defaultModules: { hasMobileWorkforce: true } },

  // ── Energy & Renewables ──────────────────────────────────────────────────
  { slug: "solar-pv", name: "Solar PV Installer", category: "☀️ Energy & Renewables", categorySlug: "energy-renewables", sortOrder: 1, industrySlug: "energy", defaultModules: { hasMobileWorkforce: true, appointmentBookingEnabled: true } },
  { slug: "heat-pump", name: "Heat Pump Installer", category: "☀️ Energy & Renewables", categorySlug: "energy-renewables", sortOrder: 2, industrySlug: "energy", defaultModules: { hasMobileWorkforce: true, appointmentBookingEnabled: true } },
  { slug: "battery-storage", name: "Battery Storage Installer", category: "☀️ Energy & Renewables", categorySlug: "energy-renewables", sortOrder: 3, industrySlug: "energy", defaultModules: { hasMobileWorkforce: true } },
  { slug: "ev-charger", name: "EV Charger Installer", category: "☀️ Energy & Renewables", categorySlug: "energy-renewables", sortOrder: 4, industrySlug: "energy", defaultModules: { hasMobileWorkforce: true, appointmentBookingEnabled: true } },
  { slug: "biomass-boiler", name: "Biomass & Boiler Installer", category: "☀️ Energy & Renewables", categorySlug: "energy-renewables", sortOrder: 5, industrySlug: "energy", defaultModules: { hasMobileWorkforce: true } },
  { slug: "smart-metering", name: "Smart Metering", category: "☀️ Energy & Renewables", categorySlug: "energy-renewables", sortOrder: 6, industrySlug: "energy", defaultModules: { hasMobileWorkforce: true } },
  { slug: "insulation-contractor-energy", name: "Insulation Contractor (Energy)", category: "☀️ Energy & Renewables", categorySlug: "energy-renewables", sortOrder: 7, industrySlug: "energy", defaultModules: { hasMobileWorkforce: true } },

  // ── Equipment Hire ───────────────────────────────────────────────────────
  { slug: "plant-hire", name: "Plant Hire", category: "🏗️ Equipment Hire", categorySlug: "equipment-hire", sortOrder: 1, industrySlug: "hire", defaultModules: { hasTradeShop: true } },
  { slug: "tool-hire", name: "Tool Hire", category: "🏗️ Equipment Hire", categorySlug: "equipment-hire", sortOrder: 2, industrySlug: "hire", defaultModules: { posEnabled: true, hasTradeShop: true } },
  { slug: "scaffold-hire", name: "Scaffold Hire", category: "🏗️ Equipment Hire", categorySlug: "equipment-hire", sortOrder: 3, industrySlug: "hire", defaultModules: { hasTradeShop: true } },
  { slug: "portable-toilet-hire", name: "Portable Toilet / Welfare Hire", category: "🏗️ Equipment Hire", categorySlug: "equipment-hire", sortOrder: 4, industrySlug: "hire", defaultModules: { hasTradeShop: true } },
  { slug: "pump-hire", name: "Pump & Dewatering Hire", category: "🏗️ Equipment Hire", categorySlug: "equipment-hire", sortOrder: 5, industrySlug: "hire", defaultModules: { hasTradeShop: true } },
  { slug: "temporary-fencing-hire", name: "Temporary Fencing Hire", category: "🏗️ Equipment Hire", categorySlug: "equipment-hire", sortOrder: 6, industrySlug: "hire", defaultModules: { hasTradeShop: true } },

  // ── Drainage & Water ─────────────────────────────────────────────────────
  { slug: "drainage-contractor", name: "Drainage Contractor", category: "💧 Drainage & Water", categorySlug: "drainage-water", sortOrder: 1, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "water-treatment", name: "Water Treatment Specialist", category: "💧 Drainage & Water", categorySlug: "drainage-water", sortOrder: 2, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "borehole-well", name: "Borehole & Well Driller", category: "💧 Drainage & Water", categorySlug: "drainage-water", sortOrder: 3, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "septic-tank", name: "Septic Tank Service", category: "💧 Drainage & Water", categorySlug: "drainage-water", sortOrder: 4, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },
  { slug: "cctv-drain-survey", name: "CCTV & Drain Survey", category: "💧 Drainage & Water", categorySlug: "drainage-water", sortOrder: 5, industrySlug: "construction", defaultModules: { hasMobileWorkforce: true } },

  // ── Telecoms & Digital ───────────────────────────────────────────────────
  { slug: "telecoms-installer", name: "Telecoms Installer", category: "📡 Telecoms & Digital", categorySlug: "telecoms-digital", sortOrder: 1, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },
  { slug: "aerial-satellite", name: "Aerial & Satellite Installer", category: "📡 Telecoms & Digital", categorySlug: "telecoms-digital", sortOrder: 2, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },
  { slug: "cctv-security-installer", name: "CCTV & Security Systems", category: "📡 Telecoms & Digital", categorySlug: "telecoms-digital", sortOrder: 3, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },
  { slug: "access-control", name: "Access Control Installer", category: "📡 Telecoms & Digital", categorySlug: "telecoms-digital", sortOrder: 4, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true } },
  { slug: "smart-building", name: "Smart Building Integrator", category: "📡 Telecoms & Digital", categorySlug: "telecoms-digital", sortOrder: 5, industrySlug: "mechanical-electrical", defaultModules: { hasMobileWorkforce: true, appointmentBookingEnabled: true } },

  // ── Other / General ──────────────────────────────────────────────────────
  { slug: "multi-trade", name: "Multi-Trade Contractor", category: "🔧 Other / General", categorySlug: "other-general", sortOrder: 1, industrySlug: null, defaultModules: { hasMobileWorkforce: true } },
  { slug: "maintenance-contractor", name: "Maintenance Contractor", category: "🔧 Other / General", categorySlug: "other-general", sortOrder: 2, industrySlug: null, defaultModules: { hasMobileWorkforce: true } },
  { slug: "sub-contractor", name: "Sub-Contractor", category: "🔧 Other / General", categorySlug: "other-general", sortOrder: 3, industrySlug: null, defaultModules: { hasMobileWorkforce: true } },
  { slug: "service-repair", name: "Service & Repair Business", category: "🔧 Other / General", categorySlug: "other-general", sortOrder: 4, industrySlug: null, defaultModules: { hasMobileWorkforce: true, appointmentBookingEnabled: true } },
  { slug: "trade-distributor", name: "Trade Distributor / Wholesaler", category: "🔧 Other / General", categorySlug: "other-general", sortOrder: 5, industrySlug: null, defaultModules: { hasTradeShop: true } },
  { slug: "field-service", name: "Field Service Business", category: "🔧 Other / General", categorySlug: "other-general", sortOrder: 6, industrySlug: null, defaultModules: { hasMobileWorkforce: true } },
  { slug: "other", name: "Other", category: "🔧 Other / General", categorySlug: "other-general", sortOrder: 99, industrySlug: null, defaultModules: {} },
];

async function main() {
  console.log(`Seeding ${TENANT_TYPES.length} tenant types…`);
  let upserted = 0;
  for (const t of TENANT_TYPES) {
    await db
      .insert(tenantTypesTable)
      .values({
        slug: t.slug,
        name: t.name,
        category: t.category,
        categorySlug: t.categorySlug,
        sortOrder: t.sortOrder,
        defaultModules: t.defaultModules,
        industrySlug: t.industrySlug ?? undefined,
      } as any)
      .onConflictDoUpdate({
        target: tenantTypesTable.slug,
        set: {
          name: t.name,
          category: t.category,
          categorySlug: t.categorySlug,
          sortOrder: t.sortOrder,
          defaultModules: t.defaultModules,
          industrySlug: t.industrySlug ?? undefined,
        } as any,
      });
    upserted++;
  }
  console.log(`Done — ${upserted} tenant types upserted.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
