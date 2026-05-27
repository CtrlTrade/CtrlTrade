import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";

// Public pages
import { Home, Features, Integrations, Addons, Security, Contact } from "@/pages/public/StaticPages";
import { Pricing } from "@/pages/public/Pricing";
import { Industries } from "@/pages/public/Industries";

// Auth
import { Login } from "@/pages/auth/Login";
import { Signup } from "@/pages/auth/Signup";
import { AcceptInvite } from "@/pages/auth/AcceptInvite";
import { ForgotPassword, ResetPassword } from "@/pages/auth/PasswordReset";

// App
import { AppDashboard } from "@/pages/app/Dashboard";
import { AppSettings } from "@/pages/app/Settings";
import { AppBrandingEditor } from "@/pages/app/BrandingEditor";
import { AppBilling } from "@/pages/app/Billing";
import { AppCustomers } from "@/pages/app/Customers";
import { AppQuotes } from "@/pages/app/Quotes";
import { AppQuoteDetail } from "@/pages/app/QuoteDetail";
import { AppJobs } from "@/pages/app/Jobs";
import { AppJobDetail } from "@/pages/app/JobDetail";
import { AppSchedule } from "@/pages/app/Schedule";
import { AppFleet } from "@/pages/app/Fleet";
import { AppCompliance } from "@/pages/app/Compliance";
import { AppInvoices } from "@/pages/app/Invoices";
import { AppInvoiceDetail } from "@/pages/app/InvoiceDetail";
import { AppInvoiceTemplates } from "@/pages/app/InvoiceTemplates";
import { AppLeads } from "@/pages/app/Leads";
import { AppLeadDetail } from "@/pages/app/LeadDetail";
import { AppInbox } from "@/pages/app/Inbox";
import { AppPos } from "@/pages/app/Pos";
import { AppProducts } from "@/pages/app/Products";
import { AppStock } from "@/pages/app/Stock";
import { AppSuppliers } from "@/pages/app/Suppliers";
import { AppSupplierOrders } from "@/pages/app/SupplierOrders";
import { AppTradeAccounts } from "@/pages/app/TradeAccounts";
import { ReportsIndex } from "@/pages/app/reports/Index";
import { RevenueReport } from "@/pages/app/reports/Revenue";
import { LeadRoiReport } from "@/pages/app/reports/LeadRoi";
import { EngineerPerformanceReport } from "@/pages/app/reports/EngineerPerformance";
import { QuoteConversionReport } from "@/pages/app/reports/QuoteConversion";
import { JobProfitabilityReport } from "@/pages/app/reports/JobProfitability";
import { CustomerLtvReport } from "@/pages/app/reports/CustomerLtv";
import { AgedDebtorsReport } from "@/pages/app/reports/AgedDebtors";
import { ActivityHeatmapReport } from "@/pages/app/reports/ActivityHeatmap";
import { AppAutomation } from "@/pages/app/Automation";
import { AppVoice } from "@/pages/app/Voice";
import { AppTimesheets } from "@/pages/app/Timesheets";
import { AppMaintenanceContracts } from "@/pages/app/MaintenanceContracts";
import { AppAvailability } from "@/pages/app/Availability";
import { AppBranches } from "@/pages/app/Branches";
import { AppAreaManagers } from "@/pages/app/AreaManagers";
import { PlaceholderPage } from "@/components/PlaceholderPage";

// Admin
import { AdminDashboard } from "@/pages/admin/Dashboard";
import { AdminTenants } from "@/pages/admin/Tenants";
import { AdminTenantDetail } from "@/pages/admin/TenantDetail";
import { AdminTenantWhiteLabel } from "@/pages/admin/TenantWhiteLabel";
import { AdminFeatureFlags } from "@/pages/admin/FeatureFlags";
import { AdminIntegrationCatalogue } from "@/pages/admin/IntegrationCatalogue";
import { AdminWorkers } from "@/pages/admin/Workers";
import { AdminUsage } from "@/pages/admin/Usage";
import { AdminReportsIndex } from "@/pages/admin/reports/Index";
import { AdminRevenueReport } from "@/pages/admin/reports/AdminRevenue";
import { AdminTenantActivityReport } from "@/pages/admin/reports/AdminTenantActivity";
import { AdminUsageReport } from "@/pages/admin/reports/AdminUsageReport";
import { AdminReferralsReport } from "@/pages/admin/reports/AdminReferralsReport";
import { AdminLeads } from "@/pages/admin/Leads";
import { AdminLeadDetail } from "@/pages/admin/LeadDetail";

// Customer portal
import { PortalLayout } from "@/components/layout/PortalLayout";
import { PortalLogin } from "@/pages/portal/PortalLogin";
import { PortalVerify } from "@/pages/portal/PortalVerify";
import { PortalDashboard } from "@/pages/portal/PortalDashboard";
import { PortalQuote } from "@/pages/portal/PortalQuote";
import { PortalInvoice } from "@/pages/portal/PortalInvoice";
import { PortalJob } from "@/pages/portal/PortalJob";
import { PortalRefer } from "@/pages/portal/PortalRefer";

// Partner portal
import { PartnerLayout } from "@/components/layout/PartnerLayout";
import { PartnerLogin } from "@/pages/partner/PartnerLogin";
import { PartnerSignup } from "@/pages/partner/PartnerSignup";
import { PartnerDashboard } from "@/pages/partner/PartnerDashboard";
import { PartnerLinks } from "@/pages/partner/PartnerLinks";
import { PartnerCommissions } from "@/pages/partner/PartnerCommissions";
import { PartnerPayouts } from "@/pages/partner/PartnerPayouts";

// Booking widget (public)
import { PublicBooking } from "@/pages/public/PublicBooking";

// Marketplace (public)
import { Marketplace } from "@/pages/public/Marketplace";
import { MarketplaceListing } from "@/pages/public/MarketplaceListing";

// Admin
import { AdminReferrals } from "@/pages/admin/Referrals";
import { AdminCompliance } from "@/pages/admin/Compliance";

// Tracking
import { ReferralTracker } from "@/components/ReferralTracker";

// Reseller
import { ResellerDashboard } from "@/pages/reseller/ResellerDashboard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "")}>
          <ReferralTracker />
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
                  <Route path="/automation" component={AppAutomation} />
                  <Route path="/voice" component={AppVoice} />
                  <Route path="/contracts" component={AppMaintenanceContracts} />
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
                  <Route path="/" component={Home} />
                  <Route path="/marketplace" component={Marketplace} />
                  <Route path="/marketplace/:slug" component={MarketplaceListing} />
                  <Route path="/pricing" component={Pricing} />
                  <Route path="/features" component={Features} />
                  <Route path="/industries" component={Industries} />
                  <Route path="/integrations" component={Integrations} />
                  <Route path="/addons" component={Addons} />
                  <Route path="/security" component={Security} />
                  <Route path="/contact" component={Contact} />
                  <Route component={NotFound} />
                </Switch>
              </PublicLayout>
            </Route>
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
