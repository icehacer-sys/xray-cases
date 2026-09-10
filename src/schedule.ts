export function localDate(date: Date, zone = "Africa/Cairo"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function nightKey(date: Date, zone = "Africa/Cairo"): string {
  return localDate(new Date(date.getTime() - 12 * 3600000), zone);
}
/** Resolve civil time against the IANA timezone database, including DST. */
export function localSlot(day: string, hour = 22, zone = "Africa/Cairo"): Date {
  const target = Date.parse(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
  let instant = target;
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
    const delta = target - Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    if (!delta) return new Date(instant);
    instant += delta;
  }
  throw new Error(`Cannot resolve local time ${day} ${hour}:00 in ${zone}`);
}
export function nextSlot(base: Date, hour = 22, zone = "Africa/Cairo"): Date {
  const day = new Date(`${localDate(base, zone)}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return localSlot(day.toISOString().slice(0, 10), hour, zone);
}
