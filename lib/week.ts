import type { Saved } from "./storage";

// Weeks run Monday to Sunday in local time. A day counts toward the weekly goal after five
// minutes of reading. Streaks count weeks in a row that met the goal, so missing one day never
// breaks anything; only a whole week below the goal does.

export const DAY_SECONDS = 5 * 60;
const LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function startOfWeek(d: Date) {
  const start = addDays(d, -((d.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);
  return start;
}

function weekKeys(start: Date) {
  return LABELS.map((_, i) => dayKey(addDays(start, i)));
}

function countDays(days: Saved["days"], keys: string[]) {
  return keys.filter((k) => (days[k] ?? 0) >= DAY_SECONDS).length;
}

export type Week = {
  goal: number;
  days: { label: string; read: boolean; today: boolean; future: boolean }[];
  daysRead: number;
  met: boolean;
  todaySeconds: number;
  /** Weeks in a row that met the goal, including this one once it's met. */
  streak: number;
  /** Used the app before this week, fell short last week, and hasn't read yet this week. */
  freshStart: boolean;
};

export function summarizeWeek(saved: Saved, now = new Date()): Week {
  const goal = saved.weeklyGoal;
  const start = startOfWeek(now);
  const today = dayKey(now);
  const keys = weekKeys(start);
  const days = keys.map((key, i) => ({
    label: LABELS[i],
    read: (saved.days[key] ?? 0) >= DAY_SECONDS,
    today: key === today,
    future: key > today,
  }));
  const daysRead = days.filter((d) => d.read).length;
  const met = daysRead >= goal;

  // Past weeks use today's goal; earlier goals aren't kept.
  let streak = 0;
  for (let w = addDays(start, -7); streak < 520 && countDays(saved.days, weekKeys(w)) >= goal; w = addDays(w, -7)) {
    streak++;
  }
  const lastWeekMet = streak > 0;
  if (met) streak++;

  const startKey = dayKey(start);
  const usedBefore =
    Object.keys(saved.days).some((k) => k < startKey) ||
    saved.words.some((w) => new Date(w.savedAt) < start) ||
    (saved.position !== null && new Date(saved.position.at) < start);

  return {
    goal,
    days,
    daysRead,
    met,
    todaySeconds: saved.days[today] ?? 0,
    streak,
    freshStart: usedBefore && !lastWeekMet && daysRead === 0,
  };
}
