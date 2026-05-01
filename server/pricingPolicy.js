export function applyNineEndingPricing(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const rounded = Math.ceil(amount);
  const base = Math.floor(rounded / 10000) * 10000;
  const candidate = base + 9000;
  return rounded <= candidate ? candidate : base + 19000;
}
