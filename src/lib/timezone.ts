export function dateStringInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function localDayBoundsUtc(date: Date, timezone: string): { start: Date; end: Date } {
  const day = dateStringInTimezone(date, timezone);
  const guess = new Date(`${day}T00:00:00.000Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset', hour: '2-digit', minute: '2-digit' }).formatToParts(guess);
  const offsetText = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT';
  const match = offsetText.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  const sign = match?.[1] === '-' ? -1 : 1;
  const offsetMinutes = match ? sign * (Number(match[2]) * 60 + Number(match[3] || 0)) : 0;
  const start = new Date(guess.getTime() - offsetMinutes * 60000);
  return { start, end: new Date(start.getTime() + 86400000) };
}
