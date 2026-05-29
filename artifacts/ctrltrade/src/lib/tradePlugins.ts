export type FieldType = "text" | "number" | "select" | "boolean" | "textarea" | "date";

export interface PluginField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  unit?: string;
  placeholder?: string;
  hint?: string;
}

export interface TradePlugin {
  slug: string;
  label: string;
  fields: PluginField[];
}

export const TRADE_PLUGINS: TradePlugin[] = [
  {
    slug: "roofing",
    label: "Roofing",
    fields: [
      {
        key: "roofType",
        label: "Roof Type",
        type: "select",
        options: ["flat", "pitched", "hip", "mansard", "gambrel", "mono-pitch", "butterfly"],
      },
      {
        key: "roofMaterial",
        label: "Roof Material",
        type: "select",
        options: ["felt", "GRP fibreglass", "EPDM rubber", "asphalt", "concrete tile", "clay tile", "natural slate", "metal", "thatch", "polycarbonate"],
      },
      { key: "roofAreaM2", label: "Roof Area", type: "number", unit: "m²", placeholder: "e.g. 120" },
      { key: "pitchDegrees", label: "Pitch Angle", type: "number", unit: "°", placeholder: "e.g. 35" },
      { key: "ridgeLengthM", label: "Ridge Length", type: "number", unit: "m", placeholder: "e.g. 8" },
      { key: "numChimneys", label: "No. of Chimneys", type: "number", placeholder: "0" },
      { key: "numSkylights", label: "No. of Skylights / Rooflights", type: "number", placeholder: "0" },
      {
        key: "gutteringCondition",
        label: "Guttering Condition",
        type: "select",
        options: ["good", "fair", "poor", "none"],
      },
      { key: "lastInspectedDate", label: "Last Inspected", type: "date" },
      { key: "roofingNotes", label: "Roofing Notes", type: "textarea", placeholder: "Access notes, special requirements…" },
    ],
  },
  {
    slug: "electrical",
    label: "Electrical",
    fields: [
      {
        key: "consumerUnitType",
        label: "Consumer Unit Type",
        type: "select",
        options: ["old fuse board", "MCB only", "RCBO", "split-load RCBO", "dual RCD"],
      },
      {
        key: "phase",
        label: "Supply Phase",
        type: "select",
        options: ["single-phase (230V)", "three-phase (400V)"],
      },
      {
        key: "meterType",
        label: "Meter Type",
        type: "select",
        options: ["smart (SMETS2)", "smart (SMETS1)", "digital", "dial", "prepayment"],
      },
      { key: "eicrDate", label: "EICR Date", type: "date" },
      { key: "eicrCertNumber", label: "EICR Certificate No.", type: "text", placeholder: "e.g. EIC-2024-00123" },
      { key: "numCircuits", label: "No. of Circuits", type: "number", placeholder: "e.g. 16" },
      { key: "solarPvInstalled", label: "Solar PV Installed", type: "boolean" },
      { key: "evChargerInstalled", label: "EV Charger Installed", type: "boolean" },
      { key: "emergencyLightingFitted", label: "Emergency Lighting Fitted", type: "boolean" },
      { key: "electricalNotes", label: "Electrical Notes", type: "textarea", placeholder: "Access notes, special conditions…" },
    ],
  },
  {
    slug: "plumbing",
    label: "Plumbing",
    fields: [
      {
        key: "boilerType",
        label: "Boiler Type",
        type: "select",
        options: ["combi", "system", "conventional (regular)", "heat-only", "back boiler", "electric", "none"],
      },
      { key: "boilerMake", label: "Boiler Make / Model", type: "text", placeholder: "e.g. Vaillant ecoTEC" },
      { key: "boilerModelYear", label: "Boiler Install Year", type: "number", placeholder: "e.g. 2018" },
      { key: "lastServiceDate", label: "Last Gas Service Date", type: "date" },
      { key: "gasServiceCertNumber", label: "Gas Service Cert No.", type: "text", placeholder: "e.g. CP12-2024-00456" },
      { key: "waterPressureBar", label: "Water Pressure", type: "number", unit: "bar", placeholder: "e.g. 1.5" },
      {
        key: "pipeMaterial",
        label: "Pipe Material",
        type: "select",
        options: ["copper", "plastic (polybutylene)", "plastic (PEX)", "lead", "galvanised steel", "mixed"],
      },
      { key: "hotWaterCylinder", label: "Hot Water Cylinder Present", type: "boolean" },
      { key: "waterSoftenerInstalled", label: "Water Softener Installed", type: "boolean" },
      { key: "stopcockLocation", label: "Stopcock Location", type: "text", placeholder: "e.g. under kitchen sink" },
      { key: "plumbingNotes", label: "Plumbing Notes", type: "textarea", placeholder: "Access notes, known issues…" },
    ],
  },
  {
    slug: "hvac",
    label: "HVAC",
    fields: [
      {
        key: "systemType",
        label: "System Type",
        type: "select",
        options: ["split unit", "multi-split", "ducted (air handling unit)", "chiller", "VRF/VRV", "MVHR", "fan coil", "heat pump (ASHP)", "heat pump (GSHP)"],
      },
      {
        key: "refrigerantType",
        label: "Refrigerant Type",
        type: "select",
        options: ["R32", "R410A", "R22 (legacy)", "R407C", "R134a", "R290 (propane)", "R600a", "N/A"],
      },
      { key: "systemAgeYears", label: "System Age", type: "number", unit: "years", placeholder: "e.g. 5" },
      { key: "lastServiceDate", label: "Last Service Date", type: "date" },
      { key: "fGasCertNumber", label: "F-Gas Certificate No.", type: "text", placeholder: "e.g. FGC-2024-00789" },
      { key: "coAlarmFitted", label: "CO Alarm Fitted", type: "boolean" },
      {
        key: "ventilationType",
        label: "Ventilation Type",
        type: "select",
        options: ["MVHR (mechanical ventilation heat recovery)", "MEV (mechanical extract)", "positive pressure", "natural/trickle vents", "none"],
      },
      { key: "hvacNotes", label: "HVAC Notes", type: "textarea", placeholder: "Access notes, special requirements…" },
    ],
  },
  {
    slug: "general-building",
    label: "General Building",
    fields: [
      {
        key: "propertyType",
        label: "Property Type",
        type: "select",
        options: ["detached", "semi-detached", "terraced", "end-of-terrace", "flat / apartment", "bungalow", "barn conversion", "commercial", "industrial"],
      },
      { key: "buildYear", label: "Build Year", type: "number", placeholder: "e.g. 1962" },
      { key: "listedBuilding", label: "Listed Building", type: "boolean" },
      {
        key: "listedGrade",
        label: "Listed Grade",
        type: "select",
        options: ["Grade I", "Grade II*", "Grade II", "Category A (Scotland)", "Category B (Scotland)", "not listed"],
      },
      {
        key: "wallType",
        label: "Wall Construction",
        type: "select",
        options: ["cavity brick", "solid brick", "solid stone", "timber frame", "steel frame", "ICF (insulated concrete form)", "unknown"],
      },
      {
        key: "insulationType",
        label: "Insulation Type",
        type: "select",
        options: ["cavity fill", "external wall insulation (EWI)", "internal wall insulation (IWI)", "both (EWI + IWI)", "none", "unknown"],
      },
      { key: "plotSizeM2", label: "Plot Size", type: "number", unit: "m²", placeholder: "e.g. 450" },
      { key: "planningRef", label: "Planning Reference", type: "text", placeholder: "e.g. 24/00123/FUL" },
      { key: "buildingNotes", label: "Building Notes", type: "textarea", placeholder: "Access notes, special requirements…" },
    ],
  },
  {
    slug: "carpentry",
    label: "Carpentry & Joinery",
    fields: [
      {
        key: "woodType",
        label: "Timber Type",
        type: "select",
        options: ["hardwood (oak)", "hardwood (ash)", "hardwood (walnut)", "softwood (pine)", "softwood (spruce)", "engineered timber", "MDF", "OSB", "bamboo", "mixed"],
      },
      {
        key: "finish",
        label: "Preferred Finish",
        type: "select",
        options: ["paint", "varnish", "Danish oil", "hard wax oil", "beeswax", "lacquer", "stain", "raw/untreated", "other"],
      },
      {
        key: "projectType",
        label: "Project Type",
        type: "select",
        options: ["bespoke furniture", "doors", "windows", "fitted wardrobes", "kitchen fitting", "flooring", "stairs & balustrades", "structural timber", "restoration", "other"],
      },
      {
        key: "fireDoorRating",
        label: "Fire Door Requirement",
        type: "select",
        options: ["FD30", "FD60", "FD90", "not applicable"],
      },
      { key: "treatedTimber", label: "Treated / Preserved Timber Required", type: "boolean" },
      { key: "carpentryNotes", label: "Carpentry Notes", type: "textarea", placeholder: "Dimensions, special requirements…" },
    ],
  },
  {
    slug: "painting-decorating",
    label: "Painting & Decorating",
    fields: [
      {
        key: "propertyType",
        label: "Property Type",
        type: "select",
        options: ["residential", "commercial", "industrial", "listed / heritage"],
      },
      {
        key: "scope",
        label: "Scope of Work",
        type: "select",
        options: ["interior only", "exterior only", "interior + exterior"],
      },
      { key: "numberOfRooms", label: "No. of Rooms / Areas", type: "number", placeholder: "e.g. 6" },
      {
        key: "wallCondition",
        label: "Wall Condition",
        type: "select",
        options: ["good — ready to paint", "fair — minor prep needed", "poor — significant prep needed", "bare plaster / new build"],
      },
      { key: "ceilingHeightM", label: "Ceiling Height", type: "number", unit: "m", placeholder: "e.g. 2.4" },
      {
        key: "specialistFinish",
        label: "Specialist Finish",
        type: "select",
        options: ["none", "venetian plaster", "limewash", "marmorino", "metallic / gilded", "faux finish", "murals"],
      },
      { key: "leadPaintPresent", label: "Lead Paint Present (pre-1980 property)", type: "boolean" },
      { key: "paintingNotes", label: "Decorating Notes", type: "textarea", placeholder: "Colour preferences, access notes…" },
    ],
  },
  {
    slug: "landscaping",
    label: "Landscaping",
    fields: [
      { key: "gardenSizeM2", label: "Garden Size", type: "number", unit: "m²", placeholder: "e.g. 200" },
      {
        key: "soilType",
        label: "Soil Type",
        type: "select",
        options: ["clay", "sandy", "loam", "chalk", "peat", "silt", "unknown"],
      },
      { key: "irrigationSystem", label: "Irrigation System Present", type: "boolean" },
      {
        key: "lawnType",
        label: "Lawn Type",
        type: "select",
        options: ["natural grass", "artificial turf", "wildflower meadow", "none"],
      },
      { key: "existingTrees", label: "Trees / Hedges Present", type: "boolean" },
      { key: "pavingOrDecking", label: "Paving / Decking Present", type: "boolean" },
      { key: "waterFeature", label: "Water Feature Present", type: "boolean" },
      { key: "drainageIssues", label: "Known Drainage Issues", type: "boolean" },
      { key: "landscapingNotes", label: "Landscaping Notes", type: "textarea", placeholder: "Access notes, planting preferences…" },
    ],
  },
  {
    slug: "tiling",
    label: "Tiling",
    fields: [
      { key: "tileAreaM2", label: "Tile Area", type: "number", unit: "m²", placeholder: "e.g. 30" },
      {
        key: "tileType",
        label: "Tile Type",
        type: "select",
        options: ["ceramic", "porcelain", "natural stone (marble)", "natural stone (travertine)", "natural stone (slate)", "mosaic", "encaustic / cement", "glass", "terracotta"],
      },
      {
        key: "substrate",
        label: "Substrate / Background",
        type: "select",
        options: ["concrete screed", "timber floor (with decoupling mat)", "cement board / Hardiebacker", "plasterboard (non-wet area)", "existing tiles (over-tile)", "other"],
      },
      { key: "underfloorHeating", label: "Underfloor Heating Present", type: "boolean" },
      { key: "wetRoom", label: "Wet Room / Level-Access Shower", type: "boolean" },
      { key: "existingTilesToRemove", label: "Existing Tiles to Remove", type: "boolean" },
      { key: "groutColour", label: "Preferred Grout Colour", type: "text", placeholder: "e.g. Mapei Kerapoxy Silver Grey" },
      { key: "tilingNotes", label: "Tiling Notes", type: "textarea", placeholder: "Pattern, layout, special requirements…" },
    ],
  },
  {
    slug: "glazing",
    label: "Glazing",
    fields: [
      { key: "windowCount", label: "No. of Window Units", type: "number", placeholder: "e.g. 14" },
      {
        key: "frameMaterial",
        label: "Frame Material",
        type: "select",
        options: ["uPVC", "timber (painted)", "timber (stained)", "aluminium (powder coated)", "composite", "steel"],
      },
      {
        key: "glazingType",
        label: "Glazing Type",
        type: "select",
        options: ["single glazed", "double glazed", "triple glazed", "vacuum glazed", "laminated / safety"],
      },
      { key: "hasDoorUnits", label: "Includes Door Units", type: "boolean" },
      {
        key: "conservatoryType",
        label: "Conservatory Type",
        type: "select",
        options: ["none", "lean-to", "Victorian", "Edwardian", "P-shape", "T-shape", "gable-end", "bespoke orangery"],
      },
      {
        key: "energyRating",
        label: "Window Energy Rating (WER)",
        type: "select",
        options: ["A++ (best)", "A+", "A", "B", "C", "D", "not rated"],
      },
      { key: "securityGlazing", label: "Security / Laminated Glazing Required", type: "boolean" },
      { key: "glazingNotes", label: "Glazing Notes", type: "textarea", placeholder: "Colour, hardware finish, special requirements…" },
    ],
  },
];

export function getActivePlugins(tradeSlugs: string[]): TradePlugin[] {
  return TRADE_PLUGINS.filter((p) => tradeSlugs.includes(p.slug));
}
