// What #4471 holds, read from what each report shows, not from what intake tagged it.
// causes.ts places a report by its tenant and channel, and the desk counts it there.
// A report the desk read as a one-day move (desk-notes.json) shows a different problem, the date
// moves by a day; like the desk's own table, it stays counted where it is filed and is also listed here.
import { causeOf, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'one-day' | 'unplaced';

export const PROBLEMS: Record<Problem, string> = {
  parser: 'the shared parser reads day-first dates month first: day and month swap',
  hint: 'booking-v3 prints MM/DD/YYYY under its date field; people type month first and the form reads day first',
  'one-day': 'the date moves by one day; day and month do not swap',
  unplaced: 'no tenant on file, or a tenant that writes the month first',
};

export function problemOf(r: Report, t: Tenant | undefined, oneDayMove: readonly string[]): Problem {
  if (oneDayMove.includes(r.id)) return 'one-day';
  return causeOf(r, t) ?? 'unplaced';
}

export type ProblemGroup = { problem: Problem; reports: Report[]; tenants: string[]; firstSeen: string; lastSeen: string; taggedAs: Record<string, number> };

export function groupByProblem(
  rows: Report[],
  ticket: number,
  tenantOf: (r: Report) => Tenant | undefined,
  oneDayMove: readonly string[],
): { rows: number; unique: number; groups: ProblemGroup[] } {
  const merged = uniqueById(rows).filter((r) => r.mergedInto === ticket);
  const by = new Map<Problem, Report[]>();
  const add = (p: Problem, r: Report) => by.set(p, [...(by.get(p) ?? []), r]);
  for (const r of merged) {
    add(causeOf(r, tenantOf(r)) ?? 'unplaced', r);
    if (oneDayMove.includes(r.id)) add('one-day', r);
  }
  const groups = [...by.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        reports: rs,
        tenants: [...new Set(rs.map((r) => r.tenant))].sort(),
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
        taggedAs: rs.reduce<Record<string, number>>((n, r) => ({ ...n, [r.meta.intakeTag]: (n[r.meta.intakeTag] ?? 0) + 1 }), {}),
      };
    })
    .sort((a, b) => b.reports.length - a.reports.length);
  return { rows: rows.filter((r) => r.mergedInto === ticket).length, unique: merged.length, groups };
}
