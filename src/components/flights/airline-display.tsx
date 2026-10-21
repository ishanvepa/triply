export function AirlineDisplay({ airline, flightNumber, heading = "h3" }: { airline: string; flightNumber: string | null; heading?: "h2" | "h3" }) {
  const Heading = heading;
  return <Heading className="min-w-0 break-words text-base font-bold [overflow-wrap:anywhere]">{airline}{flightNumber && ` · ${flightNumber}`}</Heading>;
}
