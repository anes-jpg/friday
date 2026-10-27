# ADR 014: Native IANA reminder schedules

Status: Accepted for the local Windows candidate

New reminder schedules must default to Africa/Algiers, while existing cron records
retain UTC. Schedule calculation belongs to the Rust scheduler and must handle
local dates, weekdays, timezone offsets and daylight-saving transitions.

Add direct `chrono` 0.4 and `chrono-tz` 0.10 dependencies. Chrono is already a
transitive dependency of the installed scheduler; chrono-tz supplies an embedded
IANA timezone database without a network service or Python orchestration.

Store schedule intent and timezone separately from the next UTC execution
timestamp. Daily and weekday reminders use local wall-clock time. A nonexistent
local time is skipped; an ambiguous local time uses its first future occurrence.
Existing cron records are left unchanged and evaluated in their stored UTC zone.

Only reviewed notifications and read-only checks execute unattended. Mutating
requests remain interactive and require AgentCore's approval flow. Execution
history records actual attempts, failure and interruption rather than fake runs.
