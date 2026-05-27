import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  Warehouse,
  Truck,
  Users,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import {
  useListProducts,
  useListBranchStock,
  useListTradeAccounts,
  useListSuppliers,
} from "@workspace/api-client-react";

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
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tighter">CtrlTradePos® Control</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage catalogue, stock, trade accounts and purchase orders. Open the mobile app to take sales.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} data-testid={`pos-tile-${t.label.toLowerCase().replace(/\s/g, "-")}`}>
            <Card className="rounded-none border-border shadow-sm hover:bg-muted/30 cursor-pointer transition-colors">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <t.icon className="h-5 w-5 text-primary" />
                <CardTitle className="uppercase tracking-tight text-base">{t.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {t.count !== null && (
                  <div className="text-3xl font-bold tracking-tighter">{t.count}</div>
                )}
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{t.hint}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
