// Currency system — ported to match the syph Flutter app (core/currency).
// The app displays the currency CODE (e.g. "UGX 5,000"), NOT the symbol.
// Full country→currency map, supported currencies, and symbols mirror
// syph/lib/core/currency so web + Flutter stay in lockstep.

// ── Country → currency code (keys are normalized lowercase) ──────────────────
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  'afghanistan': 'AFN', 'albania': 'ALL', 'algeria': 'DZD', 'andorra': 'EUR',
  'angola': 'AOA', 'antigua and barbuda': 'XCD', 'argentina': 'ARS', 'armenia': 'AMD',
  'australia': 'AUD', 'austria': 'EUR', 'azerbaijan': 'AZN', 'bahamas': 'BSD',
  'the bahamas': 'BSD', 'bahrain': 'BHD', 'bangladesh': 'BDT', 'barbados': 'BBD',
  'belarus': 'BYN', 'belgium': 'EUR', 'belize': 'BZD', 'benin': 'XOF',
  'bhutan': 'BTN', 'bolivia': 'BOB', 'bolivia, plurinational state of': 'BOB',
  'bosnia and herzegovina': 'BAM', 'botswana': 'BWP', 'brazil': 'BRL',
  'brunei': 'BND', 'brunei darussalam': 'BND', 'bulgaria': 'BGN',
  'burkina faso': 'XOF', 'burundi': 'BIF', 'cabo verde': 'CVE', 'cape verde': 'CVE',
  'cambodia': 'KHR', 'cameroon': 'XAF', 'canada': 'CAD',
  'central african republic': 'XAF', 'chad': 'XAF', 'chile': 'CLP', 'china': 'CNY',
  "people's republic of china": 'CNY', 'pr china': 'CNY', 'colombia': 'COP',
  'comoros': 'KMF', 'congo': 'XAF', 'republic of the congo': 'XAF',
  'congo brazzaville': 'XAF', 'congo-brazzaville': 'XAF', 'costa rica': 'CRC',
  "cote d'ivoire": 'XOF', "côte d'ivoire": 'XOF', 'côte d’ivoire': 'XOF',
  'ivory coast': 'XOF', 'croatia': 'EUR', 'cuba': 'CUP', 'cyprus': 'EUR',
  'czechia': 'CZK', 'czech republic': 'CZK',
  'democratic republic of the congo': 'CDF', 'dr congo': 'CDF', 'drc': 'CDF',
  'congo kinshasa': 'CDF', 'congo-kinshasa': 'CDF', 'denmark': 'DKK',
  'djibouti': 'DJF', 'dominica': 'XCD', 'dominican republic': 'DOP',
  'ecuador': 'USD', 'egypt': 'EGP', 'el salvador': 'USD',
  'equatorial guinea': 'XAF', 'eritrea': 'ERN', 'estonia': 'EUR',
  'eswatini': 'SZL', 'swaziland': 'SZL', 'ethiopia': 'ETB', 'fiji': 'FJD',
  'finland': 'EUR', 'france': 'EUR', 'gabon': 'XAF', 'gambia': 'GMD',
  'the gambia': 'GMD', 'georgia': 'GEL', 'germany': 'EUR', 'ghana': 'GHS',
  'greece': 'EUR', 'grenada': 'XCD', 'guatemala': 'GTQ', 'guinea': 'GNF',
  'guinea-bissau': 'XOF', 'guinea bissau': 'XOF', 'guyana': 'GYD', 'haiti': 'HTG',
  'honduras': 'HNL', 'hungary': 'HUF', 'iceland': 'ISK', 'india': 'INR',
  'indonesia': 'IDR', 'iran': 'IRR', 'iran, islamic republic of': 'IRR',
  'iraq': 'IQD', 'ireland': 'EUR', 'israel': 'ILS', 'italy': 'EUR',
  'jamaica': 'JMD', 'japan': 'JPY', 'jordan': 'JOD', 'kazakhstan': 'KZT',
  'kenya': 'KES', 'kiribati': 'AUD', 'kuwait': 'KWD', 'kyrgyzstan': 'KGS',
  'laos': 'LAK', 'lao pdr': 'LAK', "lao people's democratic republic": 'LAK',
  'latvia': 'EUR', 'lebanon': 'LBP', 'lesotho': 'LSL', 'liberia': 'LRD',
  'libya': 'LYD', 'liechtenstein': 'CHF', 'lithuania': 'EUR', 'luxembourg': 'EUR',
  'madagascar': 'MGA', 'malawi': 'MWK', 'malaysia': 'MYR', 'maldives': 'MVR',
  'mali': 'XOF', 'malta': 'EUR', 'marshall islands': 'USD', 'mauritania': 'MRU',
  'mauritius': 'MUR', 'mexico': 'MXN', 'micronesia': 'USD',
  'federated states of micronesia': 'USD', 'moldova': 'MDL',
  'republic of moldova': 'MDL', 'monaco': 'EUR', 'mongolia': 'MNT',
  'montenegro': 'EUR', 'morocco': 'MAD', 'mozambique': 'MZN', 'myanmar': 'MMK',
  'burma': 'MMK', 'namibia': 'NAD', 'nauru': 'AUD', 'nepal': 'NPR',
  'netherlands': 'EUR', 'holland': 'EUR', 'new zealand': 'NZD', 'nicaragua': 'NIO',
  'niger': 'XOF', 'nigeria': 'NGN', 'north korea': 'KPW',
  "democratic people's republic of korea": 'KPW', 'north macedonia': 'MKD',
  'macedonia': 'MKD', 'norway': 'NOK', 'oman': 'OMR', 'pakistan': 'PKR',
  'palau': 'USD', 'panama': 'PAB', 'papua new guinea': 'PGK', 'paraguay': 'PYG',
  'peru': 'PEN', 'philippines': 'PHP', 'poland': 'PLN', 'portugal': 'EUR',
  'qatar': 'QAR', 'romania': 'RON', 'russia': 'RUB', 'russian federation': 'RUB',
  'rwanda': 'RWF', 'saint kitts and nevis': 'XCD', 'st kitts and nevis': 'XCD',
  'saint lucia': 'XCD', 'st lucia': 'XCD',
  'saint vincent and the grenadines': 'XCD', 'st vincent and the grenadines': 'XCD',
  'samoa': 'WST', 'san marino': 'EUR', 'sao tome and principe': 'STN',
  'são tomé and príncipe': 'STN', 'são tome and príncipe': 'STN',
  'saudi arabia': 'SAR', 'senegal': 'XOF', 'serbia': 'RSD', 'seychelles': 'SCR',
  'sierra leone': 'SLE', 'singapore': 'SGD', 'slovakia': 'EUR', 'slovenia': 'EUR',
  'solomon islands': 'SBD', 'somalia': 'SOS', 'south africa': 'ZAR',
  'south korea': 'KRW', 'republic of korea': 'KRW', 'korea, republic of': 'KRW',
  'south sudan': 'SSP', 'spain': 'EUR', 'sri lanka': 'LKR', 'sudan': 'SDG',
  'suriname': 'SRD', 'sweden': 'SEK', 'switzerland': 'CHF', 'syria': 'SYP',
  'syrian arab republic': 'SYP', 'taiwan': 'TWD', 'taiwan, province of china': 'TWD',
  'tajikistan': 'TJS', 'tanzania': 'TZS', 'united republic of tanzania': 'TZS',
  'thailand': 'THB', 'timor-leste': 'USD', 'east timor': 'USD', 'togo': 'XOF',
  'tonga': 'TOP', 'trinidad and tobago': 'TTD', 'tunisia': 'TND', 'turkey': 'TRY',
  'türkiye': 'TRY', 'turkmenistan': 'TMT', 'tuvalu': 'AUD', 'uganda': 'UGX',
  'ukraine': 'UAH', 'united arab emirates': 'AED', 'uae': 'AED',
  'united kingdom': 'GBP', 'uk': 'GBP', 'great britain': 'GBP', 'britain': 'GBP',
  'england': 'GBP', 'scotland': 'GBP', 'wales': 'GBP', 'northern ireland': 'GBP',
  'united states': 'USD', 'usa': 'USD', 'us': 'USD',
  'united states of america': 'USD', 'uruguay': 'UYU', 'uzbekistan': 'UZS',
  'vanuatu': 'VUV', 'vatican city': 'EUR', 'holy see': 'EUR', 'venezuela': 'VES',
  'venezuela, bolivarian republic of': 'VES', 'vietnam': 'VND', 'viet nam': 'VND',
  'yemen': 'YER', 'zambia': 'ZMW', 'zimbabwe': 'USD',
  // territories / locale edge cases
  'hong kong': 'HKD', 'macao': 'MOP', 'macau': 'MOP', 'puerto rico': 'USD',
  'guam': 'USD', 'american samoa': 'USD', 'u.s. virgin islands': 'USD',
  'us virgin islands': 'USD', 'northern mariana islands': 'USD',
  'cayman islands': 'KYD', 'bermuda': 'BMD', 'greenland': 'DKK',
  'faroe islands': 'DKK', 'gibraltar': 'GIP', 'jersey': 'GBP', 'guernsey': 'GBP',
  'isle of man': 'GBP', 'curaçao': 'ANG', 'curacao': 'ANG', 'aruba': 'AWG',
  'sint maarten': 'ANG', 'saint martin': 'EUR', 'st martin': 'EUR',
  'martinique': 'EUR', 'guadeloupe': 'EUR', 'réunion': 'EUR', 'reunion': 'EUR',
  'mayotte': 'EUR', 'new caledonia': 'XPF', 'french polynesia': 'XPF',
  'wallis and futuna': 'XPF', 'cook islands': 'NZD', 'anguilla': 'XCD',
  'montserrat': 'XCD', 'british virgin islands': 'USD',
  'turks and caicos islands': 'USD', 'falkland islands': 'FKP',
  'saint helena': 'SHP', 'st helena': 'SHP',
};

export function getCurrencyForCountry(country: string): string {
  const key = (country ?? '').trim().toLowerCase();
  if (!key) return 'USD';
  return COUNTRY_TO_CURRENCY[key] ?? 'USD';
}

// ── Currency metadata (symbol + display name) — mirrors syph symbols ─────────
const CURRENCY_META: Record<string, { symbol: string; name: string }> = {
  AED: { symbol: 'د.إ', name: 'UAE Dirham' },
  AFN: { symbol: '؋', name: 'Afghan Afghani' },
  ALL: { symbol: 'L', name: 'Albanian Lek' },
  AMD: { symbol: '֏', name: 'Armenian Dram' },
  ANG: { symbol: 'ƒ', name: 'Netherlands Antillean Guilder' },
  AOA: { symbol: 'Kz', name: 'Angolan Kwanza' },
  ARS: { symbol: '$', name: 'Argentine Peso' },
  AUD: { symbol: '$', name: 'Australian Dollar' },
  AWG: { symbol: 'ƒ', name: 'Aruban Florin' },
  AZN: { symbol: '₼', name: 'Azerbaijani Manat' },
  BAM: { symbol: 'KM', name: 'Bosnia-Herzegovina Mark' },
  BBD: { symbol: '$', name: 'Barbadian Dollar' },
  BDT: { symbol: '৳', name: 'Bangladeshi Taka' },
  BGN: { symbol: 'лв', name: 'Bulgarian Lev' },
  BHD: { symbol: '.د.ب', name: 'Bahraini Dinar' },
  BIF: { symbol: 'FBu', name: 'Burundian Franc' },
  BMD: { symbol: '$', name: 'Bermudian Dollar' },
  BND: { symbol: '$', name: 'Brunei Dollar' },
  BOB: { symbol: 'Bs', name: 'Bolivian Boliviano' },
  BRL: { symbol: 'R$', name: 'Brazilian Real' },
  BSD: { symbol: '$', name: 'Bahamian Dollar' },
  BTN: { symbol: 'Nu.', name: 'Bhutanese Ngultrum' },
  BWP: { symbol: 'P', name: 'Botswana Pula' },
  BYN: { symbol: 'Br', name: 'Belarusian Ruble' },
  BZD: { symbol: '$', name: 'Belize Dollar' },
  CAD: { symbol: '$', name: 'Canadian Dollar' },
  CDF: { symbol: 'FC', name: 'Congolese Franc' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc' },
  CLP: { symbol: '$', name: 'Chilean Peso' },
  CNY: { symbol: '¥', name: 'Chinese Yuan' },
  COP: { symbol: '$', name: 'Colombian Peso' },
  CRC: { symbol: '₡', name: 'Costa Rican Colón' },
  CUP: { symbol: '$', name: 'Cuban Peso' },
  CVE: { symbol: '$', name: 'Cape Verdean Escudo' },
  CZK: { symbol: 'Kč', name: 'Czech Koruna' },
  DJF: { symbol: 'Fdj', name: 'Djiboutian Franc' },
  DKK: { symbol: 'kr', name: 'Danish Krone' },
  DOP: { symbol: 'RD$', name: 'Dominican Peso' },
  DZD: { symbol: 'د.ج', name: 'Algerian Dinar' },
  EGP: { symbol: 'E£', name: 'Egyptian Pound' },
  ERN: { symbol: 'Nfk', name: 'Eritrean Nakfa' },
  ETB: { symbol: 'Br', name: 'Ethiopian Birr' },
  EUR: { symbol: '€', name: 'Euro' },
  FJD: { symbol: '$', name: 'Fijian Dollar' },
  FKP: { symbol: '£', name: 'Falkland Islands Pound' },
  GBP: { symbol: '£', name: 'British Pound' },
  GEL: { symbol: '₾', name: 'Georgian Lari' },
  GHS: { symbol: '₵', name: 'Ghanaian Cedi' },
  GIP: { symbol: '£', name: 'Gibraltar Pound' },
  GMD: { symbol: 'D', name: 'Gambian Dalasi' },
  GNF: { symbol: 'FG', name: 'Guinean Franc' },
  GTQ: { symbol: 'Q', name: 'Guatemalan Quetzal' },
  GYD: { symbol: '$', name: 'Guyanese Dollar' },
  HKD: { symbol: '$', name: 'Hong Kong Dollar' },
  HNL: { symbol: 'L', name: 'Honduran Lempira' },
  HTG: { symbol: 'G', name: 'Haitian Gourde' },
  HUF: { symbol: 'Ft', name: 'Hungarian Forint' },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah' },
  ILS: { symbol: '₪', name: 'Israeli Shekel' },
  INR: { symbol: '₹', name: 'Indian Rupee' },
  IQD: { symbol: 'ع.د', name: 'Iraqi Dinar' },
  IRR: { symbol: '﷼', name: 'Iranian Rial' },
  ISK: { symbol: 'kr', name: 'Icelandic Króna' },
  JMD: { symbol: '$', name: 'Jamaican Dollar' },
  JOD: { symbol: 'JD', name: 'Jordanian Dinar' },
  JPY: { symbol: '¥', name: 'Japanese Yen' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling' },
  KGS: { symbol: 'сом', name: 'Kyrgyzstani Som' },
  KHR: { symbol: '៛', name: 'Cambodian Riel' },
  KMF: { symbol: 'CF', name: 'Comorian Franc' },
  KPW: { symbol: '₩', name: 'North Korean Won' },
  KRW: { symbol: '₩', name: 'South Korean Won' },
  KWD: { symbol: 'KD', name: 'Kuwaiti Dinar' },
  KYD: { symbol: '$', name: 'Cayman Islands Dollar' },
  KZT: { symbol: '₸', name: 'Kazakhstani Tenge' },
  LAK: { symbol: '₭', name: 'Lao Kip' },
  LBP: { symbol: 'ل.ل', name: 'Lebanese Pound' },
  LKR: { symbol: 'Rs', name: 'Sri Lankan Rupee' },
  LRD: { symbol: '$', name: 'Liberian Dollar' },
  LSL: { symbol: 'L', name: 'Lesotho Loti' },
  LYD: { symbol: 'ل.د', name: 'Libyan Dinar' },
  MAD: { symbol: 'د.م.', name: 'Moroccan Dirham' },
  MDL: { symbol: 'L', name: 'Moldovan Leu' },
  MGA: { symbol: 'Ar', name: 'Malagasy Ariary' },
  MKD: { symbol: 'ден', name: 'Macedonian Denar' },
  MMK: { symbol: 'Ks', name: 'Myanmar Kyat' },
  MNT: { symbol: '₮', name: 'Mongolian Tögrög' },
  MOP: { symbol: 'MOP$', name: 'Macanese Pataca' },
  MRU: { symbol: 'UM', name: 'Mauritanian Ouguiya' },
  MUR: { symbol: '₨', name: 'Mauritian Rupee' },
  MVR: { symbol: 'Rf', name: 'Maldivian Rufiyaa' },
  MWK: { symbol: 'MK', name: 'Malawian Kwacha' },
  MXN: { symbol: '$', name: 'Mexican Peso' },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit' },
  MZN: { symbol: 'MT', name: 'Mozambican Metical' },
  NAD: { symbol: '$', name: 'Namibian Dollar' },
  NGN: { symbol: '₦', name: 'Nigerian Naira' },
  NIO: { symbol: 'C$', name: 'Nicaraguan Córdoba' },
  NOK: { symbol: 'kr', name: 'Norwegian Krone' },
  NPR: { symbol: '₨', name: 'Nepalese Rupee' },
  NZD: { symbol: '$', name: 'New Zealand Dollar' },
  OMR: { symbol: 'ر.ع.', name: 'Omani Rial' },
  PAB: { symbol: 'B/.', name: 'Panamanian Balboa' },
  PEN: { symbol: 'S/', name: 'Peruvian Sol' },
  PGK: { symbol: 'K', name: 'Papua New Guinean Kina' },
  PHP: { symbol: '₱', name: 'Philippine Peso' },
  PKR: { symbol: '₨', name: 'Pakistani Rupee' },
  PLN: { symbol: 'zł', name: 'Polish Złoty' },
  PYG: { symbol: '₲', name: 'Paraguayan Guaraní' },
  QAR: { symbol: 'ر.ق', name: 'Qatari Riyal' },
  RON: { symbol: 'lei', name: 'Romanian Leu' },
  RSD: { symbol: 'дин.', name: 'Serbian Dinar' },
  RUB: { symbol: '₽', name: 'Russian Ruble' },
  RWF: { symbol: 'FRw', name: 'Rwandan Franc' },
  SAR: { symbol: 'ر.س', name: 'Saudi Riyal' },
  SBD: { symbol: '$', name: 'Solomon Islands Dollar' },
  SCR: { symbol: '₨', name: 'Seychellois Rupee' },
  SDG: { symbol: 'ج.س.', name: 'Sudanese Pound' },
  SEK: { symbol: 'kr', name: 'Swedish Krona' },
  SGD: { symbol: '$', name: 'Singapore Dollar' },
  SHP: { symbol: '£', name: 'Saint Helena Pound' },
  SLE: { symbol: 'Le', name: 'Sierra Leonean Leone' },
  SOS: { symbol: 'Sh', name: 'Somali Shilling' },
  SRD: { symbol: '$', name: 'Surinamese Dollar' },
  SSP: { symbol: '£', name: 'South Sudanese Pound' },
  STN: { symbol: 'Db', name: 'São Tomé & Príncipe Dobra' },
  SZL: { symbol: 'E', name: 'Swazi Lilangeni' },
  SYP: { symbol: '£', name: 'Syrian Pound' },
  THB: { symbol: '฿', name: 'Thai Baht' },
  TJS: { symbol: 'ЅМ', name: 'Tajikistani Somoni' },
  TMT: { symbol: 'm', name: 'Turkmenistani Manat' },
  TND: { symbol: 'د.ت', name: 'Tunisian Dinar' },
  TOP: { symbol: 'T$', name: 'Tongan Paʻanga' },
  TRY: { symbol: '₺', name: 'Turkish Lira' },
  TTD: { symbol: 'TT$', name: 'Trinidad & Tobago Dollar' },
  TWD: { symbol: 'NT$', name: 'New Taiwan Dollar' },
  TZS: { symbol: 'TSh', name: 'Tanzanian Shilling' },
  UAH: { symbol: '₴', name: 'Ukrainian Hryvnia' },
  UGX: { symbol: 'USh', name: 'Ugandan Shilling' },
  USD: { symbol: '$', name: 'US Dollar' },
  UYU: { symbol: '$U', name: 'Uruguayan Peso' },
  UZS: { symbol: 'soʻm', name: 'Uzbekistani Som' },
  VES: { symbol: 'Bs.', name: 'Venezuelan Bolívar' },
  VND: { symbol: '₫', name: 'Vietnamese Đồng' },
  VUV: { symbol: 'VT', name: 'Vanuatu Vatu' },
  WST: { symbol: 'WS$', name: 'Samoan Tālā' },
  XAF: { symbol: 'FCFA', name: 'Central African CFA Franc' },
  XCD: { symbol: '$', name: 'East Caribbean Dollar' },
  XOF: { symbol: 'CFA', name: 'West African CFA Franc' },
  XPF: { symbol: '₣', name: 'CFP Franc' },
  YER: { symbol: '﷼', name: 'Yemeni Rial' },
  ZAR: { symbol: 'R', name: 'South African Rand' },
  ZMW: { symbol: 'ZK', name: 'Zambian Kwacha' },
};

// Full list for the currency picker — every supported currency (was only 13).
// A curated set of popular / African currencies is hoisted to the top, then the
// rest follow alphabetically by name.
const PREFERRED_ORDER = [
  'USD', 'EUR', 'GBP', 'UGX', 'KES', 'TZS', 'RWF', 'NGN', 'GHS', 'ZAR',
  'ETB', 'EGP', 'XOF', 'XAF', 'MAD',
];

export const CURRENCIES: { code: string; symbol: string; name: string }[] = (() => {
  const all = Object.keys(CURRENCY_META);
  const preferred = PREFERRED_ORDER.filter((c) => CURRENCY_META[c]);
  const rest = all
    .filter((c) => !preferred.includes(c))
    .sort((a, b) => CURRENCY_META[a].name.localeCompare(CURRENCY_META[b].name));
  return [...preferred, ...rest].map((code) => ({
    code,
    symbol: CURRENCY_META[code].symbol,
    name: CURRENCY_META[code].name,
  }));
})();

// ── Currency → flag emoji (for the picker) — every supported currency ────────
const CURRENCY_FLAGS: Record<string, string> = {
  AED: '🇦🇪', AFN: '🇦🇫', ALL: '🇦🇱', AMD: '🇦🇲', ANG: '🇨🇼', AOA: '🇦🇴',
  ARS: '🇦🇷', AUD: '🇦🇺', AWG: '🇦🇼', AZN: '🇦🇿', BAM: '🇧🇦', BBD: '🇧🇧',
  BDT: '🇧🇩', BGN: '🇧🇬', BHD: '🇧🇭', BIF: '🇧🇮', BMD: '🇧🇲', BND: '🇧🇳',
  BOB: '🇧🇴', BRL: '🇧🇷', BSD: '🇧🇸', BTN: '🇧🇹', BWP: '🇧🇼', BYN: '🇧🇾',
  BZD: '🇧🇿', CAD: '🇨🇦', CDF: '🇨🇩', CHF: '🇨🇭', CLP: '🇨🇱', CNY: '🇨🇳',
  COP: '🇨🇴', CRC: '🇨🇷', CUP: '🇨🇺', CVE: '🇨🇻', CZK: '🇨🇿', DJF: '🇩🇯',
  DKK: '🇩🇰', DOP: '🇩🇴', DZD: '🇩🇿', EGP: '🇪🇬', ERN: '🇪🇷', ETB: '🇪🇹',
  EUR: '🇪🇺', FJD: '🇫🇯', FKP: '🇫🇰', GBP: '🇬🇧', GEL: '🇬🇪', GHS: '🇬🇭',
  GIP: '🇬🇮', GMD: '🇬🇲', GNF: '🇬🇳', GTQ: '🇬🇹', GYD: '🇬🇾', HKD: '🇭🇰',
  HNL: '🇭🇳', HTG: '🇭🇹', HUF: '🇭🇺', IDR: '🇮🇩', ILS: '🇮🇱', INR: '🇮🇳',
  IQD: '🇮🇶', IRR: '🇮🇷', ISK: '🇮🇸', JMD: '🇯🇲', JOD: '🇯🇴', JPY: '🇯🇵',
  KES: '🇰🇪', KGS: '🇰🇬', KHR: '🇰🇭', KMF: '🇰🇲', KPW: '🇰🇵', KRW: '🇰🇷',
  KWD: '🇰🇼', KYD: '🇰🇾', KZT: '🇰🇿', LAK: '🇱🇦', LBP: '🇱🇧', LKR: '🇱🇰',
  LRD: '🇱🇷', LSL: '🇱🇸', LYD: '🇱🇾', MAD: '🇲🇦', MDL: '🇲🇩', MGA: '🇲🇬',
  MKD: '🇲🇰', MMK: '🇲🇲', MNT: '🇲🇳', MOP: '🇲🇴', MRU: '🇲🇷', MUR: '🇲🇺',
  MVR: '🇲🇻', MWK: '🇲🇼', MXN: '🇲🇽', MYR: '🇲🇾', MZN: '🇲🇿', NAD: '🇳🇦',
  NGN: '🇳🇬', NIO: '🇳🇮', NOK: '🇳🇴', NPR: '🇳🇵', NZD: '🇳🇿', OMR: '🇴🇲',
  PAB: '🇵🇦', PEN: '🇵🇪', PGK: '🇵🇬', PHP: '🇵🇭', PKR: '🇵🇰', PLN: '🇵🇱',
  PYG: '🇵🇾', QAR: '🇶🇦', RON: '🇷🇴', RSD: '🇷🇸', RUB: '🇷🇺', RWF: '🇷🇼',
  SAR: '🇸🇦', SBD: '🇸🇧', SCR: '🇸🇨', SDG: '🇸🇩', SEK: '🇸🇪', SGD: '🇸🇬',
  SHP: '🇸🇭', SLE: '🇸🇱', SOS: '🇸🇴', SRD: '🇸🇷', SSP: '🇸🇸', STN: '🇸🇹',
  SZL: '🇸🇿', SYP: '🇸🇾', THB: '🇹🇭', TJS: '🇹🇯', TMT: '🇹🇲', TND: '🇹🇳',
  TOP: '🇹🇴', TRY: '🇹🇷', TTD: '🇹🇹', TWD: '🇹🇼', TZS: '🇹🇿', UAH: '🇺🇦',
  UGX: '🇺🇬', USD: '🇺🇸', UYU: '🇺🇾', UZS: '🇺🇿', VES: '🇻🇪', VND: '🇻🇳',
  VUV: '🇻🇺', WST: '🇼🇸', XAF: '🌍', XCD: '🌎', XOF: '🌍', XPF: '🇵🇫',
  YER: '🇾🇪', ZAR: '🇿🇦', ZMW: '🇿🇲',
};

export function getCurrencyFlag(code: string): string {
  return CURRENCY_FLAGS[code] ?? '💱';
}

// ── Exchange rates (units per 1 USD) — approximate; syph uses live rates ─────
const RATES_FROM_USD: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, AED: 3.67, AFN: 71, ALL: 92, AMD: 388,
  ANG: 1.79, AOA: 900, ARS: 950, AUD: 1.52, AWG: 1.79, AZN: 1.7, BAM: 1.8,
  BBD: 2, BDT: 118, BGN: 1.8, BHD: 0.376, BIF: 2900, BMD: 1, BND: 1.34,
  BOB: 6.9, BRL: 5.5, BSD: 1, BTN: 84, BWP: 13.5, BYN: 3.27, BZD: 2,
  CAD: 1.36, CDF: 2800, CHF: 0.88, CLP: 950, CNY: 7.2, COP: 4100, CRC: 520,
  CUP: 24, CVE: 101, CZK: 23, DJF: 178, DKK: 6.9, DOP: 59, DZD: 134,
  EGP: 48, ERN: 15, ETB: 120, FJD: 2.25, FKP: 0.79, GEL: 2.7, GHS: 15.5,
  GIP: 0.79, GMD: 68, GNF: 8600, GTQ: 7.75, GYD: 209, HKD: 7.8, HNL: 24.8,
  HTG: 132, HUF: 360, IDR: 15800, ILS: 3.7, INR: 84, IQD: 1310, IRR: 42000,
  ISK: 138, JMD: 157, JOD: 0.71, JPY: 150, KES: 130, KGS: 86, KHR: 4100,
  KMF: 452, KPW: 900, KRW: 1350, KWD: 0.307, KYD: 0.83, KZT: 480, LAK: 21500,
  LBP: 89500, LKR: 300, LRD: 190, LSL: 18.5, LYD: 4.85, MAD: 10, MDL: 17.7,
  MGA: 4550, MKD: 57, MMK: 2100, MNT: 3400, MOP: 8, MRU: 39.8, MUR: 46,
  MVR: 15.4, MWK: 1730, MXN: 18.5, MYR: 4.5, MZN: 63.8, NAD: 18.5, NGN: 1600,
  NIO: 36.8, NOK: 10.7, NPR: 134, NZD: 1.66, OMR: 0.385, PAB: 1, PEN: 3.75,
  PGK: 3.9, PHP: 57, PKR: 278, PLN: 3.95, PYG: 7500, QAR: 3.64, RON: 4.6,
  RSD: 108, RUB: 92, RWF: 1350, SAR: 3.75, SBD: 8.4, SCR: 13.5, SDG: 601,
  SEK: 10.6, SGD: 1.34, SHP: 0.79, SLE: 22.5, SOS: 571, SRD: 35, SSP: 130,
  STN: 22.5, SZL: 18.5, SYP: 13000, THB: 34, TJS: 10.6, TMT: 3.5, TND: 3.1,
  TOP: 2.35, TRY: 34, TTD: 6.8, TWD: 32, TZS: 2700, UAH: 41, UGX: 3750,
  UYU: 41, UZS: 12700, VES: 40, VND: 25000, VUV: 119, WST: 2.75, XAF: 605,
  XCD: 2.7, XOF: 605, XPF: 110, YER: 250, ZAR: 18.5, ZMW: 26,
};

export function convertPrice(amount: number, fromCurrency: string, toCurrency: string): number {
  const fromRate = RATES_FROM_USD[fromCurrency] ?? 1;
  const toRate = RATES_FROM_USD[toCurrency] ?? 1;
  return (amount / fromRate) * toRate;
}

/** True when we have a real exchange rate for this currency (not a 1:1 guess). */
export function hasRate(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(RATES_FROM_USD, code);
}

export function getCurrencySymbol(code: string): string {
  return CURRENCY_META[code]?.symbol ?? code;
}

/**
 * Canonical numeric price renderer — mirrors the Flutter app's
 * `CurrencyUtils.formatAmount(..., includeCode: true)`: prefix the currency
 * CODE, not the symbol (e.g. "UGX 5,000"). This is what the whole app shows.
 */
export function formatPrice(amount: number, code: string): string {
  return `${code} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatConverted(amount: number, fromCurrency: string, toCurrency: string): string {
  const converted = convertPrice(amount, fromCurrency, toCurrency);
  if (converted >= 1_000_000) return `${toCurrency} ${(converted / 1_000_000).toFixed(1)}M`;
  if (converted >= 1_000) return `${toCurrency} ${(converted / 1_000).toFixed(0)}K`;
  return formatPrice(converted, toCurrency);
}

/**
 * Canonical listing price renderer — mirrors the Flutter app's
 * `CurrencyUtils.displayListingPrice`.
 *
 * Whenever a numeric price exists we build the label ourselves so the currency
 * CODE always shows (e.g. "UGX 5,000") — matching the Flutter app, which never
 * echoes the seller's free-form text for numeric prices. If the display
 * currency differs we convert and show an "≈" approximation. Only when there is
 * NO numeric price do we fall back to the seller's price text (e.g.
 * "Negotiable", a range), then to a placeholder.
 */
export function displayListingPrice(opts: {
  priceText?: string | null;
  priceValue?: number | null;
  currencyCode?: string | null;
  targetCurrency?: string | null;
  fallback?: string;
}): string {
  const { priceText, priceValue, fallback = 'Price not set' } = opts;
  const currencyCode = opts.currencyCode || 'USD';
  const targetCurrency = opts.targetCurrency || '';

  if (priceValue != null) {
    if (targetCurrency && targetCurrency !== currencyCode) {
      return `≈ ${formatConverted(priceValue, currencyCode, targetCurrency)}`;
    }
    return formatPrice(priceValue, currencyCode);
  }
  if (priceText?.trim()) return priceText.trim();
  return fallback;
}
