import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function MemberList({ members, currentUserId }: {
  members: { user_id: string; role: "organizer" | "member"; profile: { display_name: string } | null }[];
  currentUserId: string;
}) {
  return <Card role="region" aria-labelledby="members-heading">
    <h2 id="members-heading" className="mb-5 text-base font-bold">Group members <span className="font-normal text-secondary">({members.length})</span></h2>
    <ul aria-label="Group members" className="space-y-4">
      {members.map(member => <li key={member.user_id} className="flex min-w-0 items-center gap-3">
        <Avatar name={member.profile?.display_name || "Traveler"} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{member.profile?.display_name || "Traveler"}{member.user_id === currentUserId && <span className="font-normal text-secondary"> · You</span>}</p>
          <p className="mt-1 text-xs text-secondary">{member.role === "organizer" ? "Organizer" : "Member"}</p>
        </div>
        {member.role === "organizer" && <Badge tone="accent">Organizer</Badge>}
      </li>)}
    </ul>
  </Card>;
}
