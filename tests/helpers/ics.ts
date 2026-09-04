/** Construit un ICS minimal au format Pronote pour les cas limites. */
export interface IcsEventInput {
  uid: string;
  start: string;
  end: string;
  summary: string;
  description: string;
  location?: string;
  categories?: string;
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, ';').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildIcs(events: IcsEventInput[], calendarName = 'Calendrier - TEST'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID;LANGUAGE=fr:Test',
    'METHOD:PUBLISH',
    `X-WR-CALNAME;LANGUAGE=fr:${calendarName}`,
  ];
  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      `CATEGORIES:${ev.categories ?? 'Cours'}`,
      `UID:${ev.uid}`,
      `DTSTART:${ev.start}`,
      `DTEND:${ev.end}`,
      `SUMMARY;LANGUAGE=fr:${escapeText(ev.summary)}`,
    );
    if (ev.location !== undefined) lines.push(`LOCATION;LANGUAGE=fr:${escapeText(ev.location)}`);
    lines.push(`DESCRIPTION;LANGUAGE=fr:${escapeText(ev.description)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export function pronoteDescription(
  header: Record<string, string>,
  sections: Array<{ label: string; html: string }> = [],
): string {
  const head = Object.entries(header)
    .map(([k, v]) => `${k} : ${v}`)
    .join('\n');
  const body = sections.map((s) => `<strong>${s.label} : \n</strong>${s.html}`).join('\n');
  return body.length > 0 ? `${head}\n\n${body}` : `${head}\n`;
}
