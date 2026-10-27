import { countries } from './countries'

// ISO 3166-1 alpha-2 code for each country name used in countries.ts.
const codeByCountryName: Record<string, string> = {
  "Afghanistan": "af", "Albania": "al", "Algeria": "dz", "Angola": "ao", "Antarctica": "aq",
  "Argentina": "ar", "Armenia": "am", "Australia": "au", "Austria": "at", "Azerbaijan": "az",
  "Bahamas": "bs", "Bangladesh": "bd", "Belarus": "by", "Belgium": "be", "Belize": "bz",
  "Benin": "bj", "Bhutan": "bt", "Bolivia": "bo", "Bosnia and Herz.": "ba", "Botswana": "bw",
  "Brazil": "br", "Brunei": "bn", "Bulgaria": "bg", "Burkina Faso": "bf", "Burundi": "bi",
  "Cambodia": "kh", "Cameroon": "cm", "Canada": "ca", "Central African Rep.": "cf", "Chad": "td",
  "Chile": "cl", "China": "cn", "Colombia": "co", "Congo": "cg", "Costa Rica": "cr",
  "Croatia": "hr", "Cuba": "cu", "Cyprus": "cy", "Czechia": "cz", "Côte d'Ivoire": "ci",
  "Dem. Rep. Congo": "cd", "Denmark": "dk", "Djibouti": "dj", "Dominican Rep.": "do", "Ecuador": "ec",
  "Egypt": "eg", "El Salvador": "sv", "Eq. Guinea": "gq", "Eritrea": "er", "Estonia": "ee",
  "eSwatini": "sz", "Ethiopia": "et", "Falkland Is.": "fk", "Fiji": "fj", "Finland": "fi",
  "Fr. S. Antarctic Lands": "tf", "France": "fr", "Gabon": "ga", "Gambia": "gm", "Georgia": "ge",
  "Germany": "de", "Ghana": "gh", "Greece": "gr", "Greenland": "gl", "Guatemala": "gt",
  "Guinea": "gn", "Guinea-Bissau": "gw", "Guyana": "gy", "Haiti": "ht", "Honduras": "hn",
  "Hungary": "hu", "Iceland": "is", "India": "in", "Indonesia": "id", "Iran": "ir",
  "Iraq": "iq", "Ireland": "ie", "Israel": "il", "Italy": "it", "Jamaica": "jm",
  "Japan": "jp", "Jordan": "jo", "Kazakhstan": "kz", "Kenya": "ke", "Kuwait": "kw",
  "Kyrgyzstan": "kg", "Laos": "la", "Latvia": "lv", "Lebanon": "lb", "Lesotho": "ls",
  "Liberia": "lr", "Libya": "ly", "Lithuania": "lt", "Luxembourg": "lu", "Macedonia": "mk",
  "Madagascar": "mg", "Malawi": "mw", "Malaysia": "my", "Mali": "ml", "Mauritania": "mr",
  "Mexico": "mx", "Moldova": "md", "Mongolia": "mn", "Montenegro": "me", "Morocco": "ma",
  "Mozambique": "mz", "Myanmar": "mm", "Namibia": "na", "Nepal": "np", "Netherlands": "nl",
  "New Caledonia": "nc", "New Zealand": "nz", "Nicaragua": "ni", "Niger": "ne", "Nigeria": "ng",
  "North Korea": "kp", "Norway": "no", "Oman": "om", "Pakistan": "pk", "Palestine": "ps",
  "Panama": "pa", "Papua New Guinea": "pg", "Paraguay": "py", "Peru": "pe", "Philippines": "ph",
  "Poland": "pl", "Portugal": "pt", "Puerto Rico": "pr", "Qatar": "qa", "Romania": "ro",
  "Russia": "ru", "Rwanda": "rw", "S. Sudan": "ss", "Saudi Arabia": "sa", "Senegal": "sn",
  "Serbia": "rs", "Sierra Leone": "sl", "Slovakia": "sk", "Slovenia": "si", "Solomon Is.": "sb",
  "Somalia": "so", "South Africa": "za", "South Korea": "kr", "Spain": "es", "Sri Lanka": "lk",
  "Sudan": "sd", "Suriname": "sr", "Sweden": "se", "Switzerland": "ch", "Syria": "sy",
  "Taiwan": "tw", "Tajikistan": "tj", "Tanzania": "tz", "Thailand": "th", "Timor-Leste": "tl",
  "Togo": "tg", "Trinidad and Tobago": "tt", "Tunisia": "tn", "Turkey": "tr", "Turkmenistan": "tm",
  "Uganda": "ug", "Ukraine": "ua", "United Arab Emirates": "ae", "United Kingdom": "gb",
  "United States of America": "us", "Uruguay": "uy", "Uzbekistan": "uz", "Vanuatu": "vu",
  "Venezuela": "ve", "Vietnam": "vn", "W. Sahara": "eh", "Yemen": "ye", "Zambia": "zm", "Zimbabwe": "zw",
}

const codeById = new Map(
  countries.flatMap((country) => {
    const code = codeByCountryName[country.name]
    return code ? [[country.id, code] as const] : []
  }),
)

export function flagCode(countryId: string): string | null {
  return codeById.get(countryId) ?? null
}

/** Path to a self-hosted flag image, or null if the country has none. */
export function flagSrc(countryId: string): string | null {
  const code = flagCode(countryId)
  return code ? `/flags/${code}.svg` : null
}

/** Emoji flag for plain-text places such as <option>. Shows as letters on Windows. */
export function flagEmoji(countryId: string): string {
  const code = flagCode(countryId)
  if (!code) return ''
  return String.fromCodePoint(...Array.from(code.toUpperCase(), (char) => 127397 + char.charCodeAt(0)))
}
