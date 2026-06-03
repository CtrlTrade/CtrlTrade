import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { PublicLayout } from "@/components/layout/PublicLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { ReferralTracker } from "@/components/ReferralTracker";

// ─── Lazy page imports ────────────────────────────────────────────────────────

// Not-found (kept eager — tiny, needed by many route fallbacks)
import NotFound from "@/pages/not-found";

// Public pages
const Home           = lazy(() => import("@/pages/public/StaticPages").then(m => ({ default: m.Home })));
const Features       = lazy(() => import("@/pages/public/StaticPages").then(m => ({ default: m.Features })));
const Integrations   = lazy(() => import("@/pages/public/StaticPages").then(m => ({ default: m.Integrations })));
const Addons         = lazy(() => import("@/pages/public/StaticPages").then(m => ({ default: m.Addons })));
const Security       = lazy(() => import("@/pages/public/StaticPages").then(m => ({ default: m.Security })));
const Contact        = lazy(() => import("@/pages/public/StaticPages").then(m => ({ default: m.Contact })));
const Pricing        = lazy(() => import("@/pages/public/Pricing").then(m => ({ default: m.Pricing })));
const Industries     = lazy(() => import("@/pages/public/Industries").then(m => ({ default: m.Industries })));
const CrmPage        = lazy(() => import("@/pages/public/CrmPage").then(m => ({ default: m.CrmPage })));
const CtrlTradePosPage    = lazy(() => import("@/pages/public/CtrlTradePosPage").then(m => ({ default: m.CtrlTradePosPage })));
const CustomerPortalPage  = lazy(() => import("@/pages/public/CustomerPortalPage").then(m => ({ default: m.CustomerPortalPage })));
const AboutPage      = lazy(() => import("@/pages/public/AboutPage").then(m => ({ default: m.AboutPage })));
const BlogPage       = lazy(() => import("@/pages/public/BlogPage").then(m => ({ default: m.BlogPage })));
const BlogPostPage   = lazy(() => import("@/pages/public/BlogPostPage").then(m => ({ default: m.BlogPostPage })));
const BlogCategoryPage = lazy(() => import("@/pages/public/BlogCategoryPage").then(m => ({ default: m.BlogCategoryPage })));
const StatusPage     = lazy(() => import("@/pages/public/StatusPage").then(m => ({ default: m.StatusPage })));
const PrivacyPage    = lazy(() => import("@/pages/public/LegalPages").then(m => ({ default: m.PrivacyPage })));
const TermsPage      = lazy(() => import("@/pages/public/LegalPages").then(m => ({ default: m.TermsPage })));
const CookiesPage    = lazy(() => import("@/pages/public/LegalPages").then(m => ({ default: m.CookiesPage })));
const SeoLandingPage = lazy(() => import("@/pages/public/SeoLandingPage").then(m => ({ default: m.SeoLandingPage })));
const Marketplace        = lazy(() => import("@/pages/public/Marketplace").then(m => ({ default: m.Marketplace })));
const MarketplaceListing = lazy(() => import("@/pages/public/MarketplaceListing").then(m => ({ default: m.MarketplaceListing })));
const PublicBooking      = lazy(() => import("@/pages/public/PublicBooking").then(m => ({ default: m.PublicBooking })));

// Auth
const Login          = lazy(() => import("@/pages/auth/Login").then(m => ({ default: m.Login })));
const Signup         = lazy(() => import("@/pages/auth/Signup").then(m => ({ default: m.Signup })));
const AcceptInvite   = lazy(() => import("@/pages/auth/AcceptInvite").then(m => ({ default: m.AcceptInvite })));
const ForgotPassword = lazy(() => import("@/pages/auth/PasswordReset").then(m => ({ default: m.ForgotPassword })));
const ResetPassword  = lazy(() => import("@/pages/auth/PasswordReset").then(m => ({ default: m.ResetPassword })));

// App
const AppDashboard          = lazy(() => import("@/pages/app/Dashboard").then(m => ({ default: m.AppDashboard })));
const AppSettings           = lazy(() => import("@/pages/app/Settings").then(m => ({ default: m.AppSettings })));
const AppBrandingEditor     = lazy(() => import("@/pages/app/BrandingEditor").then(m => ({ default: m.AppBrandingEditor })));
const AppBilling            = lazy(() => import("@/pages/app/Billing").then(m => ({ default: m.AppBilling })));
const AppCustomers          = lazy(() => import("@/pages/app/Customers").then(m => ({ default: m.AppCustomers })));
const AppCustomerDetail     = lazy(() => import("@/pages/app/CustomerDetail").then(m => ({ default: m.AppCustomerDetail })));
const AppQuotes             = lazy(() => import("@/pages/app/Quotes").then(m => ({ default: m.AppQuotes })));
const AppQuoteDetail        = lazy(() => import("@/pages/app/QuoteDetail").then(m => ({ default: m.AppQuoteDetail })));
const AppJobs               = lazy(() => import("@/pages/app/Jobs").then(m => ({ default: m.AppJobs })));
const AppJobDetail          = lazy(() => import("@/pages/app/JobDetail").then(m => ({ default: m.AppJobDetail })));
const AppSchedule           = lazy(() => import("@/pages/app/Schedule").then(m => ({ default: m.AppSchedule })));
const AppFleet              = lazy(() => import("@/pages/app/Fleet").then(m => ({ default: m.AppFleet })));
const AppCompliance         = lazy(() => import("@/pages/app/Compliance").then(m => ({ default: m.AppCompliance })));
const AppInvoices           = lazy(() => import("@/pages/app/Invoices").then(m => ({ default: m.AppInvoices })));
const AppInvoiceDetail      = lazy(() => import("@/pages/app/InvoiceDetail").then(m => ({ default: m.AppInvoiceDetail })));
const AppInvoiceTemplates   = lazy(() => import("@/pages/app/InvoiceTemplates").then(m => ({ default: m.AppInvoiceTemplates })));
const AppLeads              = lazy(() => import("@/pages/app/Leads").then(m => ({ default: m.AppLeads })));
const AppLeadDetail         = lazy(() => import("@/pages/app/LeadDetail").then(m => ({ default: m.AppLeadDetail })));
const AppInbox              = lazy(() => import("@/pages/app/Inbox").then(m => ({ default: m.AppInbox })));
const AppPos                = lazy(() => import("@/pages/app/Pos").then(m => ({ default: m.AppPos })));
const PosTill               = lazy(() => import("@/pages/app/PosTill").then(m => ({ default: m.PosTill })));
const AppProducts           = lazy(() => import("@/pages/app/Products").then(m => ({ default: m.AppProducts })));
const AppStock              = lazy(() => import("@/pages/app/Stock").then(m => ({ default: m.AppStock })));
const AppSuppliers          = lazy(() => import("@/pages/app/Suppliers").then(m => ({ default: m.AppSuppliers })));
const AppSupplierOrders     = lazy(() => import("@/pages/app/SupplierOrders").then(m => ({ default: m.AppSupplierOrders })));
const AppTradeAccounts      = lazy(() => import("@/pages/app/TradeAccounts").then(m => ({ default: m.AppTradeAccounts })));
const ReportsIndex              = lazy(() => import("@/pages/app/reports/Index").then(m => ({ default: m.ReportsIndex })));
const RevenueReport             = lazy(() => import("@/pages/app/reports/Revenue").then(m => ({ default: m.RevenueReport })));
const LeadRoiReport             = lazy(() => import("@/pages/app/reports/LeadRoi").then(m => ({ default: m.LeadRoiReport })));
const EngineerPerformanceReport = lazy(() => import("@/pages/app/reports/EngineerPerformance").then(m => ({ default: m.EngineerPerformanceReport })));
const QuoteConversionReport     = lazy(() => import("@/pages/app/reports/QuoteConversion").then(m => ({ default: m.QuoteConversionReport })));
const JobProfitabilityReport    = lazy(() => import("@/pages/app/reports/JobProfitability").then(m => ({ default: m.JobProfitabilityReport })));
const CustomerLtvReport         = lazy(() => import("@/pages/app/reports/CustomerLtv").then(m => ({ default: m.CustomerLtvReport })));
const AgedDebtorsReport         = lazy(() => import("@/pages/app/reports/AgedDebtors").then(m => ({ default: m.AgedDebtorsReport })));
const ActivityHeatmapReport     = lazy(() => import("@/pages/app/reports/ActivityHeatmap").then(m => ({ default: m.ActivityHeatmapReport })));
const AppAutomation         = lazy(() => import("@/pages/app/Automation").then(m => ({ default: m.AppAutomation })));
const AppVoice              = lazy(() => import("@/pages/app/Voice").then(m => ({ default: m.AppVoice })));
const AppTimesheets         = lazy(() => import("@/pages/app/Timesheets").then(m => ({ default: m.AppTimesheets })));
const AppProjects           = lazy(() => import("@/pages/app/Projects").then(m => ({ default: m.AppProjects })));
const AppProjectDetail      = lazy(() => import("@/pages/app/ProjectDetail").then(m => ({ default: m.AppProjectDetail })));
const AppAvailability       = lazy(() => import("@/pages/app/Availability").then(m => ({ default: m.AppAvailability })));
const AppBranches           = lazy(() => import("@/pages/app/Branches").then(m => ({ default: m.AppBranches })));
const AppAreaManagers       = lazy(() => import("@/pages/app/AreaManagers").then(m => ({ default: m.AppAreaManagers })));
const PlaceholderPage       = lazy(() => import("@/components/PlaceholderPage").then(m => ({ default: m.PlaceholderPage })));

// Admin
const AdminDashboard            = lazy(() => import("@/pages/admin/Dashboard").then(m => ({ default: m.AdminDashboard })));
const AdminTenants              = lazy(() => import("@/pages/admin/Tenants").then(m => ({ default: m.AdminTenants })));
const AdminTenantDetail         = lazy(() => import("@/pages/admin/TenantDetail").then(m => ({ default: m.AdminTenantDetail })));
const AdminTenantWhiteLabel     = lazy(() => import("@/pages/admin/TenantWhiteLabel").then(m => ({ default: m.AdminTenantWhiteLabel })));
const AdminFeatureFlags         = lazy(() => import("@/pages/admin/FeatureFlags").then(m => ({ default: m.AdminFeatureFlags })));
const AdminIntegrationCatalogue = lazy(() => import("@/pages/admin/IntegrationCatalogue").then(m => ({ default: m.AdminIntegrationCatalogue })));
const AdminWorkers              = lazy(() => import("@/pages/admin/Workers").then(m => ({ default: m.AdminWorkers })));
const AdminUsage                = lazy(() => import("@/pages/admin/Usage").then(m => ({ default: m.AdminUsage })));
const AdminReportsIndex         = lazy(() => import("@/pages/admin/reports/Index").then(m => ({ default: m.AdminReportsIndex })));
const AdminRevenueReport        = lazy(() => import("@/pages/admin/reports/AdminRevenue").then(m => ({ default: m.AdminRevenueReport })));
const AdminTenantActivityReport = lazy(() => import("@/pages/admin/reports/AdminTenantActivity").then(m => ({ default: m.AdminTenantActivityReport })));
const AdminUsageReport          = lazy(() => import("@/pages/admin/reports/AdminUsageReport").then(m => ({ default: m.AdminUsageReport })));
const AdminReferralsReport      = lazy(() => import("@/pages/admin/reports/AdminReferralsReport").then(m => ({ default: m.AdminReferralsReport })));
const AdminLeads                = lazy(() => import("@/pages/admin/Leads").then(m => ({ default: m.AdminLeads })));
const AdminLeadDetail           = lazy(() => import("@/pages/admin/LeadDetail").then(m => ({ default: m.AdminLeadDetail })));
const AdminReferrals            = lazy(() => import("@/pages/admin/Referrals").then(m => ({ default: m.AdminReferrals })));
const AdminCompliance           = lazy(() => import("@/pages/admin/Compliance").then(m => ({ default: m.AdminCompliance })));
const AdminIndustryEditor       = lazy(() => import("@/pages/admin/IndustryEditor").then(m => ({ default: m.AdminIndustryEditor })));

// Customer portal
const PortalLogin     = lazy(() => import("@/pages/portal/PortalLogin").then(m => ({ default: m.PortalLogin })));
const PortalVerify    = lazy(() => import("@/pages/portal/PortalVerify").then(m => ({ default: m.PortalVerify })));
const PortalDashboard = lazy(() => import("@/pages/portal/PortalDashboard").then(m => ({ default: m.PortalDashboard })));
const PortalQuote     = lazy(() => import("@/pages/portal/PortalQuote").then(m => ({ default: m.PortalQuote })));
const PortalInvoice   = lazy(() => import("@/pages/portal/PortalInvoice").then(m => ({ default: m.PortalInvoice })));
const PortalJob       = lazy(() => import("@/pages/portal/PortalJob").then(m => ({ default: m.PortalJob })));
const PortalRefer     = lazy(() => import("@/pages/portal/PortalRefer").then(m => ({ default: m.PortalRefer })));

// Partner portal
const PartnerLogin       = lazy(() => import("@/pages/partner/PartnerLogin").then(m => ({ default: m.PartnerLogin })));
const PartnerSignup      = lazy(() => import("@/pages/partner/PartnerSignup").then(m => ({ default: m.PartnerSignup })));
const PartnerDashboard   = lazy(() => import("@/pages/partner/PartnerDashboard").then(m => ({ default: m.PartnerDashboard })));
const PartnerLinks       = lazy(() => import("@/pages/partner/PartnerLinks").then(m => ({ default: m.PartnerLinks })));
const PartnerCommissions = lazy(() => import("@/pages/partner/PartnerCommissions").then(m => ({ default: m.PartnerCommissions })));
const PartnerPayouts     = lazy(() => import("@/pages/partner/PartnerPayouts").then(m => ({ default: m.PartnerPayouts })));

// Reseller
const ResellerDashboard = lazy(() => import("@/pages/reseller/ResellerDashboard").then(m => ({ default: m.ResellerDashboard })));

// ─── Query client ─────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Fallback shown while a lazy chunk loads ──────────────────────────────────

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

interface AppProps {
  ssrPath?: string;
}

function App({ ssrPath }: AppProps = {}) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "")} ssrPath={ssrPath}>
          <ReferralTracker />
          <Suspense fallback={<PageLoader />}>
            <Switch>
              {/* Auth */}
              <Route path="/login" component={Login} />
              <Route path="/signup" component={Signup} />
              <Route path="/accept-invite" component={AcceptInvite} />
              <Route path="/forgot-password" component={ForgotPassword} />
              <Route path="/reset-password" component={ResetPassword} />

              {/* App */}
              <Route path="/app" nest>
                <AppLayout>
                  <Switch>
                    <Route path="/" component={AppDashboard} />
                    <Route path="/settings" component={AppSettings} />
                    <Route path="/settings/branding" component={AppBrandingEditor} />
                    <Route path="/billing" component={AppBilling} />
                    <Route path="/customers" component={AppCustomers} />
                    <Route path="/customers/:id" component={AppCustomerDetail} />
                    <Route path="/leads" component={AppLeads} />
                    <Route path="/leads/:id" component={AppLeadDetail} />
                    <Route path="/quotes" component={AppQuotes} />
                    <Route path="/quotes/:id" component={AppQuoteDetail} />
                    <Route path="/jobs" component={AppJobs} />
                    <Route path="/jobs/:id" component={AppJobDetail} />
                    <Route path="/schedule" component={AppSchedule} />
                    <Route path="/fleet" component={AppFleet} />
                    <Route path="/compliance" component={AppCompliance} />
                    <Route path="/invoices" component={AppInvoices} />
                    <Route path="/invoice-templates" component={AppInvoiceTemplates} />
                    <Route path="/invoices/:id" component={AppInvoiceDetail} />
                    <Route path="/inbox" component={AppInbox} />
                    <Route path="/pos" component={AppPos} />
                    <Route path="/pos/till" component={PosTill} />
                    <Route path="/products" component={AppProducts} />
                    <Route path="/stock" component={AppStock} />
                    <Route path="/suppliers" component={AppSuppliers} />
                    <Route path="/supplier-orders" component={AppSupplierOrders} />
                    <Route path="/trade-accounts" component={AppTradeAccounts} />
                    <Route path="/reports" component={ReportsIndex} />
                    <Route path="/reports/revenue">{() => <RevenueReport />}</Route>
                    <Route path="/reports/lead-roi">{() => <LeadRoiReport />}</Route>
                    <Route path="/reports/engineer-performance">{() => <EngineerPerformanceReport />}</Route>
                    <Route path="/reports/quote-conversion">{() => <QuoteConversionReport />}</Route>
                    <Route path="/reports/job-profitability">{() => <JobProfitabilityReport />}</Route>
                    <Route path="/reports/customer-ltv">{() => <CustomerLtvReport />}</Route>
                    <Route path="/reports/aged-debtors">{() => <AgedDebtorsReport />}</Route>
                    <Route path="/reports/activity-heatmap">{() => <ActivityHeatmapReport />}</Route>
                    <Route path="/timesheets" component={AppTimesheets} />
                    <Route path="/availability" component={AppAvailability} />
                    <Route path="/branches" component={AppBranches} />
                    <Route path="/area-managers" component={AppAreaManagers} />
                    <Route path="/projects" component={AppProjects} />
                    <Route path="/projects/:id" component={AppProjectDetail} />
                    <Route path="/automation" component={AppAutomation} />
                    <Route path="/voice" component={AppVoice} />
                    <Route path="/:id">
                      {() => <PlaceholderPage />}
                    </Route>
                  </Switch>
                </AppLayout>
              </Route>

              {/* Partner portal */}
              <Route path="/partner" nest>
                <Switch>
                  <Route path="/login" component={PartnerLogin} />
                  <Route path="/signup" component={PartnerSignup} />
                  <Route>
                    <PartnerLayout>
                      <Switch>
                        <Route path="/" component={PartnerDashboard} />
                        <Route path="/links" component={PartnerLinks} />
                        <Route path="/commissions" component={PartnerCommissions} />
                        <Route path="/payouts" component={PartnerPayouts} />
                        <Route component={NotFound} />
                      </Switch>
                    </PartnerLayout>
                  </Route>
                </Switch>
              </Route>

              {/* Customer portal */}
              <Route path="/portal/:tenantSlug" nest>
                {(params) => (
                  <PortalLayout>
                    <Switch>
                      <Route path="/" component={PortalLogin} />
                      <Route path="/verify" component={PortalVerify} />
                      <Route path="/app" component={PortalDashboard} />
                      <Route path="/refer" component={PortalRefer} />
                      <Route path="/quotes/:id">
                        {(p) => <PortalQuote key={`${params.tenantSlug}-${p.id}`} />}
                      </Route>
                      <Route path="/invoices/:id">
                        {(p) => <PortalInvoice key={`${params.tenantSlug}-${p.id}`} />}
                      </Route>
                      <Route path="/jobs/:id">
                        {(p) => <PortalJob key={`${params.tenantSlug}-${p.id}`} />}
                      </Route>
                      <Route component={NotFound} />
                    </Switch>
                  </PortalLayout>
                )}
              </Route>

              {/* Admin */}
              <Route path="/admin" nest>
                <AdminLayout>
                  <Switch>
                    <Route path="/" component={AdminDashboard} />
                    <Route path="/tenants" component={AdminTenants} />
                    <Route path="/tenants/:id" component={AdminTenantDetail} />
                    <Route path="/tenants/:id/white-label" component={AdminTenantWhiteLabel} />
                    <Route path="/feature-flags" component={AdminFeatureFlags} />
                    <Route path="/workers" component={AdminWorkers} />
                    <Route path="/usage" component={AdminUsage} />
                    <Route path="/compliance" component={AdminCompliance} />
                    <Route path="/leads" component={AdminLeads} />
                    <Route path="/leads/:id" component={AdminLeadDetail} />
                    <Route path="/referrals" component={AdminReferrals} />
                    <Route path="/reports" component={AdminReportsIndex} />
                    <Route path="/reports/revenue">{() => <AdminRevenueReport />}</Route>
                    <Route path="/reports/tenant-activity">{() => <AdminTenantActivityReport />}</Route>
                    <Route path="/reports/usage">{() => <AdminUsageReport />}</Route>
                    <Route path="/reports/referrals">{() => <AdminReferralsReport />}</Route>
                    <Route path="/integrations" component={AdminIntegrationCatalogue} />
                    <Route path="/industries" component={AdminIndustryEditor} />
                    <Route component={NotFound} />
                  </Switch>
                </AdminLayout>
              </Route>

              {/* Reseller console */}
              <Route path="/reseller" component={ResellerDashboard} />

              {/* Public booking page — must be before <PublicLayout> catch-all */}
              <Route path="/book/:tenantSlug" component={PublicBooking} />

              {/* Public */}
              <Route>
                <PublicLayout>
                  <Switch>
                    {/* Main marketing pages */}
                    <Route path="/" component={Home} />
                    <Route path="/features" component={Features} />
                    <Route path="/pricing" component={Pricing} />
                    <Route path="/industries" component={Industries} />
                    <Route path="/integrations" component={Integrations} />
                    <Route path="/addons" component={Addons} />
                    <Route path="/security" component={Security} />
                    <Route path="/contact" component={Contact} />

                    {/* Product pages */}
                    <Route path="/crm" component={CrmPage} />
                    <Route path="/ctrltradepos" component={CtrlTradePosPage} />
                    <Route path="/customer-portal" component={CustomerPortalPage} />

                    {/* Company pages */}
                    <Route path="/about" component={AboutPage} />
                    <Route path="/blog" component={BlogPage} />
                    <Route path="/blog/category/:slug">{(params) => <BlogCategoryPage slug={params.slug} />}</Route>
                    <Route path="/blog/:slug">{(params) => <BlogPostPage slug={params.slug} />}</Route>
                    <Route path="/status" component={StatusPage} />

                    {/* Legal pages */}
                    <Route path="/privacy" component={PrivacyPage} />
                    <Route path="/terms" component={TermsPage} />
                    <Route path="/cookies" component={CookiesPage} />

                    {/* Marketplace */}
                    <Route path="/marketplace" component={Marketplace} />
                    <Route path="/marketplace/:slug" component={MarketplaceListing} />

                    {/* SEO landing pages */}
                    <Route path="/roofing-crm">{() => <SeoLandingPage slug="roofing-crm" />}</Route>
                    <Route path="/electrical-crm">{() => <SeoLandingPage slug="electrical-crm" />}</Route>
                    <Route path="/plumbing-crm">{() => <SeoLandingPage slug="plumbing-crm" />}</Route>
                    <Route path="/hvac-crm">{() => <SeoLandingPage slug="hvac-crm" />}</Route>
                    <Route path="/builders-crm">{() => <SeoLandingPage slug="builders-crm" />}</Route>
                    <Route path="/cleaning-crm">{() => <SeoLandingPage slug="cleaning-crm" />}</Route>
                    <Route path="/facilities-management-crm">{() => <SeoLandingPage slug="facilities-management-crm" />}</Route>
                    <Route path="/trade-counter-epos">{() => <SeoLandingPage slug="trade-counter-epos" />}</Route>
                    <Route path="/warehouse-management-software">{() => <SeoLandingPage slug="warehouse-management-software" />}</Route>
                    <Route path="/showroom-management-software">{() => <SeoLandingPage slug="showroom-management-software" />}</Route>
                    <Route path="/field-service-management-software">{() => <SeoLandingPage slug="field-service-management-software" />}</Route>
                    <Route path="/builders-merchants-crm">{() => <SeoLandingPage slug="builders-merchants-crm" />}</Route>
                    <Route path="/masonry-crm">{() => <SeoLandingPage slug="masonry-crm" />}</Route>
                    <Route path="/timber-merchants-crm">{() => <SeoLandingPage slug="timber-merchants-crm" />}</Route>
                    <Route path="/heating-gas-crm">{() => <SeoLandingPage slug="heating-gas-crm" />}</Route>
                    <Route path="/renewable-energy-crm">{() => <SeoLandingPage slug="renewable-energy-crm" />}</Route>
                    <Route path="/security-fire-crm">{() => <SeoLandingPage slug="security-fire-crm" />}</Route>
                    <Route path="/windows-doors-crm">{() => <SeoLandingPage slug="windows-doors-crm" />}</Route>
                    <Route path="/kitchens-crm">{() => <SeoLandingPage slug="kitchens-crm" />}</Route>
                    <Route path="/bathrooms-crm">{() => <SeoLandingPage slug="bathrooms-crm" />}</Route>
                    <Route path="/flooring-crm">{() => <SeoLandingPage slug="flooring-crm" />}</Route>
                    <Route path="/tiles-crm">{() => <SeoLandingPage slug="tiles-crm" />}</Route>
                    <Route path="/decorating-crm">{() => <SeoLandingPage slug="decorating-crm" />}</Route>
                    <Route path="/landscaping-crm">{() => <SeoLandingPage slug="landscaping-crm" />}</Route>
                    <Route path="/fencing-crm">{() => <SeoLandingPage slug="fencing-crm" />}</Route>
                    <Route path="/steel-metal-crm">{() => <SeoLandingPage slug="steel-metal-crm" />}</Route>
                    <Route path="/industrial-supplies-crm">{() => <SeoLandingPage slug="industrial-supplies-crm" />}</Route>
                    <Route path="/tools-equipment-crm">{() => <SeoLandingPage slug="tools-equipment-crm" />}</Route>
                    <Route path="/plant-machinery-crm">{() => <SeoLandingPage slug="plant-machinery-crm" />}</Route>
                    <Route path="/workwear-ppe-crm">{() => <SeoLandingPage slug="workwear-ppe-crm" />}</Route>
                    <Route path="/automotive-crm">{() => <SeoLandingPage slug="automotive-crm" />}</Route>
                    <Route path="/warehousing-crm">{() => <SeoLandingPage slug="warehousing-crm" />}</Route>
                    <Route path="/distribution-crm">{() => <SeoLandingPage slug="distribution-crm" />}</Route>
                    <Route path="/manufacturing-crm">{() => <SeoLandingPage slug="manufacturing-crm" />}</Route>
                    <Route path="/cabins-modular-crm">{() => <SeoLandingPage slug="cabins-modular-crm" />}</Route>
                    <Route path="/agricultural-crm">{() => <SeoLandingPage slug="agricultural-crm" />}</Route>
                    <Route path="/showrooms-crm">{() => <SeoLandingPage slug="showrooms-crm" />}</Route>
                    <Route path="/specialist-trades-crm">{() => <SeoLandingPage slug="specialist-trades-crm" />}</Route>
                    <Route path="/logistics-crm">{() => <SeoLandingPage slug="logistics-crm" />}</Route>

                    <Route component={NotFound} />
                  </Switch>
                </PublicLayout>
              </Route>
            </Switch>
          </Suspense>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
