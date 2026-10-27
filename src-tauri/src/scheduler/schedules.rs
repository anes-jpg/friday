use chrono::{DateTime, Datelike, LocalResult, NaiveDate, NaiveTime, TimeZone, Utc, Weekday};
use serde::{Deserialize, Serialize};

#[derive(Clone,Debug,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct ReminderSchedule { pub kind:String,pub time:String,pub date:Option<String> }

pub fn next_occurrence(schedule:&ReminderSchedule,timezone:&str,after:i64)->Result<i64,String> {
    let zone:chrono_tz::Tz=timezone.parse().map_err(|_|"Choose a valid IANA timezone, such as Africa/Algiers".to_string())?;
    let time=NaiveTime::parse_from_str(&schedule.time,"%H:%M").map_err(|_|"Choose a time as HH:MM".to_string())?;
    let utc=DateTime::<Utc>::from_timestamp(after,0).ok_or("Invalid schedule timestamp")?;
    let start=utc.with_timezone(&zone).date_naive();
    if !["once","daily","weekdays"].contains(&schedule.kind.as_str()) {return Err("Choose one-time, daily or weekdays".into());}
    for day in 0..370 {
        let date=if schedule.kind=="once" {
            NaiveDate::parse_from_str(schedule.date.as_deref().ok_or("Choose a one-time date")?,"%Y-%m-%d").map_err(|_|"Choose a valid date".to_string())?
        } else {start.checked_add_days(chrono::Days::new(day)).ok_or("Date out of range")?};
        if schedule.kind=="weekdays" && [Weekday::Sat,Weekday::Sun].contains(&date.weekday()) {continue;}
        let mut candidates=match zone.from_local_datetime(&date.and_time(time)) {
            LocalResult::Single(value)=>vec![value.timestamp()],
            LocalResult::Ambiguous(a,b)=>vec![a.timestamp(),b.timestamp()],
            LocalResult::None=>vec![],
        };
        candidates.sort_unstable();
        if let Some(next)=candidates.into_iter().find(|value|*value>after) {return Ok(next);}
        if schedule.kind=="once" {return Err("One-time reminder must have a valid future occurrence in its timezone".into());}
    }
    Err("No future reminder occurrence was found".into())
}
pub fn describe_occurrence(timestamp:i64,timezone:&str)->Result<String,String> {
    let zone:chrono_tz::Tz=timezone.parse().map_err(|_|"Invalid timezone".to_string())?;
    let date=DateTime::<Utc>::from_timestamp(timestamp,0).ok_or("Invalid timestamp")?;
    Ok(format!("{} · {}",date.with_timezone(&zone).format("%a %d %b %Y, %H:%M"),timezone))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn algerian_daily_weekdays_and_once_are_calculated_natively() {
        let after=Utc.with_ymd_and_hms(2026,10,23,9,0,0).unwrap().timestamp();
        let weekdays=ReminderSchedule {kind:"weekdays".into(),time:"09:00".into(),date:None};
        let next=next_occurrence(&weekdays,"Africa/Algiers",after).unwrap();
        assert_eq!(next,Utc.with_ymd_and_hms(2026,10,26,8,0,0).unwrap().timestamp());
        let daily=ReminderSchedule {kind:"daily".into(),time:"09:00".into(),date:None};
        assert_eq!(next_occurrence(&daily,"Africa/Algiers",after).unwrap(),Utc.with_ymd_and_hms(2026,10,24,8,0,0).unwrap().timestamp());
        let once=ReminderSchedule {kind:"once".into(),time:"10:00".into(),date:Some("2026-10-26".into())};
        assert_eq!(next_occurrence(&once,"UTC",after).unwrap(),Utc.with_ymd_and_hms(2026,10,26,10,0,0).unwrap().timestamp());
        assert!(next_occurrence(&once,"Invalid/Zone",after).is_err());
    }
    #[test]
    fn nonexistent_daily_time_skips_dst_gap() {
        let after=Utc.with_ymd_and_hms(2026,3,28,23,0,0).unwrap().timestamp();
        let schedule=ReminderSchedule {kind:"daily".into(),time:"02:30".into(),date:None};
        let next=next_occurrence(&schedule,"Europe/Paris",after).unwrap();
        assert_eq!(describe_occurrence(next,"Europe/Paris").unwrap(),"Mon 30 Mar 2026, 02:30 · Europe/Paris");
    }
}
