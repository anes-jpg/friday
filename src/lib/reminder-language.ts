export interface ResolvedReminder { kind: "once"; date: string; time: string }
export function dateInZone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)
  const part = (key: string) => parts.find(p => p.type === key)?.value || ""
  return `${part("year")}-${part("month")}-${part("day")}`
}
export function resolveReminderLanguage(phrase: string, timezone: string, now = new Date()): ResolvedReminder {
  const lower = phrase.trim().toLowerCase()
  const localDate = dateInZone(now, timezone)
  let date = lower.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]
  if (/\btomorrow\b/.test(lower)) { const next = new Date(`${localDate}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1); date = next.toISOString().slice(0, 10) }
  else if (/\btoday\b/.test(lower)) date = localDate
  if (!date) throw new Error("Choose a date. You can say today, tomorrow, or a date such as 2026-11-02.")
  const match = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/)
  if (!match) throw new Error("Choose a time, such as at 9 AM or at 14:30.")
  let hour = Number(match[1]); const minute = Number(match[2] || 0)
  if (!match[2] && !match[3] && hour <= 12) throw new Error(`Choose ${hour} AM or ${hour} PM in the time field.`)
  if (match[3]) { if (hour < 1 || hour > 12) throw new Error("Use an hour between 1 and 12 with AM or PM."); hour = hour % 12 + (match[3] === "pm" ? 12 : 0) }
  if (hour > 23 || minute > 59) throw new Error("Choose a valid time.")
  const parsedDate = new Date(`${date}T12:00:00Z`)
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new Error("Choose a valid date.")
  return { kind: "once", date, time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` }
}

/** Resolve a wall clock time; reject DST gaps/folds instead of silently choosing an occurrence. */
export function previewWallTime(date: string, time: string, timezone: string, now = new Date()) {
  const wall = new Date(`${date}T${time}:00Z`).getTime()
  if (!Number.isFinite(wall)) throw new Error("Choose a valid date and time.")
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
  const candidates: number[] = []
  // IANA offsets are in whole minutes. This also detects repeated local times.
  for (let offset = -14 * 60; offset <= 14 * 60; offset++) {
    const instant = wall + offset * 60_000
    const parts = formatter.formatToParts(instant)
    const get = (type: string) => parts.find(part => part.type === type)?.value
    if (`${get("year")}-${get("month")}-${get("day")}` === date && `${get("hour")}:${get("minute")}` === time) candidates.push(instant)
  }
  if (candidates.length !== 1) throw new Error(candidates.length ? "This local time occurs twice. Choose another time." : "This local time does not exist in the selected timezone.")
  if (candidates[0] <= now.getTime()) throw new Error("Choose a future time.")
  return { timestamp: candidates[0] / 1000, description: `${new Date(candidates[0]).toLocaleString(undefined, { timeZone: timezone })} · ${timezone}` }
}
