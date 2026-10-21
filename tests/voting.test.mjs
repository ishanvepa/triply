import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeVotes } from '../src/lib/voting.ts';

test('support includes abstentions in its denominator and identifies the current vote', () => {
  const result = summarizeVotes(['a', 'b'], ['one', 'two', 'three'], [{ user_id: 'one', proposal_id: 'a' }], 'one');
  assert.deepEqual(result, { eligible: 3, cast: 1, undecided: 2, ownVote: 'a', leaders: ['a'],
    options: [{ id: 'a', count: 1, percent: 33 }, { id: 'b', count: 0, percent: 0 }] });
});
test('departed members and removed proposals no longer count; ties remain explicit', () => {
  const result = summarizeVotes(['a', 'b'], ['one', 'two', 'three'], [
    { user_id: 'one', proposal_id: 'a' }, { user_id: 'two', proposal_id: 'b' },
    { user_id: 'left', proposal_id: 'a' }, { user_id: 'three', proposal_id: 'removed' },
  ], 'three');
  assert.deepEqual(result.leaders, ['a', 'b']);
  assert.equal(result.cast, 2);
  assert.equal(result.ownVote, null);
});
test('no votes has no leader and an empty group never divides by zero', () => {
  assert.deepEqual(summarizeVotes(['a'], [], [], 'one').options, [{ id: 'a', count: 0, percent: 0 }]);
  assert.deepEqual(summarizeVotes(['a'], ['one'], [], 'one').leaders, []);
});
