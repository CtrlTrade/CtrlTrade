/**
 * Server-side renderable component tree for public marketing routes only.
 *
 * Authenticated app / admin / portal / partner sections are NOT included —
 * they are always SPA-only and never prerendered.
 *
 * All imports here must be eager (no React.lazy) so renderToString works.
 */
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PublicLayout } from "@/components/layout/PublicLayout";
import NotFound from "@/pages/not-found";

// Public pages — eager for SSR
import { Home, Features, Integrations, Addons, Security, Contact } from "@/pages/public/StaticPages";
import { Pricing }           from "@/pages/public/Pricing";
import { Industries }        from "@/pages/public/Industries";
import { CrmPage }           from "@/pages/public/CrmPage";
import { CtrlTradePosPage }  from "@/pages/public/CtrlTradePosPage";
import { CustomerPortalPage }from "@/pages/public/CustomerPortalPage";
import { AboutPage }         from "@/pages/public/AboutPage";
import { BlogPage }          from "@/pages/public/BlogPage";
import { StatusPage }        from "@/pages/public/StatusPage";
import { SeoLandingPage }    from "@/pages/public/SeoLandingPage";
import { Marketplace }       from "@/pages/public/Marketplace";
import { MarketplaceListing }from "@/pages/public/MarketplaceListing";

const ssrQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

interface AppPublicProps {
  ssrPath: string;
}

export function AppPublic({ ssrPath }: AppPublicProps) {
  return (
    <QueryClientProvider client={ssrQueryClient}>
      <WouterRouter base="" ssrPath={ssrPath}>
        <Switch>
          <Route>
            <PublicLayout>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/features" component={Features} />
                <Route path="/pricing" component={Pricing} />
                <Route path="/industries" component={Industries} />
                <Route path="/integrations" component={Integrations} />
                <Route path="/addons" component={Addons} />
                <Route path="/security" component={Security} />
                <Route path="/contact" component={Contact} />

                <Route path="/crm" component={CrmPage} />
                <Route path="/ctrltradepos" component={CtrlTradePosPage} />
                <Route path="/customer-portal" component={CustomerPortalPage} />

                <Route path="/about" component={AboutPage} />
                <Route path="/blog" component={BlogPage} />
                <Route path="/status" component={StatusPage} />

                <Route path="/marketplace" component={Marketplace} />
                <Route path="/marketplace/:slug" component={MarketplaceListing} />

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
      </WouterRouter>
    </QueryClientProvider>
  );
}
