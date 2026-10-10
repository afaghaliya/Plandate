export function formatMoney(amount: number, currency = "INR"): string {
  if (amount === 0) return "Free";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount)}`;
  }
}

export function formatPerPerson(amount: number, currency = "INR"): string {
  return amount === 0 ? "Free" : `${formatMoney(amount, currency)}/person`;
}
