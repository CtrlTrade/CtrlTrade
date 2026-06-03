import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Package,
  Warehouse,
  Truck,
  Users,
  ClipboardList,
  BarChart3,
  Monitor,
  ExternalLink,
} from "lucide-react";
import {
  useListProducts,
  useListBranchStock,
  useListTradeAccounts,
  useListSuppliers,
} from "@workspace/api-client-react";
import { PosLicences } from "@/components/pos/PosLicences";
import { PosDownloads } from "@/components/pos/PosDownloads";

export function AppPos() {
  const { data: products } = useListProducts();
  const { data: stock } = useListBranchStock();
  const { data: trade } = useListTradeAccounts();
  const { data: suppliers } = useListSuppliers();

  const tiles = [
    { href: "/products", icon: Package, label: "Products", count: products?.length ?? 0, hint: "SKUs in catalogue" },
    { href: "/stock", icon: Warehouse, label: "Stock", count: stock?.length ?? 0, hint: "Stock lines tracked" },
    { href: "/suppliers", icon: Truck, label: "Suppliers", count: suppliers?.length ?? 0, hint: "Supply partners" },
    { href: "/trade-accounts", icon: Users, label: "Trade Accounts", count: trade?.length ?? 0, hint: "Trade pricing" },
    { href: "/supplier-orders", icon: ClipboardList, label: "Purchase Orders", count: null, hint: "Receive stock" },
    { href: "/pos/reports", icon: BarChart3, label: "Till Reports", count: null, hint: "EOD reconciliation" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">CtrlTradePos® Control</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage catalogue, stock, trade accounts and purchase orders.
          </p>
        </div>
        <Link href="/pos/till">
          <Button className="flex items-center gap-2 shrink-0" data-testid="launch-web-till">
            <Monitor className="h-4 w-4" />
            Launch Web Till
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} data-testid={`pos-tile-${t.label.toLowerCase().replace(/\s/g, "-")}`}>
            <Card className=" border-border shadow-sm hover:bg-muted/30 cursor-pointer transition-colors">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <t.icon className="h-5 w-5 text-primary" />
                <CardTitle className=" text-base">{t.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {t.count !== null && (
                  <div className="text-3xl font-bold tracking-tighter">{t.count}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">{t.hint}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <PosDownloads />

      <PosLicences />
    </div>
  );
}
