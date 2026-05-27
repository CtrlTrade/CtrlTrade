export const PRICING = {
  currency: "gbp",
  trialDays: 30,
  controlSeat: {
    name: "Control Seat",
    productName: "CtrlTrade Control Seat",
    unitAmount: 7900, // £79.00
    amount: 79,
    interval: "month" as const,
    features: [
      "Full back-office access (CRM, jobs, quotes, invoices, scheduling, fleet, reports)",
      "User & role management",
      "Branding & company profile",
      "Per-user account with sign-in",
    ],
  },
  fieldSeat: {
    name: "Field Seat",
    productName: "CtrlTrade Field Seat",
    unitAmount: 1900, // £19.00
    amount: 19,
    interval: "month" as const,
    features: [
      "Mobile app access for crew",
      "View assigned jobs & schedule",
      "Job notes, photos & signatures",
      "Time tracking & material capture",
    ],
  },
  till: {
    name: "CtrlTradePos® Till",
    productName: "CtrlTradePos Till",
    unitAmount: 5999, // £59.99
    amount: 59.99,
    interval: "month" as const,
    features: [
      "Touchscreen point-of-sale",
      "Barcode scanning & receipts",
      "Cash drawer + card reader",
      "End-of-day reconciliation",
      "Linked to CRM customer accounts",
    ],
  },
} as const;

export function computeMonthlyTotal(controlSeats: number, fieldSeats: number, tills: number): number {
  return (
    controlSeats * PRICING.controlSeat.amount +
    fieldSeats * PRICING.fieldSeat.amount +
    tills * PRICING.till.amount
  );
}
