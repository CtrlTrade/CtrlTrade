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
  "builders-merchants-crm": {
    badge: "BUILDERS MERCHANTS CRM",
    headline: "CRM & EPOS Software For Builders Merchants",
    subheadline: "Manage trade accounts, trade counter sales, stock control, and supplier orders — purpose-built for builders merchants.",
    intro: "CtrlTrade® is built for independent and regional builders merchants who need to run a trade counter, manage trade account customers, control stock across multiple locations, and keep supplier ordering efficient — all in one platform.",
    features: [
      { title: "Trade Account Management", desc: "Set credit limits, view statements, and collect payment from trade account customers. Full account history in the CRM." },
      { title: "Trade Counter EPOS", desc: "Fast barcode-scanning till with trade account billing, stock deduction, and receipt printing. Run CtrlTradePos® on any device." },
      { title: "Stock Control", desc: "Real-time stock levels across branches and warehouse locations. Min/max reorder rules and automated purchase orders." },
      { title: "Supplier Orders", desc: "Raise, manage, and receive purchase orders. Stock updates automatically on delivery." },
      { title: "Multi-Branch Management", desc: "Manage multiple trade counter locations from one platform. Branch-level stock, staff, and sales reporting." },
      { title: "Customer Invoicing", desc: "Generate trade invoices, statements, and credit notes. Integrate with Xero or QuickBooks for accounts." },
    ],
    useCases: ["Independent builders merchants", "Regional builders merchants", "National merchants", "Building supplies", "Trade distribution centres", "Multi-branch merchants"],
  },
  "masonry-crm": {
    badge: "MASONRY & BRICK CRM",
    headline: "CRM Software For Bricklayers, Masons & Masonry Suppliers",
    subheadline: "Manage masonry contracts, material supply, and project compliance in one platform.",
    intro: "CtrlTrade® is built for bricklayers, stone masons, and masonry material suppliers who need to manage project-based work, material quantities, and customer relationships — all in one system.",
    features: [
      { title: "Project-Based Quoting", desc: "Quote for brickwork, blockwork, and stone projects with material take-off quantities built in." },
      { title: "Material Tracking", desc: "Log brick, block, and mortar usage against each job. Track wastage and compare to quoted quantities." },
      { title: "Subcontractor Management", desc: "Manage bricklaying gangs and subcontracted labour. Assign jobs, track progress, and process payments." },
      { title: "Supplier Orders", desc: "Order materials directly from your supplier contacts. Receive against POs and update stock automatically." },
      { title: "Site Photo Records", desc: "Capture and log progress photos, inspection records, and snagging lists from the field app." },
      { title: "Customer Invoicing", desc: "Stage payments, retentions, and final account invoicing. Collect payment via the customer portal." },
    ],
    useCases: ["Bricklayers", "Stone masons", "Brick merchants", "Block suppliers", "Masonry suppliers", "Restoration masons"],
  },
  "timber-merchants-crm": {
    badge: "TIMBER MERCHANTS CRM",
    headline: "CRM & Trade Counter Software For Timber Merchants",
    subheadline: "Manage timber trade accounts, stock, trade counter sales, and supplier orders in one platform.",
    intro: "CtrlTrade® is built for timber merchants and sheet material suppliers who need a trade counter EPOS, stock control across multiple locations, trade account management, and efficient supplier ordering — all connected in one system.",
    features: [
      { title: "Trade Counter EPOS", desc: "Scan timber and sheet material SKUs at the counter. Bill to trade accounts or take card payment. Print or email receipts." },
      { title: "Stock Management", desc: "Manage stock levels for timber, sheet materials, and engineered products. Min/max reorder rules with automated purchase orders." },
      { title: "Trade Accounts", desc: "Set credit limits, view statements, and manage account payments for your trade customers." },
      { title: "Supplier Orders", desc: "Raise purchase orders directly to your timber suppliers. Receive deliveries and update stock automatically." },
      { title: "Cut-to-Size Quoting", desc: "Quote for bespoke lengths and cuts. Log cutting notes on the job for the yard team." },
      { title: "Multi-Branch Stock", desc: "View and transfer stock across multiple yard locations. Branch-level reporting and stock control." },
    ],
    useCases: ["Timber merchants", "Timber yards", "Hardwood suppliers", "Softwood suppliers", "Sheet material suppliers", "Timber importers"],
  },
  "heating-gas-crm": {
    badge: "HEATING & GAS CRM",
    headline: "CRM Software For Heating Engineers & Gas Contractors",
    subheadline: "Manage boiler installations, gas safety records, service contracts, and heating merchant operations in one platform.",
    intro: "CtrlTrade® is built for heating engineers, gas contractors, and heating merchants who need gas safety compliance, recurring service contract management, and engineer scheduling — all connected from office to field.",
    features: [
      { title: "Gas Safety Certificates", desc: "Issue Landlord Gas Safety Records (CP12) and domestic gas safety certificates from the field app. Gas Safe reference logging." },
      { title: "Boiler Servicing", desc: "Recurring service schedules with automated reminders. Digital service records with full job history per boiler." },
      { title: "Service Contracts", desc: "Sell and manage annual boiler and heating service contracts. Track renewals and contract profitability." },
      { title: "Heat Pump Installations", desc: "Job type templates for air source and ground source heat pump installations. MCS compliance records built in." },
      { title: "Merchant Trade Counter", desc: "Run a heating parts counter with CtrlTradePos®. Trade accounts, stock control, and supplier ordering included." },
      { title: "Engineer Scheduling", desc: "Dispatch heating engineers by Gas Safe registration, availability, and postcode. Route optimisation included." },
    ],
    useCases: ["Heating engineers", "Gas engineers", "Boiler installers", "Heating merchants", "Service contract providers", "Heat pump installers"],
  },
  "renewable-energy-crm": {
    badge: "RENEWABLE ENERGY CRM",
    headline: "CRM Software For Renewable Energy Installers",
    subheadline: "Manage solar, heat pump, battery, and EV charger installations with compliance and MCS records built in.",
    intro: "CtrlTrade® is built for renewable energy installers who need to manage MCS-certified installations, grant and subsidy tracking, technical compliance records, and customer communications — all in one platform.",
    features: [
      { title: "MCS Compliance Records", desc: "Log MCS certification details, system specifications, and installation certificates against each job." },
      { title: "Solar Installations", desc: "Manage solar PV and solar thermal installations. Log panel specs, inverter details, and generation data." },
      { title: "Heat Pump Installations", desc: "Air source and ground source heat pump job management with MCS and BUS grant documentation." },
      { title: "EV Charger Installations", desc: "OZEV-registered installer workflows. Log vehicle and charger specs, grant amounts, and OLEV forms." },
      { title: "Battery Storage", desc: "Battery storage installation records. Log battery specs, inverter integration, and warranty details." },
      { title: "Customer Portal", desc: "Share installation documentation, certificates, and energy performance data with customers via the portal." },
    ],
    useCases: ["Solar installers", "Heat pump installers", "EV charger installers", "Battery storage installers", "Renewable energy contractors", "MCS-certified businesses"],
  },
  "security-fire-crm": {
    badge: "SECURITY & FIRE CRM",
    headline: "CRM Software For Security & Fire Protection Contractors",
    subheadline: "Manage CCTV, alarm, fire protection, and access control installation and maintenance in one platform.",
    intro: "CtrlTrade® is built for security and fire protection contractors who need to manage installation projects, recurring maintenance contracts, compliance documentation, and customer service agreements — all in one system.",
    features: [
      { title: "Installation Projects", desc: "Manage CCTV, alarm, access control, and fire alarm installation projects. Stage payments and snagging built in." },
      { title: "Maintenance Contracts", desc: "Schedule and track annual and bi-annual maintenance visits for your contracted customer base." },
      { title: "Compliance Documentation", desc: "Log NSI/SSAIB certification numbers, system specifications, and handover documents against each installation." },
      { title: "Reactive Callouts", desc: "Manage reactive fault and alarm callouts with SLA-based prioritisation and engineer dispatch." },
      { title: "Equipment Register", desc: "Asset tracking for each installed system — make, model, serial number, warranty, and service history." },
      { title: "Customer Portal", desc: "Provide customers with access to their system documentation, service history, and upcoming maintenance visits." },
    ],
    useCases: ["CCTV installers", "Alarm installers", "Access control contractors", "Fire alarm installers", "Fire equipment suppliers", "Security contractors"],
  },
  "windows-doors-crm": {
    badge: "WINDOWS & DOORS CRM",
    headline: "CRM Software For Window, Door & Conservatory Businesses",
    subheadline: "Manage surveys, quotes, installations, and aftersales for window, door, and conservatory companies.",
    intro: "CtrlTrade® is built for window, door, and conservatory businesses who need to manage the full sales cycle — from lead and survey to quote, installation scheduling, and aftersales — all in one connected platform.",
    features: [
      { title: "Survey Management", desc: "Schedule and record customer surveys with measurement notes, product selections, and photo capture." },
      { title: "Quote Building", desc: "Build detailed quotes for windows, doors, conservatories, and orangeries. Send for e-signature via the customer portal." },
      { title: "Installation Scheduling", desc: "Schedule installation crews by job type, location, and availability. Customer ETA notifications included." },
      { title: "Aftersales & Snagging", desc: "Manage aftersales visits, snagging lists, and warranty claims. Track resolution against each job." },
      { title: "Manufacturer Orders", desc: "Place orders with your window and door manufacturer from the platform. Link to jobs for delivery tracking." },
      { title: "Customer Portal", desc: "Customers can approve quotes, track installation progress, and access warranty documents via the portal." },
    ],
    useCases: ["Window installers", "Door installers", "Conservatory installers", "Double glazing companies", "Window manufacturers", "Glass merchants"],
  },
  "kitchens-crm": {
    badge: "KITCHENS CRM",
    headline: "CRM Software For Kitchen Showrooms & Suppliers",
    subheadline: "Manage kitchen design consultations, quotes, supplier orders, and installations in one platform.",
    intro: "CtrlTrade® is built for kitchen showrooms, suppliers, and kitchen installation businesses who need to manage the full customer journey — from showroom appointment to design approval, order placement, and installation — all in one system.",
    features: [
      { title: "Showroom Appointments", desc: "Book and manage customer design consultations. Track pipeline from enquiry to signed order." },
      { title: "Kitchen Quoting", desc: "Build detailed kitchen quotes with product selections, worktops, appliances, and fitting costs." },
      { title: "Design Approval", desc: "Share kitchen designs and 3D renders with customers via the portal. Collect e-signature on approval." },
      { title: "Supplier Ordering", desc: "Place kitchen unit and worktop orders with suppliers. Track delivery against installation date." },
      { title: "Installation Scheduling", desc: "Schedule kitchen fitters and manage multi-day installation projects. Snagging and handover sign-off built in." },
      { title: "Deposit & Stage Payments", desc: "Collect deposits, mid-order payments, and final balances via the customer portal." },
    ],
    useCases: ["Kitchen showrooms", "Kitchen suppliers", "Kitchen installers", "Kitchen designers", "Kitchen manufacturers", "Fitted kitchen companies"],
  },
  "bathrooms-crm": {
    badge: "BATHROOMS CRM",
    headline: "CRM Software For Bathroom Showrooms & Suppliers",
    subheadline: "Manage bathroom design consultations, quotes, supplier orders, and installations in one platform.",
    intro: "CtrlTrade® is built for bathroom showrooms, bathroom suppliers, and fitting companies who need to manage design consultations, product orders, installation scheduling, and customer communications — all in one connected platform.",
    features: [
      { title: "Showroom Appointments", desc: "Book and manage customer design consultations. Log product selections and preferences against each customer." },
      { title: "Bathroom Quoting", desc: "Build detailed bathroom quotes with sanitaryware, tiling, wetroom, and fitting costs." },
      { title: "Design Approval", desc: "Share bathroom designs with customers via the portal. Collect e-signature approval before ordering." },
      { title: "Supplier Ordering", desc: "Order sanitaryware, tiles, and accessories from your suppliers. Track deliveries against installation dates." },
      { title: "Installation Scheduling", desc: "Schedule bathroom fitters and manage installation projects. Snagging and handover sign-off included." },
      { title: "Deposit & Stage Payments", desc: "Collect deposits and stage payments online via the customer portal. Automated invoice generation." },
    ],
    useCases: ["Bathroom showrooms", "Bathroom suppliers", "Bathroom installers", "Bathroom designers", "Wetroom specialists", "Ensuite specialists"],
  },
  "flooring-crm": {
    badge: "FLOORING CRM",
    headline: "CRM Software For Flooring Suppliers & Contractors",
    subheadline: "Manage flooring surveys, quotes, supply and installation, and trade account customers in one platform.",
    intro: "CtrlTrade® is built for flooring showrooms, flooring suppliers, and flooring contractors who need to manage the full sales process — from customer enquiry and survey to supply ordering, installation scheduling, and invoicing.",
    features: [
      { title: "Survey & Measurement", desc: "Record room measurements, subfloor condition, and product selections during surveys. Generate quotes automatically." },
      { title: "Flooring Quotes", desc: "Quote for carpet, vinyl, laminate, hardwood, and resin flooring with material and fitting costs." },
      { title: "Showroom Management", desc: "Manage showroom appointments and walk-in customers. Track product selections and conversions." },
      { title: "Supplier Ordering", desc: "Order flooring materials from suppliers. Track deliveries against installation bookings." },
      { title: "Installation Scheduling", desc: "Schedule fitting teams by job type and location. Multi-day job management with sign-off." },
      { title: "Trade Counter", desc: "Run a trade counter for flooring contractors with CtrlTradePos®. Trade accounts and stock control included." },
    ],
    useCases: ["Flooring showrooms", "Flooring suppliers", "Carpet fitters", "Vinyl flooring specialists", "Hardwood flooring specialists", "Resin flooring contractors"],
  },
  "tiles-crm": {
    badge: "TILES CRM",
    headline: "CRM & Trade Counter Software For Tile Suppliers",
    subheadline: "Manage tile showroom sales, trade accounts, stock, and tiling contracts in one platform.",
    intro: "CtrlTrade® is built for tile centres, tile suppliers, and tiling contractors who need to manage showroom customers, trade account sales, stock levels, and installation projects — all in one connected platform.",
    features: [
      { title: "Showroom Sales", desc: "Manage walk-in and appointment customers. Log product selections, sample requests, and quotes." },
      { title: "Trade Counter EPOS", desc: "Run a trade counter for tiling contractors with CtrlTradePos®. Barcode scanning, trade accounts, and stock control." },
      { title: "Stock Management", desc: "Manage tile stock by collection, size, colour, and finish. Low-stock alerts and automated supplier orders." },
      { title: "Tiling Contracts", desc: "Manage tiling installation projects. Quote, schedule fitters, and collect payment via the customer portal." },
      { title: "Sample Management", desc: "Track sample requests and returns. Follow up with customers who have taken samples." },
      { title: "Supplier Orders", desc: "Order tiles direct from importers and distributors. Receive against POs and update stock automatically." },
    ],
    useCases: ["Tile centres", "Tile suppliers", "Tile warehouses", "Tile importers", "Tiling contractors", "Tile distributors"],
  },
  "decorating-crm": {
    badge: "DECORATING CRM",
    headline: "CRM Software For Decorating Contractors & Paint Suppliers",
    subheadline: "Manage painting and decorating jobs, material ordering, and customer relationships in one platform.",
    intro: "CtrlTrade® is built for decorating contractors and paint suppliers who need to manage job scheduling, material ordering, customer communications, and invoicing — without the admin overhead.",
    features: [
      { title: "Job Management", desc: "Manage domestic and commercial decorating jobs from quote to completion. Schedule painters and decorators by availability." },
      { title: "Quoting", desc: "Build detailed decorating quotes with labour, paint quantities, and materials. Send for customer approval via the portal." },
      { title: "Material Ordering", desc: "Order paint, wallpaper, and decorating materials from your supplier contacts. Link to jobs for cost tracking." },
      { title: "Trade Counter", desc: "Run a paint and decorating supplies counter with CtrlTradePos®. Trade accounts and stock control included." },
      { title: "Before / After Photos", desc: "Capture and share before and after photos with customers. Build a portfolio of completed work." },
      { title: "Invoicing", desc: "Generate and send invoices on job completion. Collect payment via the customer portal or card on site." },
    ],
    useCases: ["Painters", "Decorators", "Decorating contractors", "Paint suppliers", "Decorating centres", "Spray finishing specialists"],
  },
  "landscaping-crm": {
    badge: "LANDSCAPING CRM",
    headline: "CRM Software For Landscaping Contractors & Suppliers",
    subheadline: "Manage landscaping projects, recurring maintenance contracts, and material supply in one platform.",
    intro: "CtrlTrade® is built for landscaping contractors, garden designers, and outdoor material suppliers who need to manage one-off landscaping projects alongside recurring maintenance contracts — all in one connected platform.",
    features: [
      { title: "Project Quoting", desc: "Quote for landscaping, garden design, and outdoor living projects with material and labour costs." },
      { title: "Recurring Maintenance", desc: "Set up recurring garden maintenance and grounds contracts. Automated scheduling and invoicing." },
      { title: "Material Ordering", desc: "Order turf, paving, aggregates, plants, and materials from your suppliers. Link to jobs for delivery tracking." },
      { title: "Subcontractor Management", desc: "Manage subcontracted groundworks, tree surgery, and irrigation teams alongside your own crews." },
      { title: "Site Photos", desc: "Capture progress and completion photos from the field app. Share with customers via the portal." },
      { title: "Compliance Records", desc: "Log pesticide application records, COSHH compliance, and waste carrier licences against your business." },
    ],
    useCases: ["Landscapers", "Landscape contractors", "Garden designers", "Grounds maintenance companies", "Turf suppliers", "Outdoor living suppliers"],
  },
  "fencing-crm": {
    badge: "FENCING CRM",
    headline: "CRM Software For Fencing Contractors & Suppliers",
    subheadline: "Manage fencing installation projects, material supply, and trade account customers in one platform.",
    intro: "CtrlTrade® is built for fencing contractors, gate installers, and fencing material suppliers who need to manage installation projects, material stock, and trade account customers — all in one connected system.",
    features: [
      { title: "Project Quoting", desc: "Quote for fencing, gates, and security barrier projects with material take-off and installation costs." },
      { title: "Gate Automation", desc: "Manage gate automation installation and maintenance projects. Log system specs, remote programming, and service records." },
      { title: "Material Stock Control", desc: "Manage fencing panel, post, and gate stock. Min/max reorder rules with automated supplier orders." },
      { title: "Trade Counter", desc: "Run a trade counter for fencing contractors with CtrlTradePos®. Trade accounts, stock, and receipt printing." },
      { title: "Site Survey Records", desc: "Record survey notes, boundary measurements, and ground condition reports from the field app." },
      { title: "Invoicing", desc: "Stage payments for large projects. Collect deposits and final balances via the customer portal." },
    ],
    useCases: ["Fencing contractors", "Fencing suppliers", "Gate installers", "Gate manufacturers", "Security fencing specialists", "Agricultural fencing contractors"],
  },
  "steel-metal-crm": {
    badge: "STEEL & METAL CRM",
    headline: "CRM & Trade Counter Software For Steel & Metal Suppliers",
    subheadline: "Manage trade accounts, stock, trade counter sales, and customer orders for steel and metal suppliers.",
    intro: "CtrlTrade® is built for steel stockholders, metal merchants, and fabrication businesses who need to manage trade counter sales, trade account customers, stock levels, and supplier purchasing — all in one platform.",
    features: [
      { title: "Trade Counter EPOS", desc: "Run a steel and metal trade counter with CtrlTradePos®. Barcode scanning, trade account billing, and receipt printing." },
      { title: "Stock Management", desc: "Manage stock by profile, grade, size, and length. Min/max reorder rules and real-time stock levels." },
      { title: "Trade Accounts", desc: "Set credit limits, view statements, and collect payment from trade account customers." },
      { title: "Cut-to-Size Orders", desc: "Log cutting instructions and bespoke order requirements on each sales order." },
      { title: "Supplier Orders", desc: "Raise purchase orders to your steel suppliers and stockholders. Receive deliveries and update stock automatically." },
      { title: "Customer Invoicing", desc: "Generate invoices, statements, and credit notes. Integrate with Xero or QuickBooks for accounts." },
    ],
    useCases: ["Steel suppliers", "Steel fabricators", "Metal merchants", "Aluminium suppliers", "Sheet metal suppliers", "Structural steel companies"],
  },
  "industrial-supplies-crm": {
    badge: "INDUSTRIAL SUPPLIES CRM",
    headline: "CRM & Trade Counter Software For Industrial Distributors",
    subheadline: "Manage trade accounts, stock, trade counter sales, and supplier ordering for industrial supplies businesses.",
    intro: "CtrlTrade® is built for MRO distributors, industrial fastener suppliers, and engineering product distributors who need to manage trade counter operations, trade account customers, and complex stock catalogues — all in one platform.",
    features: [
      { title: "Trade Counter EPOS", desc: "Run a trade counter with CtrlTradePos®. Barcode scanning, trade account billing, and receipt printing." },
      { title: "Stock Management", desc: "Manage large SKU catalogues across multiple warehouse and counter locations. Min/max reorder automation." },
      { title: "Trade Accounts", desc: "Set credit limits, view statements, and manage account payments for your industrial trade customers." },
      { title: "Supplier Ordering", desc: "Raise purchase orders across multiple suppliers. Receive deliveries and update stock automatically." },
      { title: "Quote-to-Order", desc: "Build complex quotes for industrial projects. Convert to order and track through to delivery." },
      { title: "Multi-Branch", desc: "Manage stock and sales across multiple branch locations. Branch-level reporting and stock transfers." },
    ],
    useCases: ["MRO distributors", "Industrial fastener suppliers", "Hydraulics suppliers", "Pneumatics suppliers", "Bearing suppliers", "Industrial tools suppliers"],
  },
  "tools-equipment-crm": {
    badge: "TOOLS & EQUIPMENT CRM",
    headline: "CRM & Trade Counter Software For Tool Merchants & Hire Companies",
    subheadline: "Manage tool sales, hire, repairs, and trade account customers in one platform.",
    intro: "CtrlTrade® is built for tool merchants, tool hire companies, and equipment suppliers who need to manage trade counter sales, hire fleet management, repair workflows, and trade account customers — all in one platform.",
    features: [
      { title: "Trade Counter EPOS", desc: "Run a tool counter with CtrlTradePos®. Barcode scanning, trade accounts, and stock control." },
      { title: "Hire Fleet Management", desc: "Track your hire fleet by asset. Log hire out and returns, maintenance records, and availability." },
      { title: "Repair Workshops", desc: "Manage tool and equipment repair jobs. Log fault descriptions, parts used, and repair costs against each item." },
      { title: "Stock Management", desc: "Manage tool stock across counter and warehouse. Min/max reorder rules and automated purchase orders." },
      { title: "Trade Accounts", desc: "Set credit limits and manage account billing for trade customers. View statements and collect payment online." },
      { title: "Supplier Ordering", desc: "Raise purchase orders to tool and equipment suppliers. Receive and update stock automatically." },
    ],
    useCases: ["Tool merchants", "Tool hire companies", "Power tool suppliers", "Hand tool suppliers", "Equipment dealers", "Tool repair centres"],
  },
  "plant-machinery-crm": {
    badge: "PLANT & MACHINERY CRM",
    headline: "CRM Software For Plant Hire & Machinery Dealers",
    subheadline: "Manage plant hire fleet, machinery sales, maintenance, and customer accounts in one platform.",
    intro: "CtrlTrade® is built for plant hire companies, machinery dealers, and construction equipment suppliers who need to manage hire fleet availability, maintenance schedules, customer accounts, and equipment sales — all in one system.",
    features: [
      { title: "Hire Fleet Management", desc: "Track your plant hire fleet by asset. Log hire out, returns, damage, and availability in real time." },
      { title: "Machinery Sales", desc: "Manage new and used machinery sales. Quotes, trade-ins, and finance documentation in one place." },
      { title: "Maintenance Scheduling", desc: "Schedule servicing, inspections, and LOLER/PUWER examinations for each piece of plant." },
      { title: "Operator Certification", desc: "Log operator CPCS/NPORS certification details. Expiry tracking and renewal alerts." },
      { title: "Customer Hire Agreements", desc: "Digital hire agreements with e-signature. Damage excess and terms documented per booking." },
      { title: "Invoicing & Billing", desc: "Automated hire invoice generation. Daily, weekly, or long-term hire billing with account management." },
    ],
    useCases: ["Plant hire companies", "Machinery dealers", "Access equipment suppliers", "Generator suppliers", "Heavy equipment dealers", "Construction equipment hire"],
  },
  "workwear-ppe-crm": {
    badge: "WORKWEAR & PPE CRM",
    headline: "CRM & Trade Counter Software For Workwear & PPE Suppliers",
    subheadline: "Manage trade accounts, stock, embroidery orders, and bulk supply for workwear and PPE businesses.",
    intro: "CtrlTrade® is built for workwear suppliers, PPE distributors, and safety equipment providers who need to manage trade account customers, stock across multiple product lines, embroidery and personalisation orders, and bulk supply contracts.",
    features: [
      { title: "Trade Counter EPOS", desc: "Run a workwear and PPE trade counter with CtrlTradePos®. Barcode scanning and trade account billing." },
      { title: "Stock Management", desc: "Manage stock across sizes, colours, and product lines. Reorder rules and automated supplier purchasing." },
      { title: "Trade Accounts", desc: "Manage bulk supply accounts for construction companies, utilities, and facilities management clients." },
      { title: "Embroidery & Personalisation", desc: "Log embroidery, printing, and personalisation requirements on each garment order." },
      { title: "Supplier Ordering", desc: "Raise purchase orders to workwear and PPE suppliers. Receive and update stock automatically." },
      { title: "Compliance Tracking", desc: "Log PPE standards compliance (EN/ISO ratings) against products for customer reference." },
    ],
    useCases: ["Workwear suppliers", "PPE suppliers", "Safety equipment distributors", "Uniform suppliers", "Branded clothing suppliers", "Hi-vis and safety equipment"],
  },
  "automotive-crm": {
    badge: "AUTOMOTIVE CRM",
    headline: "CRM & Trade Counter Software For Motor Factors & Parts Suppliers",
    subheadline: "Manage trade accounts, parts stock, and trade counter sales for motor factors and automotive suppliers.",
    intro: "CtrlTrade® is built for motor factors, vehicle parts suppliers, and automotive trade distributors who need to manage trade account customers, large parts catalogues, trade counter operations, and efficient supplier purchasing — all in one platform.",
    features: [
      { title: "Trade Counter EPOS", desc: "Run a parts counter with CtrlTradePos®. Barcode scanning, trade account billing, and parts lookup." },
      { title: "Parts Stock Management", desc: "Manage large parts catalogues across multiple locations. Min/max reorder rules and automated purchasing." },
      { title: "Trade Accounts", desc: "Set credit limits, manage statements, and collect payment from garage and fleet trade customers." },
      { title: "Parts Ordering", desc: "Place orders with your parts suppliers and distributors. Receive and update stock automatically." },
      { title: "Fleet Customer Management", desc: "Manage fleet accounts, vehicle service histories, and scheduled maintenance for commercial customers." },
      { title: "Invoicing", desc: "Generate trade invoices, statements, and credit notes. Integrate with Xero or QuickBooks." },
    ],
    useCases: ["Motor factors", "Vehicle parts suppliers", "Commercial vehicle parts", "Fleet services providers", "Tyre centres", "Auto electrical suppliers"],
  },
  "warehousing-crm": {
    badge: "WAREHOUSING CRM",
    headline: "Software For Trade Warehouses & Distribution Centres",
    subheadline: "Manage stock, goods in/out, order picking, trade accounts, and supplier purchasing in one platform.",
    intro: "CtrlTrade® is built for trade warehouses, cash and carry operations, and distribution centres who need to manage stock across large product catalogues, process trade customer orders, and keep supplier purchasing efficient — all in one system.",
    features: [
      { title: "Stock Management", desc: "Real-time stock levels across warehouse locations. Min/max reorder rules with automated purchase orders." },
      { title: "Goods In / Out", desc: "Receive supplier deliveries against purchase orders. Log stock movements with full audit trail." },
      { title: "Pick & Pack", desc: "Generate pick lists from customer orders. Pack and dispatch with confirmation and delivery tracking." },
      { title: "Trade Accounts", desc: "Manage trade account customers with credit limits, statements, and account payment collection." },
      { title: "Trade Counter", desc: "Run a cash-and-carry or trade counter with CtrlTradePos®. Walk-in sales and trade account billing." },
      { title: "Supplier Orders", desc: "Raise and manage purchase orders. Receive against POs and update stock automatically." },
    ],
    useCases: ["Trade warehouses", "Distribution warehouses", "Cash and carry", "Fulfilment centres", "Wholesale distributors", "Trade importers"],
  },
  "distribution-crm": {
    badge: "DISTRIBUTION CRM",
    headline: "CRM Software For Trade Distributors & Wholesalers",
    subheadline: "Manage trade accounts, bulk orders, stock, and logistics for trade distribution businesses.",
    intro: "CtrlTrade® is built for trade distributors and wholesalers who need to manage trade account customers, bulk order processing, stock across multiple locations, and supplier purchasing — all in one connected platform.",
    features: [
      { title: "Trade Account Management", desc: "Manage wholesale accounts with credit limits, order history, statements, and account payment collection." },
      { title: "Bulk Order Processing", desc: "Process high-volume trade orders efficiently. Pick lists, despatch notes, and delivery scheduling built in." },
      { title: "Stock Management", desc: "Manage stock across multiple distribution centres and warehouse locations. Automated reorder management." },
      { title: "Supplier Purchasing", desc: "Raise purchase orders to manufacturers and suppliers. Receive stock against POs automatically." },
      { title: "Customer Portal", desc: "Trade account customers can view statements, place orders, and track deliveries via the portal." },
      { title: "Logistics Integration", desc: "Manage delivery scheduling and carrier integration. Track despatch and delivery confirmation." },
    ],
    useCases: ["Trade distributors", "Wholesale distributors", "National distribution centres", "Regional distributors", "Trade importers", "Trade exporters"],
  },
  "manufacturing-crm": {
    badge: "MANUFACTURING CRM",
    headline: "CRM Software For Building Products Manufacturers",
    subheadline: "Manage trade accounts, production orders, stock, and customer supply for building products manufacturers.",
    intro: "CtrlTrade® is built for building products manufacturers who supply to trade merchants, contractors, and construction companies. Manage trade account customers, production-to-order, stock, and wholesale distribution — all in one platform.",
    features: [
      { title: "Trade Account Management", desc: "Manage merchant and contractor trade accounts with credit limits, pricing tiers, and statement management." },
      { title: "Production Orders", desc: "Raise and track production orders. Link customer orders to production runs and delivery schedules." },
      { title: "Stock Management", desc: "Manage finished goods stock across multiple locations. Min/max rules and automated production triggers." },
      { title: "Supplier Purchasing", desc: "Raise purchase orders for raw materials. Receive against POs and update materials stock automatically." },
      { title: "Customer Portal", desc: "Trade account customers can view pricing, place orders, track deliveries, and view account statements." },
      { title: "Invoicing", desc: "Generate trade invoices and credit notes. Integrate with Xero or QuickBooks for financial management." },
    ],
    useCases: ["Building products manufacturers", "Timber manufacturers", "Kitchen manufacturers", "Bathroom manufacturers", "Window manufacturers", "Modular building manufacturers"],
  },
  "cabins-modular-crm": {
    badge: "CABINS & MODULAR BUILDINGS CRM",
    headline: "CRM Software For Cabin & Modular Building Suppliers",
    subheadline: "Manage cabin and garden room sales, production, installations, and customer communications in one platform.",
    intro: "CtrlTrade® is built for cabin manufacturers, garden room builders, and modular building suppliers who need to manage the full customer journey — from initial enquiry and design consultation to production scheduling, delivery, and installation.",
    features: [
      { title: "Design Consultations", desc: "Manage customer site visits and design consultations. Log measurements, planning requirements, and product selections." },
      { title: "Custom Quoting", desc: "Build bespoke quotes for garden rooms, cabins, lodges, and modular structures. Send for e-signature approval." },
      { title: "Production Scheduling", desc: "Schedule production runs linked to confirmed orders. Track build progress against delivery dates." },
      { title: "Planning Support", desc: "Log planning permission requirements, permitted development notes, and council correspondence against each project." },
      { title: "Installation Management", desc: "Schedule installation crews and manage multi-day installation projects. Snagging and handover sign-off." },
      { title: "Customer Portal", desc: "Customers can track their build progress, access planning documents, and make stage payments via the portal." },
    ],
    useCases: ["Cabin manufacturers", "Garden room builders", "Modular building suppliers", "Holiday lodge manufacturers", "Glamping pod manufacturers", "Park home suppliers"],
  },
  "agricultural-crm": {
    badge: "AGRICULTURAL CRM",
    headline: "CRM & Trade Counter Software For Agricultural Merchants",
    subheadline: "Manage trade accounts, farm supplies stock, trade counter sales, and seasonal ordering in one platform.",
    intro: "CtrlTrade® is built for agricultural merchants and farm supply companies who need to manage trade account farming customers, large seasonal stock catalogues, trade counter operations, and supplier ordering — all in one connected platform.",
    features: [
      { title: "Trade Counter EPOS", desc: "Run a farm supplies trade counter with CtrlTradePos®. Barcode scanning and trade account billing." },
      { title: "Stock Management", desc: "Manage farm supplies, livestock products, and machinery parts stock. Seasonal reorder planning." },
      { title: "Trade Accounts", desc: "Manage farmer and contractor trade accounts with credit limits and statement management." },
      { title: "Supplier Orders", desc: "Raise purchase orders to agricultural merchants and manufacturers. Receive and update stock automatically." },
      { title: "Seasonal Planning", desc: "Plan and manage seasonal stock requirements. Bulk ordering and storage management tools." },
      { title: "Compliance Records", desc: "Log BCMS-related records, pesticide storage compliance, and veterinary medicine logs." },
    ],
    useCases: ["Agricultural merchants", "Farm supplies merchants", "Agricultural machinery suppliers", "Livestock equipment suppliers", "Irrigation suppliers", "Rural merchants"],
  },
  "showrooms-crm": {
    badge: "TRADE SHOWROOMS CRM",
    headline: "Software For Trade Showrooms",
    subheadline: "Manage customer appointments, product consultations, quote building, and deposit collection for trade showrooms.",
    intro: "CtrlTrade® is built for trade showrooms across kitchens, bathrooms, flooring, windows, and outdoor living — managing everything from the first customer appointment to final payment in one connected platform.",
    features: [
      { title: "Showroom Appointments", desc: "Book and manage customer consultations. Track pipeline from walk-in to signed order." },
      { title: "Product Showcase", desc: "Browse and present your product catalogue on the showroom floor. Search, filter, and show pricing." },
      { title: "Quote Building", desc: "Build quotes on the showroom floor with the customer. Add products, labour, and delivery. Send for approval." },
      { title: "Deposit Collection", desc: "Collect deposits on quote acceptance via card payment or the customer portal." },
      { title: "Trade Accounts", desc: "Trade account customers can view balances, statements, and outstanding orders from the portal." },
      { title: "CRM Integration", desc: "Every showroom visitor is a lead in the CRM. Track conversion from appointment to sale to installation." },
    ],
    useCases: ["Kitchen showrooms", "Bathroom showrooms", "Flooring showrooms", "Window showrooms", "Tile showrooms", "Lighting showrooms"],
  },
  "specialist-trades-crm": {
    badge: "SPECIALIST TRADES CRM",
    headline: "CRM Software For Specialist Trade Contractors",
    subheadline: "Manage specialist trade projects, compliance, subcontractor networks, and customer invoicing in one platform.",
    intro: "CtrlTrade® is built for specialist trade contractors — from scaffolders and surveyors to asbestos contractors and shopfitters — who need to manage complex project-based work, compliance documentation, and professional customer relationships.",
    features: [
      { title: "Project Management", desc: "Manage complex specialist trade projects with phases, tasks, and subcontractor assignments." },
      { title: "Compliance Documentation", desc: "Log specialist compliance records — asbestos surveys, structural calculations, LOLER examinations — against each project." },
      { title: "Subcontractor Management", desc: "Manage your specialist subcontractor network. Invite, assign, and invoice subcontractors via the platform." },
      { title: "Quote & Tender Management", desc: "Build and submit detailed project quotes and tenders. Track tender status and success rates." },
      { title: "Site Survey Records", desc: "Capture survey notes, measurements, and condition assessments from the field app." },
      { title: "Professional Invoicing", desc: "Stage payments, retentions, and final account invoicing. Collect payment via the customer portal." },
    ],
    useCases: ["Scaffolders", "Surveyors", "Quantity surveyors", "Damp proofing specialists", "Asbestos contractors", "Shopfitters"],
  },
  "logistics-crm": {
    badge: "LOGISTICS & TRANSPORT CRM",
    headline: "CRM Software For Haulage & Trade Logistics Companies",
    subheadline: "Manage trade delivery networks, fleet operations, and logistics customer accounts in one platform.",
    intro: "CtrlTrade® is built for haulage companies, pallet distributors, and trade logistics providers who need to manage customer delivery contracts, fleet operations, driver scheduling, and invoicing — all in one connected platform.",
    features: [
      { title: "Fleet Management", desc: "Manage your vehicle fleet with MOT dates, service records, driver assignments, and mileage tracking." },
      { title: "Driver Scheduling", desc: "Assign drivers to delivery runs and routes. Track driver hours, tachograph compliance, and availability." },
      { title: "Delivery Management", desc: "Manage delivery jobs from booking to completion. Customer ETA notifications and proof of delivery." },
      { title: "Customer Accounts", desc: "Manage logistics customer accounts with contract rates, volume tracking, and account invoicing." },
      { title: "Compliance Records", desc: "Log Operators Licence compliance, driver CPC training, vehicle inspection records, and DVSA documentation." },
      { title: "Invoicing", desc: "Generate delivery invoices and account statements. Integrate with Xero or QuickBooks for accounts." },
    ],
    useCases: ["Haulage companies", "Pallet distributors", "Courier companies", "Trade delivery networks", "Fleet operators", "Construction logistics"],
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
