/**
 * City price classes for the typical costs. The templates hold mid-range metro
 * prices; venues, catering and decor cost less in smaller cities. The classes are based on
 * India's X/Y/Z city classification for house-rent allowance (Ministry of Finance,
 * 7th Pay Commission): X = the eight largest metros, Y = other large cities,
 * Z = everywhere else. One local choice: the NCR and Mumbai-region suburbs count as
 * their metro, because event prices there match it. Only estimates scale; your own
 * numbers and quotes never do.
 */
export type CityClass = 'X' | 'Y' | 'Z';

/** Planning assumptions, not data: a rough discount against metro prices. */
export const CITY_COST_FACTOR: Readonly<Record<CityClass, number>> = { X: 1, Y: 0.85, Z: 0.7 };

/** A comma-separated list of lower-case city names. */
const names = (list: string): string[] => list.split(',').map((name) => name.trim());

const X_CITIES = names(`
  mumbai, bombay, thane, navi mumbai, kalyan, delhi, new delhi, delhi ncr, gurugram,
  gurgaon, noida, greater noida, ghaziabad, faridabad, bengaluru, bangalore, chennai,
  madras, hyderabad, secunderabad, kolkata, calcutta, howrah, pune, pimpri-chinchwad,
  ahmedabad`);

const Y_CITIES = names(`
  agra, ajmer, aligarh, amravati, amritsar, asansol, aurangabad, bareilly, belagavi,
  belgaum, bhavnagar, bhilai, bhopal, bhubaneswar, bikaner, bilaspur, bokaro, chandigarh,
  coimbatore, cuttack, dehradun, dhanbad, durg, erode, gorakhpur, guntur, guwahati, gwalior,
  hubballi, hubli, dharwad, indore, jabalpur, jaipur, jalandhar, jalgaon, jammu, jamnagar,
  jamshedpur, jhansi, jodhpur, kakinada, kannur, kanpur, karnal, kochi, cochin, kolhapur,
  kollam, kota, kozhikode, calicut, kurnool, lucknow, ludhiana, madurai, malappuram,
  mangaluru, mangalore, mathura, meerut, moradabad, mysuru, mysore, nagpur, nanded, nashik,
  nellore, palakkad, patna, puducherry, pondicherry, prayagraj, allahabad, raipur,
  rajahmundry, rajkot, ranchi, rourkela, saharanpur, salem, sangli, shimla, siliguri,
  solapur, srinagar, surat, thanjavur, thiruvananthapuram, trivandrum, thrissur,
  tiruchirappalli, trichy, tirunelveli, ujjain, vadodara, baroda,
  varanasi, vasai-virar, vellore, vijayawada, visakhapatnam, vizag, warangal`);

const CLASS_OF = new Map<string, CityClass>([
  ...X_CITIES.map((name) => [name, 'X'] as const),
  ...Y_CITIES.map((name) => [name, 'Y'] as const),
]);

/** "Navi Mumbai, Maharashtra" → "navi mumbai". O(n). */
const cityKey = (city: string): string =>
  (city.split(',')[0] ?? '')
    .toLowerCase()
    .replace(/\bcity\b/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();

/** The price class of a city, or null when no city is given (estimates stay at metro prices). O(n). */
export function cityClass(city: string): CityClass | null {
  const key = cityKey(city);
  if (key.length === 0) return null;
  return CLASS_OF.get(key) ?? 'Z';
}

/** Multiplier for typical costs in `city`; 1 for metros and when no city is given. O(n). */
export function cityCostFactor(city: string): number {
  const found = cityClass(city);
  return found === null ? 1 : CITY_COST_FACTOR[found];
}

/** How the estimates were priced, for the budget note. O(n). */
export function describeCityPricing(city: string): string {
  const found = cityClass(city);
  const name = city.split(',')[0]?.trim() ?? '';
  if (found === null) return 'at metro prices (no city given)';
  if (found === 'X') return `at metro prices for ${name}`;
  const below = Math.round((1 - CITY_COST_FACTOR[found]) * 100);
  const kind = found === 'Y' ? 'a large city' : 'a smaller city or town';
  return `for ${name}, ${kind}: about ${String(below)}% below metro prices`;
}
