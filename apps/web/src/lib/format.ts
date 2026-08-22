export function formatCompetitionWindow(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${formatter.format(start)} — ${formatter.format(end)} UTC`;
}

export function statusLabel(status: string): string {
  return status.toLowerCase().replaceAll('_', ' ');
}
