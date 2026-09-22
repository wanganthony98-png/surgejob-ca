/**
 * Canadian role / HQ location formatting.
 * Target: "City, Province Code" (e.g. "Toronto, ON") or "Remote" / "Remote (Canada)".
 */

const PROVINCE_CODES: Record<string, string> = {
  ontario: "ON",
  on: "ON",
  quebec: "QC",
  qc: "QC",
  "british columbia": "BC",
  bc: "BC",
  alberta: "AB",
  ab: "AB",
  manitoba: "MB",
  mb: "MB",
  saskatchewan: "SK",
  sk: "SK",
  "nova scotia": "NS",
  ns: "NS",
  "new brunswick": "NB",
  nb: "NB",
  "newfoundland and labrador": "NL",
  newfoundland: "NL",
  nl: "NL",
  "prince edward island": "PE",
  pei: "PE",
  pe: "PE",
  yukon: "YT",
  yt: "YT",
  "northwest territories": "NT",
  nt: "NT",
  nunavut: "NU",
  nu: "NU",
};

const CITY_DEFAULTS: Record<string, string> = {
  toronto: "Toronto, ON",
  mississauga: "Mississauga, ON",
  brampton: "Brampton, ON",
  markham: "Markham, ON",
  vaughan: "Vaughan, ON",
  ottawa: "Ottawa, ON",
  waterloo: "Waterloo, ON",
  kitchener: "Kitchener, ON",
  cambridge: "Cambridge, ON",
  london: "London, ON",
  hamilton: "Hamilton, ON",
  montreal: "Montreal, QC",
  montréal: "Montreal, QC",
  laval: "Laval, QC",
  quebec: "Quebec City, QC",
  "quebec city": "Quebec City, QC",
  vancouver: "Vancouver, BC",
  burnaby: "Burnaby, BC",
  surrey: "Surrey, BC",
  victoria: "Victoria, BC",
  calgary: "Calgary, AB",
  edmonton: "Edmonton, AB",
  winnipeg: "Winnipeg, MB",
  saskatoon: "Saskatoon, SK",
  halifax: "Halifax, NS",
};

const REGION_TO_CITY: Record<string, string> = {
  gta: "Toronto, ON",
  "greater toronto": "Toronto, ON",
  "greater toronto area": "Toronto, ON",
  "sw ontario": "Waterloo, ON",
  "southwestern ontario": "Waterloo, ON",
  "greater vancouver": "Vancouver, BC",
  "montreal area": "Montreal, QC",
  "ottawa region": "Ottawa, ON",
};

function titleCaseCity(value: string) {
  return value
    .split(/\s+/)
    .map((part) => {
      if (/^[A-Z]{2}$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Sanitize a raw location string into "City, XX" or "Remote" / "Remote (Canada)".
 */
export function sanitizeRoleLocation(raw: string | null | undefined): string {
  if (!raw) return "Remote (Canada)";
  let text = String(raw).replace(/\s+/g, " ").trim();
  if (!text) return "Remote (Canada)";

  if (/^remote(\s*\(?\s*canada\s*\)?)?$/i.test(text) || /^canada(\s*only)?$/i.test(text)) {
    return /canada/i.test(text) || /^canada/i.test(text) ? "Remote (Canada)" : "Remote";
  }
  if (/remote/i.test(text) && /canada/i.test(text)) return "Remote (Canada)";
  if (/^remote\b/i.test(text)) return "Remote";

  const lower = text.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();

  if (REGION_TO_CITY[lower]) return REGION_TO_CITY[lower];
  if (CITY_DEFAULTS[lower]) return CITY_DEFAULTS[lower];

  // Province-only → map code; prefer Remote (Canada) over bare province name.
  if (PROVINCE_CODES[lower] && lower.length <= 20 && !/\d/.test(lower)) {
    const code = PROVINCE_CODES[lower];
    // User asked Ontario → ON; bare codes are still vague for filters — keep code only if already short.
    if (/^(on|qc|bc|ab|mb|sk|ns|nb|nl|pe|yt|nt|nu)$/i.test(lower)) return code.toUpperCase();
    return code;
  }

  // "City, Province" or "City Province"
  const cityProv = text.match(
    /^([A-Za-zÀ-ÿ .'-]+?)\s*,\s*([A-Za-z .]+)$/,
  ) || text.match(/^([A-Za-zÀ-ÿ .'-]+?)\s+(Ontario|Quebec|British Columbia|Alberta|Manitoba|Saskatchewan|ON|QC|BC|AB|MB|SK|NS|NB|NL|PE)\s*$/i);

  if (cityProv) {
    const cityRaw = cityProv[1].trim();
    const provRaw = cityProv[2].trim().toLowerCase();
    const code = PROVINCE_CODES[provRaw] || (/^[a-z]{2}$/i.test(provRaw) ? provRaw.toUpperCase() : null);
    const cityKey = cityRaw.toLowerCase();
    if (CITY_DEFAULTS[cityKey]) return CITY_DEFAULTS[cityKey];
    if (code) return `${titleCaseCity(cityRaw)}, ${code}`;
  }

  // Contains a known city token
  for (const [city, formatted] of Object.entries(CITY_DEFAULTS)) {
    if (lower.includes(city)) return formatted;
  }
  for (const [region, formatted] of Object.entries(REGION_TO_CITY)) {
    if (lower.includes(region)) return formatted;
  }

  // Strip trailing ", Canada"
  text = text.replace(/,?\s*canada\s*$/i, "").trim();
  if (!text) return "Remote (Canada)";

  // Still vague
  if (/^(ontario|quebec|british columbia|alberta|canada|gta)$/i.test(text)) {
    const mapped = PROVINCE_CODES[text.toLowerCase()];
    return mapped || "Remote (Canada)";
  }

  return text;
}

export const ROLE_LOCATION_FORMAT_RULES = `Role / job location formatting (STRICT):
- Canadian cities MUST be "City, Province Code" (e.g. "Toronto, ON", "Vancouver, BC", "Montreal, QC").
- Remote roles MUST be "Remote" or "Remote (Canada)".
- FORBIDDEN vague strings: "Ontario", "Canada", "Greater Toronto Area", "GTA", province names alone.
- Never invent a city; if only province/country is known, use "Remote (Canada)".`;
