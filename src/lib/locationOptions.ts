export interface CountryLocationOption {
  country: string;
  cities: string[];
}

export const HOST_LOCATION_OPTIONS: CountryLocationOption[] = [
  { country: "United States", cities: ["New York", "Los Angeles", "San Francisco", "Austin", "Chicago"] },
  { country: "Canada", cities: ["Toronto", "Vancouver", "Montreal", "Calgary"] },
  { country: "United Kingdom", cities: ["London", "Manchester", "Edinburgh", "Birmingham"] },
  { country: "Germany", cities: ["Berlin", "Munich", "Hamburg", "Frankfurt"] },
  { country: "France", cities: ["Paris", "Lyon", "Marseille", "Nice"] },
  { country: "Spain", cities: ["Barcelona", "Madrid", "Valencia", "Seville"] },
  { country: "Italy", cities: ["Rome", "Milan", "Florence", "Venice"] },
  { country: "Switzerland", cities: ["Zurich", "Geneva", "Lausanne", "Basel"] },
  { country: "Netherlands", cities: ["Amsterdam", "Rotterdam", "Utrecht", "The Hague"] },
  { country: "Belgium", cities: ["Brussels", "Antwerp", "Ghent", "Leuven"] },
  { country: "Sweden", cities: ["Stockholm", "Gothenburg", "Malmö", "Uppsala"] },
  { country: "Norway", cities: ["Oslo", "Bergen", "Trondheim", "Stavanger"] },
  { country: "Finland", cities: ["Helsinki", "Espoo", "Tampere", "Turku"] },
  { country: "Denmark", cities: ["Copenhagen", "Aarhus", "Odense", "Aalborg"] },
  { country: "Poland", cities: ["Warsaw", "Kraków", "Gdańsk", "Wrocław"] },
  { country: "Czech Republic", cities: ["Prague", "Brno", "Ostrava", "Plzeň"] },
  { country: "Austria", cities: ["Vienna", "Salzburg", "Graz", "Innsbruck"] },
  { country: "Portugal", cities: ["Lisbon", "Porto", "Coimbra", "Faro"] },
  { country: "Ireland", cities: ["Dublin", "Cork", "Galway", "Limerick"] },
  { country: "Australia", cities: ["Sydney", "Melbourne", "Brisbane", "Perth"] },
  { country: "New Zealand", cities: ["Auckland", "Wellington", "Christchurch", "Queenstown"] },
  { country: "Japan", cities: ["Tokyo", "Osaka", "Kyoto", "Sapporo"] },
  { country: "Singapore", cities: ["Singapore"] },
];

export const SEARCH_LOCATION_LIMITS = {
  countries: ["Switzerland"],
  citiesByCountry: {
    Switzerland: [
      "Zurich",
      "Geneva",
      "Lausanne",
      "Basel",
      "Bern",
      "Winterthur",
      "Lucerne",
      "St. Gallen",
      "Lugano",
      "Biel/Bienne",
      "Thun",
      "La Chaux-de-Fonds",
    ],
  } as Record<string, string[]>,
};

export const CITY_REGION_KEYWORDS: Record<string, string[]> = {
  lausanne: [
    "lausanne",
    "renens",
    "crissier",
    "ecublens",
    "epalinges",
    "pully",
    "lutry",
    "morges",
    "prilly",
    "romanel",
    "savigny",
    "bussigny",
    "oreges",
    "st-sulpice",
  ],
};

export const getCitiesForCountry = (country: string | null | undefined) => {
  if (!country) {
    return [];
  }
  const option = HOST_LOCATION_OPTIONS.find((item) => item.country === country);
  return option?.cities ?? [];
};
