import type { Database } from "../../types/database.types.ts";

type Tables = Database["public"]["Tables"];
export type DashboardLeg = Pick<Tables["trip_legs"]["Row"],
  "id" | "origin_airport" | "destination_airport" | "travel_date" | "position" | "selected_proposal_id">;
export type DashboardProposal = Pick<Tables["flight_proposals"]["Row"], "id" | "trip_leg_id">;
export type DashboardBooking = Pick<Tables["flight_bookings"]["Row"], "trip_leg_id" | "proposal_id" | "user_id" | "status">;

export function summarizeLeg(leg: DashboardLeg, proposals: DashboardProposal[], bookings: DashboardBooking[], memberIds: string[]) {
  const options = proposals.filter(proposal => proposal.trip_leg_id === leg.id);
  const members = new Set(memberIds);
  const reports = leg.selected_proposal_id ? bookings.filter(booking =>
    booking.trip_leg_id === leg.id && booking.proposal_id === leg.selected_proposal_id && members.has(booking.user_id)) : [];
  const booked = reports.filter(report => report.status === "booked").length;
  const notJoining = reports.filter(report => report.status === "not_joining").length;
  const participating = leg.selected_proposal_id ? members.size - notJoining : 0;
  const underway = reports.some(report => report.status === "booked" || report.status === "planning_to_book");
  const status = leg.selected_proposal_id
    ? { label: underway ? "Booking underway" : "Flight selected", tone: "success" } as const
    : options.length
      ? { label: "Decision pending", tone: "accent" } as const
      : { label: "Needs options", tone: "warning" } as const;
  return { ...leg, proposalCount: options.length, booked, participating, notJoining, status };
}

export function summarizeDashboard(legs: DashboardLeg[], proposals: DashboardProposal[], bookings: DashboardBooking[], memberIds: string[]) {
  const summaries = [...legs].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .map(leg => summarizeLeg(leg, proposals, bookings, memberIds));
  return {
    legs: summaries,
    destinations: [...new Set(summaries.map(leg => leg.destination_airport))],
    totalLegs: summaries.length,
    selectedLegs: summaries.filter(leg => leg.selected_proposal_id).length,
    booked: summaries.reduce((total, leg) => total + leg.booked, 0),
    participating: summaries.reduce((total, leg) => total + leg.participating, 0),
  };
}

export type LegSummary = ReturnType<typeof summarizeLeg>;
