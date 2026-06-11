/** Humanized date buckets for the history screen (PRD §9 / acceptance test 12). */

export type Bucket =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'older';

export const BUCKET_ORDER: Bucket[] = [
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'older',
];

export const BUCKET_LABELS: Record<Bucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  lastWeek: 'Last week',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  older: 'Older',
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday-start week. */
function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const dow = (day.getDay() + 6) % 7; // Mon = 0
  day.setDate(day.getDate() - dow);
  return day;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function bucketFor(timestamp: number, now: number = Date.now()): Bucket {
  const nowDate = new Date(now);
  const todayStart = startOfDay(nowDate).getTime();
  if (timestamp >= todayStart) return 'today';

  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  // Calendar-safe: compare against the actual previous day's start.
  const y = startOfDay(new Date(todayStart - 1)).getTime();
  if (timestamp >= Math.min(yesterdayStart, y)) return 'yesterday';

  const weekStart = startOfWeek(nowDate).getTime();
  if (timestamp >= weekStart) return 'thisWeek';

  const lastWeekStart = startOfWeek(new Date(weekStart - 1)).getTime();
  if (timestamp >= lastWeekStart) return 'lastWeek';

  const monthStart = startOfMonth(nowDate).getTime();
  if (timestamp >= monthStart) return 'thisMonth';

  const lastMonthStart = startOfMonth(new Date(monthStart - 1)).getTime();
  if (timestamp >= lastMonthStart) return 'lastMonth';

  return 'older';
}

export function groupByBucket<T>(
  items: T[],
  getTime: (item: T) => number,
  now: number = Date.now(),
): { bucket: Bucket; label: string; items: T[] }[] {
  const sorted = [...items].sort((a, b) => getTime(b) - getTime(a));
  const map = new Map<Bucket, T[]>();
  for (const item of sorted) {
    const b = bucketFor(getTime(item), now);
    const list = map.get(b) ?? [];
    list.push(item);
    map.set(b, list);
  }
  return BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({
    bucket: b,
    label: BUCKET_LABELS[b],
    items: map.get(b)!,
  }));
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDuration(start: number, end: number): string {
  const mins = Math.max(1, Math.round((end - start) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min`;
}
