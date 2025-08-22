export type Cadence = 'weekly' | 'biweekly' | 'monthly';
export type Status = 'on_track' | 'at_risk' | 'off_track';

export type OwnerInfo = {
  owner?: string;
  cadence?: Cadence;
  lastCheckin?: string; // ISO date
  status?: Status;
  notes?: string;
};

export function nextDueDate(info: OwnerInfo, from: Date = new Date()): Date {
  const base = info.lastCheckin ? new Date(info.lastCheckin) : from;
  const d = new Date(base);
  const c = info.cadence || 'weekly';
  if (c === 'weekly') d.setDate(d.getDate() + 7);
  else if (c === 'biweekly') d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function needsAttention(info?: OwnerInfo): boolean {
  if (!info) return false;
  if (info.status === 'off_track') return true;
  const due = nextDueDate(info);
  const today = new Date();
  // attention if due date passed or within next 24h
  return due.getTime() <= (today.getTime() + 24 * 3600 * 1000);
}

export function statusColor(s?: Status): 'green'|'amber'|'red'|'gray' {
  if (s === 'on_track') return 'green';
  if (s === 'at_risk') return 'amber';
  if (s === 'off_track') return 'red';
  return 'gray';
}

export function formatISODate(d?: string): string {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString();
}

export function asICS(all: Record<string, OwnerInfo>, idToName: (id: string) => string): string {
  // Simple ICS with weekly/biweekly/monthly RRULEs, DTSTART = next due at 09:00 local
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MetricTrees//Owners//EN',
  ];
  const now = new Date();
  for (const [id, info] of Object.entries(all)) {
    if (!info.owner || !info.cadence) continue;
    const title = `${idToName(id)} — Check-in (${info.owner})`;
    const due = nextDueDate(info, now);
    due.setHours(9,0,0,0);

    const y = due.getFullYear();
    const m = String(due.getMonth()+1).padStart(2,'0');
    const d = String(due.getDate()).padStart(2,'0');
    const hh = String(due.getHours()).padStart(2,'0');
    const mm = String(due.getMinutes()).padStart(2,'0');
    const dtstart = `${y}${m}${d}T${hh}${mm}00`;

    const rule = info.cadence === 'weekly'
      ? 'RRULE:FREQ=WEEKLY'
      : info.cadence === 'biweekly'
        ? 'RRULE:FREQ=WEEKLY;INTERVAL=2'
        : 'RRULE:FREQ=MONTHLY';

    lines.push(
      'BEGIN:VEVENT',
      `UID:${cryptoRandom()}`,
      `DTSTAMP:${dtstart}`,
      `DTSTART:${dtstart}`,
      `SUMMARY:${escapeICS(title)}`,
      rule,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function escapeICS(s: string): string {
  return s.replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
}

function cryptoRandom(): string {
  // lightweight UUID-ish
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random()*16)|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}
