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

// App
import { AppDashboard } from "@/pages/app/Dashboard";
import { AppSettings } from "@/pages/app/Settings";
import { AppBilling } from "@/pages/app/Billing";
import { PlaceholderPage } from "@/components/PlaceholderPage";

// Admin
import { AdminDashboard } from "@/pages/admin/Dashboard";
import { AdminTenants } from "@/pages/admin/Tenants";
import { AdminTenantDetail } from "@/pages/admin/TenantDetail";

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

            {/* App */}
            <Route path="/app" nest>
              <AppLayout>
                <Switch>
                  <Route path="/" component={AppDashboard} />
                  <Route path="/settings" component={AppSettings} />
                  <Route path="/billing" component={AppBilling} />
                  <Route path="/:id">
                    {() => <PlaceholderPage />}
                  </Route>
                </Switch>
              </AppLayout>
            </Route>

            {/* Admin */}
            <Route path="/admin" nest>
              <AdminLayout>
                <Switch>
                  <Route path="/" component={AdminDashboard} />
                  <Route path="/tenants" component={AdminTenants} />
                  <Route path="/tenants/:id" component={AdminTenantDetail} />
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
