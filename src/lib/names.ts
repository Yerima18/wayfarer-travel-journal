import { countries, type Country } from './countries'
import { flagCode } from './flags'
import type { Locale } from './messages'

const displayNames = new Map<Locale, Intl.DisplayNames | null>()

function namesFor(locale: Locale) {
  if (!displayNames.has(locale)) {
    try {
      displayNames.set(locale, new Intl.DisplayNames([locale], { type: 'region' }))
    } catch {
      displayNames.set(locale, null)
    }
  }
  return displayNames.get(locale) ?? null
}

const countryName = new Map(countries.map((country) => [country.id, country.name]))

/** Country name in the visitor's language, falling back to the English name from the map data. */
export function countryLabel(countryId: string, locale: Locale, fallback?: string): string {
  const english = countryName.get(countryId) ?? fallback ?? ''
  const code = flagCode(countryId)
  if (!code) return english
  const label = namesFor(locale)?.of(code.toUpperCase())
  return label && label.toUpperCase() !== code.toUpperCase() ? label : english
}

const sortedCache = new Map<Locale, Country[]>()

/** All countries, alphabetical in the visitor's language. */
export function sortedCountries(locale: Locale): Country[] {
  let list = sortedCache.get(locale)
  if (!list) {
    list = [...countries].sort((a, b) => countryLabel(a.id, locale).localeCompare(countryLabel(b.id, locale), locale))
    sortedCache.set(locale, list)
  }
  return list
}

// French names for suggested cities that differ from the English ones.
const frenchCities: Record<string, string> = {
  'Kabul': 'Kaboul', 'Herat': 'Hérat', 'Algiers': 'Alger', 'Vienna': 'Vienne', 'Salzburg': 'Salzbourg',
  'Brussels': 'Bruxelles', 'Antwerp': 'Anvers', 'Ghent': 'Gand', 'Beijing': 'Pékin', 'Guangzhou': 'Canton',
  'Lhasa': 'Lhassa', 'Cartagena': 'Carthagène', 'Copenhagen': 'Copenhague', 'Havana': 'La Havane', 'Nicosia': 'Nicosie',
  'Cairo': 'Le Caire', 'Luxor': 'Louxor', 'Aswan': 'Assouan', 'Alexandria': 'Alexandrie', 'Sharm El Sheikh': 'Charm el-Cheikh',
  'Giza': 'Gizeh', 'Addis Ababa': 'Addis-Abeba', 'Axum': 'Aksoum', 'Lapland': 'Laponie', 'Hamburg': 'Hambourg',
  'Frankfurt': 'Francfort', 'Dresden': 'Dresde', 'Athens': 'Athènes', 'Santorini': 'Santorin', 'Thessaloniki': 'Thessalonique',
  'Crete': 'Crète', 'Corfu': 'Corfou', 'Meteora': 'Météores', 'Lake Balaton': 'Lac Balaton', 'Bengaluru': 'Bangalore',
  'Tehran': 'Téhéran', 'Isfahan': 'Ispahan', 'Shiraz': 'Chiraz', 'Persepolis': 'Persépolis', 'Baghdad': 'Bagdad',
  'Basra': 'Bassora', 'Najaf': 'Nadjaf', 'Jerusalem': 'Jérusalem', 'Haifa': 'Haïfa', 'Dead Sea': 'Mer Morte',
  'Venice': 'Venise', 'Verona': 'Vérone', 'Bologna': 'Bologne', 'Sicily': 'Sicile', 'Petra': 'Pétra', 'Jerash': 'Jérash',
  'Beirut': 'Beyrouth', 'Sidon': 'Saïda', 'Maasai Mara': 'Masai Mara', 'Seoul': 'Séoul', 'Mexico City': 'Mexico',
  'Fes': 'Fès', 'Tangier': 'Tanger', 'Cape Town': 'Le Cap', 'Johannesburg': 'Johannesbourg', 'Kruger Park': 'Parc Kruger',
  'Kathmandu': 'Katmandou', 'Everest Base Camp': 'Camp de base de l’Everest', 'The Hague': 'La Haye', 'Muscat': 'Mascate',
  'Panama City': 'Panama', 'Cusco': 'Cuzco', 'Manila': 'Manille', 'Warsaw': 'Varsovie', 'Kraków': 'Cracovie',
  'Gdańsk': 'Gdansk', 'Lisbon': 'Lisbonne', 'Madeira': 'Madère', 'Azores': 'Açores', 'Bucharest': 'Bucarest',
  'Moscow': 'Moscou', 'Saint Petersburg': 'Saint-Pétersbourg', 'Sochi': 'Sotchi', 'Lake Baikal': 'Lac Baïkal',
  'Yekaterinburg': 'Ekaterinbourg', 'Riyadh': 'Riyad', 'Jeddah': 'Djeddah', 'Mecca': 'La Mecque', 'Medina': 'Médine',
  'Gorée Island': 'Île de Gorée', 'High Tatras': 'Hautes Tatras', 'Lake Bled': 'Lac de Bled', 'Gothenburg': 'Göteborg',
  'Geneva': 'Genève', 'Bern': 'Berne', 'Basel': 'Bâle', 'Damascus': 'Damas', 'Aleppo': 'Alep', 'Palmyra': 'Palmyre',
  'Kilimanjaro': 'Kilimandjaro', 'Cappadocia': 'Cappadoce', 'Kyiv': 'Kiev', 'Odesa': 'Odessa', 'Chernivtsi': 'Tchernivtsi',
  'Dubai': 'Dubaï', 'Sharjah': 'Charjah', 'London': 'Londres', 'Edinburgh': 'Édimbourg', 'New Orleans': 'La Nouvelle-Orléans',
  'Tashkent': 'Tachkent', 'Samarkand': 'Samarcande', 'Bukhara': 'Boukhara', 'Hanoi': 'Hanoï', 'Ho Chi Minh City': 'Hô Chi Minh-Ville',
  'Ha Long Bay': 'Baie d’Along', 'Sana\'a': 'Sanaa', 'Victoria Falls': 'Chutes Victoria', 'Great Zimbabwe': 'Grand Zimbabwe',
  'Bishkek': 'Bichkek', 'Osh': 'Och', 'Issyk-Kul': 'Issyk Koul', 'Shymkent': 'Chymkent', 'Ulaanbaatar': 'Oulan-Bator',
  'Gobi Desert': 'Désert de Gobi', 'Yangon': 'Rangoun', 'Inle Lake': 'Lac Inle', 'Yasawa Islands': 'Îles Yasawa',
  'McMurdo Station': 'Station McMurdo', 'Ushuaia (departure port)': 'Ushuaia (port de départ)', 'Paradise Bay': 'Baie du Paradis',
  'Kerguelen Islands': 'Îles Kerguelen', 'Crozet Islands': 'Îles Crozet', 'Québec City': 'Québec', 'Nuwara Eliya': 'Nuwara Eliya',
  'Sulaymaniyah': 'Souleimaniye', 'Tripoli': 'Tripoli', 'Doha': 'Doha', 'Prague': 'Prague', 'Munich': 'Munich', 'Cologne': 'Cologne',
  'Tallinn': 'Tallinn', 'Brasília': 'Brasilia', 'Chiang Mai': 'Chiang Maï', 'Phuket': 'Phuket', 'Bali': 'Bali', 'Taipei': 'Taipei',
  'Mumbai': 'Bombay', 'Kolkata': 'Calcutta', 'Varanasi': 'Bénarès', 'Rhodes': 'Rhodes', 'Mombasa': 'Mombasa', 'Entebbe': 'Entebbe',
  'Nouméa': 'Nouméa', 'Ankara': 'Ankara', 'Izmir': 'Izmir', 'Dnipro': 'Dnipro', 'Lviv': 'Lviv', 'Kharkiv': 'Kharkiv',
  'Wadi Rum': 'Wadi Rum', 'Gyeongju': 'Gyeongju', 'Hiroshima': 'Hiroshima', 'Tel Aviv': 'Tel Aviv', 'Zurich': 'Zurich',
}

export function cityLabel(city: string, locale: Locale): string {
  return locale === 'fr' ? frenchCities[city] ?? city : city
}
