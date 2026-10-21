// Small display-only catalog. Unknown IATA codes remain usable without guessed metadata.
const airports: Record<string, { city: string; flag: string }> = {
  ATL: { city: "Atlanta", flag: "🇺🇸" },
  BCN: { city: "Barcelona", flag: "🇪🇸" },
  BER: { city: "Berlin", flag: "🇩🇪" },
  CDG: { city: "Paris", flag: "🇫🇷" },
  FCO: { city: "Rome", flag: "🇮🇹" },
  JFK: { city: "New York", flag: "🇺🇸" },
  LAX: { city: "Los Angeles", flag: "🇺🇸" },
  LHR: { city: "London", flag: "🇬🇧" },
  LIS: { city: "Lisbon", flag: "🇵🇹" },
  MAD: { city: "Madrid", flag: "🇪🇸" },
  SFO: { city: "San Francisco", flag: "🇺🇸" },
};

export function getAirport(code: string) {
  return Object.hasOwn(airports, code) ? airports[code] : undefined;
}
export function airportName(code: string) {
  const airport = getAirport(code);
  return airport ? `${airport.city} (${code})` : code;
}
