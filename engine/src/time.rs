//! Minimal UTC timestamp handling (no chrono dependency, keeps the WASM small).

/// Parses `YYYY-MM-DD[T ]HH:MM:SS...` into Unix milliseconds (UTC).
/// Tolerates the stray quotes Discord wraps event timestamps in (`"\"2025-07-04T11:27:56Z\""`).
pub fn parse_ms(s: &str) -> Option<i64> {
    let s = s.trim_matches(|c| c == '"' || c == '\\');
    if s.len() < 19 {
        return None;
    }
    let n = |a: usize, b: usize| s.get(a..b)?.parse::<i64>().ok();
    let (y, mo, d) = (n(0, 4)?, n(5, 7)?, n(8, 10)?);
    let (h, mi, se) = (n(11, 13)?, n(14, 16)?, n(17, 19)?);
    let secs = days_from_civil(y, mo, d) * 86_400 + h * 3600 + mi * 60 + se;
    Some(secs * 1000)
}

/// Days since 1970-01-01 (Howard Hinnant's algorithm).
pub fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// Unix ms at the start of the given UTC date.
pub fn date_ms(y: i64, m: i64, d: i64) -> i64 {
    days_from_civil(y, m, d) * 86_400_000
}

/// Month index 0..=11 of a Unix ms timestamp.
pub fn month_of(ms: i64) -> usize {
    let z = ms.div_euclid(86_400_000) + 719_468;
    let doe = z - z.div_euclid(146_097) * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (m - 1) as usize
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_both_formats() {
        let a = parse_ms("\"2025-07-04T11:27:56Z\"").unwrap();
        let b = parse_ms("2025-07-04 11:27:56").unwrap();
        assert_eq!(a, b);
        assert_eq!(a, 1_751_628_476_000);
        assert_eq!(parse_ms("\"2025-07-04T11:27:56.123Z\""), Some(a));
        assert_eq!(parse_ms("nope"), None);
    }

    #[test]
    fn months() {
        assert_eq!(month_of(date_ms(2025, 1, 1)), 0);
        assert_eq!(month_of(date_ms(2025, 12, 31)), 11);
        assert_eq!(month_of(date_ms(2024, 2, 29)), 1);
    }
}
