// Posts store the country as an ISO 3166-1 alpha-2 code (P1); names come from
// the browser's (or Node's) Intl data, so there's no country table to ship.
const CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );

const names = new Intl.DisplayNames(["en"], { type: "region" });

const isCode = (value: string) => /^[A-Z]{2}$/.test(value);

/** The country's English name; posts from before codes kept free text, shown as typed. */
export function countryName(country: string): string {
  if (!isCode(country)) {
    return country;
  }
  try {
    return names.of(country) ?? country;
  } catch {
    return country;
  }
}

/** The flag emoji, built from regional-indicator letters; empty for free text. */
export function countryFlag(country: string): string {
  return isCode(country)
    ? String.fromCodePoint(...[...country].map((letter) => 0x1f1a5 + letter.charCodeAt(0)))
    : "";
}

export function isCountryCode(value: string): boolean {
  return isCode(value) && CODES.includes(value);
}

/** For the country picker, sorted by name. */
export const COUNTRY_OPTIONS = CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
  a.name.localeCompare(b.name),
);
