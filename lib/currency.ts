export const CURRENCIES: { code: string; symbol: string; name: string }[] = [
  { code: 'USD', symbol: '$',    name: 'US Dollar' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira' },
  { code: 'ZAR', symbol: 'R',   name: 'South African Rand' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  { code: 'ETB', symbol: 'Br',  name: 'Ethiopian Birr' },
  { code: 'EGP', symbol: 'E£',  name: 'Egyptian Pound' },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA' },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham' },
  { code: 'EUR', symbol: '€',   name: 'Euro' },
  { code: 'GBP', symbol: '£',   name: 'British Pound' },
];

const RATES_FROM_USD: Record<string, number> = {
  USD: 1, KES: 130, NGN: 1600, ZAR: 18.5, GHS: 15.5,
  TZS: 2700, UGX: 3750, ETB: 57, EGP: 31, XOF: 620,
  MAD: 10, EUR: 0.92, GBP: 0.79,
};

export function convertPrice(amount: number, fromCurrency: string, toCurrency: string): number {
  const fromRate = RATES_FROM_USD[fromCurrency] ?? 1;
  const toRate = RATES_FROM_USD[toCurrency] ?? 1;
  return (amount / fromRate) * toRate;
}

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

export function formatConverted(amount: number, fromCurrency: string, toCurrency: string): string {
  const converted = convertPrice(amount, fromCurrency, toCurrency);
  const symbol = getCurrencySymbol(toCurrency);
  if (converted >= 1_000_000) return `${symbol}${(converted / 1_000_000).toFixed(1)}M`;
  if (converted >= 1_000) return `${symbol}${(converted / 1_000).toFixed(0)}K`;
  return `${symbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
