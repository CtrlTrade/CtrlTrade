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
import { PlaceholderPage } from "@/components/PlaceholderPage";

// Admin
import { AdminDashboard } from "@/pages/admin/Dashboard";
import { AdminTenants } from "@/pages/admin/Tenants";
import { AdminTenantDetail } from "@/pages/admin/TenantDetail";
import { AdminFeatureFlags } from "@/pages/admin/FeatureFlags";
import { AdminWorkers } from "@/pages/admin/Workers";
import { AdminUsage } from "@/pages/admin/Usage";

// Customer portal
import { PortalLayout } from "@/components/layout/PortalLayout";
import { PortalLogin } from "@/pages/portal/PortalLogin";
import { PortalVerify } from "@/pages/portal/PortalVerify";
import { PortalDashboard } from "@/pages/portal/PortalDashboard";
import { PortalQuote } from "@/pages/portal/PortalQuote";
import { PortalInvoice } from "@/pages/portal/PortalInvoice";
import { PortalJob } from "@/pages/portal/PortalJob";

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
                  <Route path="/:id">
                    {() => <PlaceholderPage />}
                  </Route>
                </Switch>
              </AppLayout>
            </Route>

            {/* Customer portal */}
            <Route path="/portal/:tenantSlug" nest>
              {(params) => (
                <PortalLayout>
                  <Switch>
                    <Route path="/" component={PortalLogin} />
                    <Route path="/verify" component={PortalVerify} />
                    <Route path="/app" component={PortalDashboard} />
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
                  <Route path="/feature-flags" component={AdminFeatureFlags} />
                  <Route path="/workers" component={AdminWorkers} />
                  <Route path="/usage" component={AdminUsage} />
                  <Route component={NotFound} />
                </Switch>
              </AdminLayout>
            </Route>

            {/* Public */}
            <Route>
              <PublicLayout>
                <Switch>
                  <Route path="/" component={Home} />
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
