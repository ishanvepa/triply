import { airportName, getAirport } from "@/lib/airports";

export function AirportName({ code }: { code: string }) {
  const airport = getAirport(code);
  return <span>{airport && <span aria-hidden="true">{airport.flag} </span>}{airportName(code)}</span>;
}
