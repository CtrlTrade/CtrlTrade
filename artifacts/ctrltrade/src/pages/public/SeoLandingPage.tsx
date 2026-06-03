import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface SeoLandingConfig {
  badge: string;
  headline: string;
  subheadline: string;
  intro: string;
  features: { title: string; desc: string }[];
  useCases: string[];
  ctaLabel?: string;
}

const configs: Record<string, SeoLandingConfig> = {
  "roofing-crm": {
    badge: "ROOFING CRM",
    headline: "CRM Software For Roofing Contractors",
    subheadline: "Manage roof surveys, flat roof quotes, height safety records, and before/after photos — all in one platform.",
    intro: "CtrlTrade® is built for roofing contractors who need more than a generic CRM. From flat roof surveys to pitched roof repairs and commercial re-roofing projects — every job type, compliance record, and customer detail is managed in one place.",
    features: [
      { title: "Roof Surveys", desc: "Digital survey forms with photo capture, condition ratings, and scope of works — sent directly to the customer for approval." },
      { title: "Flat Roof Quotes", desc: "Pre-loaded materials lists for felt, single-ply, and liquid roofing systems. Quote in minutes, not hours." },
      { title: "Height Safety Records", desc: "Log MEWP certificates, scaffold inspection records, and operative height-safety training — all attached to the job." },
      { title: "Before / After Photos", desc: "Capture, annotate, and upload site photos directly from the field app. Automatically attached to the customer record." },
      { title: "Compliance & RAMS", desc: "Built-in method statement and risk assessment templates for roofing operations. Digital sign-off by site supervisors." },
      { title: "Job Scheduling", desc: "Drag-and-drop calendar with crew availability, equipment booking, and access requirements per job." },
    ],
    useCases: ["Flat roofing", "Pitched roofing", "Commercial re-roofing", "Roof repairs", "Guttering and fascias", "Lead work and flashing"],
  },
  "electrical-crm": {
    badge: "ELECTRICAL CRM",
    headline: "CRM Software For Electrical Contractors",
    subheadline: "Manage EICRs, EV charger installations, NICEIC compliance, and electrical job workflows in one platform.",
    intro: "CtrlTrade® is purpose-built for electrical contractors — from domestic rewires to commercial installation projects. Manage compliance certificates, engineer scheduling, and customer invoicing without switching between five different apps.",
    features: [
      { title: "EICR Management", desc: "Issue EICR certificates from the field app. Schedule periodic inspection and testing visits with automated reminders." },
      { title: "EV Charger Installations", desc: "Dedicated job type for OZEV-registered installers. Log vehicle and charger specs, grant amounts, and installation photos." },
      { title: "NICEIC Compliance Forms", desc: "Built-in digital forms for minor works certificates, installation certificates, and condition reports." },
      { title: "Test Results & Certificates", desc: "Store and share test results and completion certificates with customers via the portal." },
      { title: "Engineer Scheduling", desc: "Manage multiple engineers across domestic, commercial, and industrial sites with qualification-based assignment." },
      { title: "Invoicing & VAT", desc: "Generate and send professional invoices with correct VAT treatment for domestic and commercial customers." },
    ],
    useCases: ["Domestic rewires", "Commercial installations", "EICR testing", "EV charging", "Emergency lighting", "Fire alarm systems"],
  },
  "plumbing-crm": {
    badge: "PLUMBING CRM",
    headline: "CRM Software For Plumbing Contractors",
    subheadline: "Manage boiler servicing, gas safety records, leak repairs, and plumbing job scheduling in one platform.",
    intro: "CtrlTrade® is built for plumbing and heating contractors who need gas safety compliance, service scheduling, and emergency callout management — all in one system that connects your office to your engineers in the field.",
    features: [
      { title: "Boiler Servicing", desc: "Recurring service schedules with automated reminders to customers. Digital service records with Gas Safe reference numbers." },
      { title: "Gas Safety Certificates", desc: "Issue Landlord Gas Safety Records (CP12) and domestic gas safety certificates directly from the field app." },
      { title: "Leak Repair Jobs", desc: "Emergency callout management with engineer dispatch, ETA notifications to customers, and job completion sign-off." },
      { title: "Service Contracts", desc: "Sell and manage annual service contracts. Track renewal dates, service history, and contract profitability." },
      { title: "Parts & Materials", desc: "Log parts used on each job. Link to supplier orders for restock. View material costs vs. quoted." },
      { title: "Compliance Records", desc: "Gas Safe registration, operative cards, and insurance documents stored against each engineer profile." },
    ],
    useCases: ["Boiler installations", "Gas safety records", "Leak repairs", "Bathroom fitting", "Central heating", "Commercial plumbing"],
  },
  "hvac-crm": {
    badge: "HVAC CRM",
    headline: "CRM Software For HVAC Contractors",
    subheadline: "Manage HVAC installations, maintenance contracts, refrigeration compliance, and engineer scheduling in one platform.",
    intro: "CtrlTrade® is built for HVAC contractors handling commercial air conditioning, refrigeration, ventilation, and heating systems. Manage F-Gas compliance, service contracts, and complex multi-site operations from one platform.",
    features: [
      { title: "F-Gas Compliance", desc: "Log refrigerant types, quantities, and leak testing records. F-Gas certificates stored against each system." },
      { title: "Maintenance Contracts", desc: "Schedule and track quarterly, bi-annual, and annual maintenance visits across multiple client sites." },
      { title: "Commissioning Records", desc: "Digital commissioning sheets for HVAC and refrigeration systems. Customer sign-off via the portal." },
      { title: "Multi-Site Management", desc: "Manage multiple client sites, each with their own equipment register, service history, and engineer allocation." },
      { title: "Equipment Register", desc: "Asset tracking for each installation — make, model, serial number, warranty, and service history." },
      { title: "Engineer Scheduling", desc: "Manage engineers with specialist certifications across commercial and industrial client sites." },
    ],
    useCases: ["Air conditioning", "Commercial refrigeration", "Ventilation systems", "Heat pumps", "Chillers", "Building management systems"],
  },
  "builders-crm": {
    badge: "BUILDING & CONSTRUCTION CRM",
    headline: "CRM Software For Builders And Construction Companies",
    subheadline: "Manage building projects, subcontractors, compliance, and customer communications in one platform.",
    intro: "CtrlTrade® is built for builders and construction companies managing complex projects with multiple subcontractors, extended timelines, and strict compliance requirements. From loft conversions to commercial builds — every job is managed end to end.",
    features: [
      { title: "Project Management", desc: "Break large jobs into phases, stages, and tasks. Assign to subcontractors or direct labour with clear accountability." },
      { title: "Subcontractor Management", desc: "Manage your subcontractor network in the CtrlTrade Marketplace. Invite, assign, and invoice subcontractors." },
      { title: "Building Regs Compliance", desc: "Log building regulations applications, inspections, and completion certificates against each project." },
      { title: "Cost Tracking", desc: "Track materials, labour, and subcontractor costs against quoted budget. View profitability in real time." },
      { title: "Site Photos & Documentation", desc: "Capture and log site progress photos, inspection records, and snagging lists from the field app." },
      { title: "Customer Portal", desc: "Keep clients informed with live job progress, document sharing, and payment collection via the portal." },
    ],
    useCases: ["Loft conversions", "Extensions", "New builds", "Commercial fit-out", "Refurbishments", "Social housing"],
  },
  "cleaning-crm": {
    badge: "CLEANING CRM",
    headline: "CRM Software For Cleaning Contractors",
    subheadline: "Manage recurring cleaning contracts, staff rotas, and compliance records in one platform.",
    intro: "CtrlTrade® is built for commercial and domestic cleaning contractors who need recurring job scheduling, staff management, and compliance documentation — all in one system that grows with your cleaning business.",
    features: [
      { title: "Recurring Contracts", desc: "Set up daily, weekly, or monthly cleaning contracts with automated scheduling and staff assignment." },
      { title: "Staff Rostering", desc: "Plan and manage staff rotas across multiple sites. Track hours, absences, and overtime in the timesheet module." },
      { title: "COSHH Records", desc: "Log chemical and cleaning product records for COSHH compliance. Digital MSDS storage per site." },
      { title: "Site-Specific Instructions", desc: "Store access codes, client contact details, and special instructions against each cleaning site." },
      { title: "Quality Inspections", desc: "Digital quality inspection forms with photo capture. Email reports directly to the client." },
      { title: "Invoicing", desc: "Recurring invoice automation for contract clients. Late payment chasing and online payment collection." },
    ],
    useCases: ["Office cleaning", "Industrial cleaning", "End of tenancy", "Window cleaning", "Specialist cleaning", "Facilities management"],
  },
  "facilities-management-crm": {
    badge: "FACILITIES MANAGEMENT",
    headline: "Software For Facilities Management Companies",
    subheadline: "Manage planned maintenance, reactive callouts, compliance, and multi-trade operations in one platform.",
    intro: "CtrlTrade® is built for facilities management companies managing planned preventive maintenance (PPM), reactive works, and compliance across multiple client sites with multi-trade engineer teams.",
    features: [
      { title: "PPM Scheduling", desc: "Plan and track preventive maintenance visits across client sites. Automated scheduling with engineer assignment." },
      { title: "Reactive Callout Management", desc: "Log, assign, and track reactive maintenance callouts with SLA-based prioritisation and customer ETA notifications." },
      { title: "Compliance Tracking", desc: "Track gas safety, electrical testing, fire alarm servicing, and all statutory compliance across your client portfolio." },
      { title: "Asset Register", desc: "Maintain a live asset register per site — linked to service history, warranty data, and next inspection dates." },
      { title: "Multi-Trade Dispatch", desc: "Allocate jobs to the right engineer based on trade qualification, availability, and site location." },
      { title: "Client Reporting", desc: "Automated compliance and activity reports delivered to client contacts on your schedule." },
    ],
    useCases: ["Planned maintenance", "Reactive works", "Compliance management", "Multi-site clients", "Hard FM", "Soft FM"],
  },
  "trade-counter-epos": {
    badge: "TRADE COUNTER EPOS",
    headline: "EPOS Software For Trade Counters",
    subheadline: "A complete EPOS system for trade counters — barcode scanning, trade accounts, stock control, and receipt printing.",
    intro: "CtrlTradePos® is the only EPOS system built specifically for trade counters. It connects your till directly to your stock, customer trade accounts, supplier orders, and CRM — in real time.",
    features: [
      { title: "Barcode Scanning", desc: "Scan EAN/UPC barcodes to add products to the cart instantly. Compatible with all standard barcode scanner hardware." },
      { title: "Trade Account Billing", desc: "Bill customers to their trade account. Set credit limits, view statements, and collect payment from the CRM." },
      { title: "Stock Control", desc: "Real-time stock deduction on every sale. Low-stock alerts, stocktake tools, and direct supplier ordering." },
      { title: "Receipt Printing", desc: "Thermal and network receipt printers. Print or email receipts. Branded with your company details." },
      { title: "Till Sessions", desc: "Open with a cash float, close with a reconciliation count. End-of-day report with full transaction breakdown." },
      { title: "Offline Mode", desc: "Keep selling during internet outages. Transactions sync automatically when connectivity is restored." },
    ],
    useCases: ["Builders merchants", "Electrical wholesalers", "Plumbing supplies", "Roofing suppliers", "Tool hire", "Industrial supplies"],
  },
  "warehouse-management-software": {
    badge: "WAREHOUSE MANAGEMENT",
    headline: "Warehouse Management Software For Trade Suppliers",
    subheadline: "Manage stock, goods in/out, picking, packing, and supplier orders — fully integrated with your CRM and trade counter till.",
    intro: "CtrlTrade® includes a warehouse management module that connects directly to your trade counter EPOS, CRM, and supplier orders — giving you a single system for your entire trade supply operation.",
    features: [
      { title: "Stock Management", desc: "Real-time stock levels across one or multiple warehouse locations. Min/max reorder rules with automated supplier order creation." },
      { title: "Goods In / Out", desc: "Receive supplier deliveries against purchase orders. Log stock movements with full audit trail." },
      { title: "Pick & Pack", desc: "Generate pick lists from customer orders or trade counter sales. Pack and dispatch with confirmation." },
      { title: "Stock Transfers", desc: "Move stock between branches, warehouses, and vehicles. Full movement history per SKU." },
      { title: "Supplier Orders", desc: "Raise and manage purchase orders directly from the platform. Receive against POs and update stock automatically." },
      { title: "Barcode Integration", desc: "Barcode scan goods in and out. Works with standard USB and wireless barcode scanners." },
    ],
    useCases: ["Trade suppliers", "Builders merchants", "Electrical wholesale", "Plumbing wholesale", "Distribution", "Multi-branch stock"],
  },
  "showroom-management-software": {
    badge: "SHOWROOM MANAGEMENT",
    headline: "Software For Trade Showrooms",
    subheadline: "Manage product display, customer consultations, quote building, and deposit collection — in one platform for trade showrooms.",
    intro: "CtrlTrade® is built for trade showrooms that need to manage customer appointments, product demonstrations, quote preparation, and payment collection — all connected to their CRM, stock, and supplier orders.",
    features: [
      { title: "Customer Appointments", desc: "Book, manage, and track showroom appointments. Send automated reminders to customers." },
      { title: "Product Showcase", desc: "Browse your product catalogue on the showroom floor. Search, filter, and display product details and pricing." },
      { title: "Quote Building", desc: "Build quotes on the showroom floor with the customer. Add products, labour, and delivery. Send for approval via the portal." },
      { title: "Deposit Collection", desc: "Collect deposits on quote acceptance via card payment or the customer portal." },
      { title: "Trade Accounts", desc: "Trade account customers can view their account balance, statement, and outstanding orders from the portal." },
      { title: "CRM Integration", desc: "Every showroom visitor is a lead in the CRM. Track conversion from appointment to sale to job." },
    ],
    useCases: ["Kitchen and bathroom showrooms", "Tile showrooms", "Flooring showrooms", "Lighting showrooms", "Heating and plumbing", "Trade suppliers"],
  },
  "field-service-management-software": {
    badge: "FIELD SERVICE MANAGEMENT",
    headline: "Field Service Management Software For Trade Businesses",
    subheadline: "Schedule engineers, dispatch jobs, capture compliance records, and invoice customers — all in one field service platform.",
    intro: "CtrlTrade® is a complete field service management platform for trade businesses with engineers in the field. Manage the full job lifecycle from lead to invoice — with a mobile app for your engineers and a web platform for your office team.",
    features: [
      { title: "Engineer Scheduling", desc: "Drag-and-drop dispatch board with engineer availability, skill-based assignment, and route optimisation." },
      { title: "Mobile Field App", desc: "Engineers access their jobs, record compliance data, capture photos, and complete sign-off from the mobile app." },
      { title: "GPS & Fleet Tracking", desc: "See live engineer locations on a map. Log vehicle mileage, MOT dates, and service records." },
      { title: "Compliance & Safety", desc: "Built-in risk assessment, RAMS, and method statement tools. Digital sign-off from the field." },
      { title: "Job-to-Invoice", desc: "Convert completed jobs to invoices instantly. Collect payment via the customer portal." },
      { title: "Timesheets", desc: "Engineers log hours directly from the app. Timesheet reports export for payroll." },
    ],
    useCases: ["Heating engineers", "Electrical contractors", "Plumbing engineers", "HVAC technicians", "Facilities management", "Multi-trade contractors"],
  },
};

export function SeoLandingPage({ slug }: { slug: string }) {
  const config = configs[slug];
  if (!config) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <section className="py-24 md:py-32 relative overflow-hidden" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(hsl(46,98%,52%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container mx-auto px-4 max-w-4xl relative z-10">
          <div className="inline-block px-4 py-1 mb-8 border border-[hsl(46,98%,52%)] text-[hsl(46,98%,52%)] font-bold text-xs tracking-widest">
            {config.badge}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">{config.headline}</h1>
          <p className="text-lg md:text-xl mb-10 max-w-2xl" style={{ color: "hsl(220,25%,62%)" }}>{config.subheadline}</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/signup">
              <Button size="lg" className="rounded-xl h-14 px-8 text-base font-semibold w-full sm:w-auto">
                Start Free 1 Month Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="rounded-xl h-14 px-8 text-base font-semibold bg-transparent w-full sm:w-auto" style={{ borderColor: "hsla(215,30%,93%,0.4)", color: "hsl(215,30%,93%)" }}>
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <p className="text-lg text-muted-foreground leading-relaxed mb-12">{config.intro}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {config.features.map((f, i) => (
              <div key={i} className="border border-border bg-card p-6 hover:border-primary transition-colors">
                <h3 className="font-bold mb-2 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  {f.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed pl-8">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-card border-t border-border">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold mb-6">Typical Use Cases</h2>
          <div className="flex flex-wrap gap-3">
            {config.useCases.map((uc, i) => (
              <span key={i} className="border border-border bg-background px-4 py-2 text-sm font-medium hover:border-primary transition-colors">
                {uc}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-background border-t border-border">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold mb-8">Everything Included</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              "CRM & Lead Management", "Quotes & E-signatures", "Job Management",
              "Engineer Scheduling", "Customer Portal", "Invoicing",
              "Compliance & RAMS", "Fleet Management", "Reporting",
              "Integrations (Xero, QuickBooks)", "AI Features", "VoIP & SMS",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24" style={{ background: "hsl(220,90%,8%)", color: "hsl(215,30%,93%)" }}>
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Start Your Free 1 Month Trial</h2>
          <p className="text-xl mb-10" style={{ color: "hsl(220,25%,62%)" }}>No credit card required during trial. Set up in minutes.</p>
          <Link href="/signup">
            <Button size="lg" className="rounded-xl h-14 px-10 text-base font-bold">
              {config.ctaLabel ?? "Start Free 1 Month Trial"} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
