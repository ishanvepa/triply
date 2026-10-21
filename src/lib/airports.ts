// Small display-only catalog. Unknown IATA codes remain usable without guessed metadata.
const airports: Record<string, { city: string; flag: string; timeZone: string }> = {
  ATL: { city: "Atlanta", flag: "🇺🇸", timeZone: "America/New_York" },
  BCN: { city: "Barcelona", flag: "🇪🇸", timeZone: "Europe/Madrid" },
  BER: { city: "Berlin", flag: "🇩🇪", timeZone: "Europe/Berlin" },
  CDG: { city: "Paris", flag: "🇫🇷", timeZone: "Europe/Paris" },
  FCO: { city: "Rome", flag: "🇮🇹", timeZone: "Europe/Rome" },
  JFK: { city: "New York", flag: "🇺🇸", timeZone: "America/New_York" },
  LAX: { city: "Los Angeles", flag: "🇺🇸", timeZone: "America/Los_Angeles" },
  LHR: { city: "London", flag: "🇬🇧", timeZone: "Europe/London" },
  LIS: { city: "Lisbon", flag: "🇵🇹", timeZone: "Europe/Lisbon" },
  MAD: { city: "Madrid", flag: "🇪🇸", timeZone: "Europe/Madrid" },
  SFO: { city: "San Francisco", flag: "🇺🇸", timeZone: "America/Los_Angeles" },
};

export function getAirport(code: string) {
  return Object.hasOwn(airports, code) ? airports[code] : undefined;
}
export function airportName(code: string) {
  const airport = getAirport(code);
  return airport ? `${airport.city} (${code})` : code;
}

export const airportOptions = Object.entries(airports).map(([code, airport]) => ({ code, city: airport.city }));
