import { getUncachableStripeClient } from "./stripeClient";

const PRODUCTS = [
  { name: "CtrlTrade Control Seat", unitAmount: 7900, currency: "gbp" },
  { name: "CtrlTrade Field Seat", unitAmount: 1900, currency: "gbp" },
  { name: "CtrlTradePos Till", unitAmount: 5999, currency: "gbp" },
];

async function main() {
  const stripe = await getUncachableStripeClient();
  for (const p of PRODUCTS) {
    const search = await stripe.products.search({
      query: `active:'true' AND name:'${p.name.replace(/'/g, "\\'")}'`,
    });
    let product = search.data[0];
    if (!product) {
      product = await stripe.products.create({ name: p.name });
      console.log(`Created product ${p.name} (${product.id})`);
    } else {
      console.log(`Product exists: ${p.name} (${product.id})`);
    }
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 50 });
    const match = prices.data.find(
      (pr) =>
        pr.unit_amount === p.unitAmount &&
        pr.currency === p.currency &&
        pr.recurring?.interval === "month",
    );
    if (!match) {
      const created = await stripe.prices.create({
        product: product.id,
        unit_amount: p.unitAmount,
        currency: p.currency,
        recurring: { interval: "month" },
      });
      console.log(`  Created price ${(p.unitAmount / 100).toFixed(2)} ${p.currency} (${created.id})`);
    } else {
      console.log(`  Price exists (${match.id})`);
    }
  }
  console.log("Done.");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
