// Only current members and proposals contribute to the decision.
export function summarizeVotes(
  proposalIds: string[], memberIds: string[],
  votes: { user_id: string; proposal_id: string }[], userId: string,
) {
  const eligible = new Set(memberIds);
  const counts = new Map(proposalIds.map(id => [id, 0]));
  const active = new Map(votes.filter(vote => eligible.has(vote.user_id) && counts.has(vote.proposal_id))
    .map(vote => [vote.user_id, vote.proposal_id]));
  for (const id of active.values()) counts.set(id, counts.get(id)! + 1);
  const highest = Math.max(0, ...counts.values());
  const leaders = [...counts].filter(([, count]) => highest > 0 && count === highest).map(([id]) => id);
  return {
    eligible: eligible.size, cast: active.size, undecided: eligible.size - active.size,
    ownVote: active.get(userId) ?? null, leaders,
    options: proposalIds.map(id => ({ id, count: counts.get(id)!,
      percent: eligible.size ? Math.round(counts.get(id)! / eligible.size * 100) : 0 })),
  };
}
