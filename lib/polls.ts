import { supabase } from '@/lib/supabase';

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  /** The option id the current user voted for, or null if they haven't voted. */
  myOptionId: string | null;
}

export function totalVotes(poll: Poll): number {
  return poll.options.reduce((sum, o) => sum + o.votes, 0);
}

export function hasVoted(poll: Poll): boolean {
  return poll.myOptionId != null;
}

/**
 * The (max 2) active polls with their options, live vote counts, and the
 * current user's own vote. Mirrors the Flutter PollRepository — backed by
 * `polls` / `poll_options` / `poll_votes` (+ the `active_poll_results`
 * SECURITY DEFINER RPC for per-option counts across all voters). Returns []
 * on any error so the Socials screen just hides the polls section.
 */
export async function fetchActivePolls(): Promise<Poll[]> {
  try {
    const { data: pollRows } = await supabase
      .from('polls')
      .select('id, question')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(2);

    const polls = (pollRows ?? []) as Array<Record<string, unknown>>;
    if (polls.length === 0) return [];
    const pollIds = polls.map((p) => String(p.id));

    const { data: optionRows } = await supabase
      .from('poll_options')
      .select('id, poll_id, label, sort_order')
      .in('poll_id', pollIds)
      .order('sort_order', { ascending: true });

    // Per-option vote counts (across everyone) via SECURITY DEFINER RPC.
    const { data: countRows } = await supabase.rpc('active_poll_results');
    const counts: Record<string, number> = {};
    for (const r of (countRows ?? []) as Array<Record<string, unknown>>) {
      counts[String(r.option_id)] = Number(r.votes ?? 0);
    }

    // The current user's own votes (one per poll at most).
    const myVotes: Record<string, string> = {};
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (uid) {
      const { data: voteRows } = await supabase
        .from('poll_votes')
        .select('poll_id, option_id')
        .eq('user_id', uid)
        .in('poll_id', pollIds);
      for (const v of (voteRows ?? []) as Array<Record<string, unknown>>) {
        myVotes[String(v.poll_id)] = String(v.option_id);
      }
    }

    const optionsByPoll: Record<string, PollOption[]> = {};
    for (const o of (optionRows ?? []) as Array<Record<string, unknown>>) {
      const pid = String(o.poll_id);
      const oid = String(o.id);
      (optionsByPoll[pid] ??= []).push({
        id: oid,
        label: String(o.label ?? ''),
        votes: counts[oid] ?? 0,
      });
    }

    return polls.map((p) => ({
      id: String(p.id),
      question: String(p.question ?? ''),
      options: optionsByPoll[String(p.id)] ?? [],
      myOptionId: myVotes[String(p.id)] ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * Casts (or changes) the signed-in user's vote for [pollId]. One vote per
 * user per poll — the unique (poll_id, user_id) constraint + upsert let a
 * user change their choice without creating duplicates.
 */
export async function votePoll(pollId: string, optionId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from('poll_votes')
    .upsert({ poll_id: pollId, option_id: optionId, user_id: uid }, { onConflict: 'poll_id,user_id' });
  if (error) throw error;
}
