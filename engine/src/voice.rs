//! Voice time, rebuilt from `leave_voice_channel` / `voice_disconnect` events.
//!
//! Both events carry how long the connection lasted, and the event timestamp is when it ended,
//! so each one gives an interval `[end - duration, end]`. The two event types overlap heavily,
//! so time is summed as the *union* of intervals, never a plain total.

use std::collections::{HashMap, HashSet};

/// Sessions longer than this are treated as logging glitches and clipped.
const MAX_SESSION_MS: i64 = 24 * 3_600_000;

/// Where the voice time was spent: a server, or a DM/group call channel.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum VoiceKey {
    Guild(String),
    Channel(String),
}

#[derive(Default)]
pub struct Voice {
    intervals: Vec<(i64, i64, VoiceKey)>,
    seen_event_ids: HashSet<String>,
}

pub struct VoiceTotals {
    pub hours: f64,
    pub by_month: [f64; 12],
    pub by_key: HashMap<VoiceKey, f64>,
    pub sessions: usize,
}

impl Voice {
    /// Records one session. `event_id` de-duplicates events that appear in several folders.
    pub fn add(&mut self, event_id: Option<&str>, end_ms: i64, duration_ms: i64, key: VoiceKey) {
        if duration_ms <= 0 {
            return;
        }
        if let Some(id) = event_id {
            if !self.seen_event_ids.insert(id.to_owned()) {
                return;
            }
        }
        let start = end_ms - duration_ms.min(MAX_SESSION_MS);
        self.intervals.push((start, end_ms, key));
    }

    pub fn is_empty(&self) -> bool {
        self.intervals.is_empty()
    }

    /// Totals for the window `[from_ms, to_ms)`.
    pub fn totals(&self, from_ms: i64, to_ms: i64) -> VoiceTotals {
        let clipped = |s: i64, e: i64| (s.max(from_ms), e.min(to_ms));

        let all: Vec<(i64, i64)> = self
            .intervals
            .iter()
            .map(|(s, e, _)| clipped(*s, *e))
            .filter(|(s, e)| e > s)
            .collect();
        let merged = union(all);

        let mut by_month = [0.0; 12];
        for &(s, e) in &merged {
            split_by_month(s, e, &mut by_month);
        }

        let mut per_key: HashMap<VoiceKey, Vec<(i64, i64)>> = HashMap::new();
        for (s, e, k) in &self.intervals {
            let (s, e) = clipped(*s, *e);
            if e > s {
                per_key.entry(k.clone()).or_default().push((s, e));
            }
        }
        let by_key = per_key
            .into_iter()
            .map(|(k, v)| (k, hours(&union(v))))
            .collect();

        VoiceTotals { hours: hours(&merged), by_month, by_key, sessions: merged.len() }
    }
}

fn union(mut v: Vec<(i64, i64)>) -> Vec<(i64, i64)> {
    v.sort_unstable();
    let mut out: Vec<(i64, i64)> = Vec::with_capacity(v.len());
    for (s, e) in v {
        match out.last_mut() {
            Some(last) if s <= last.1 => last.1 = last.1.max(e),
            _ => out.push((s, e)),
        }
    }
    out
}

fn hours(v: &[(i64, i64)]) -> f64 {
    v.iter().map(|(s, e)| (e - s) as f64).sum::<f64>() / 3_600_000.0
}

fn split_by_month(mut s: i64, e: i64, out: &mut [f64; 12]) {
    const DAY: i64 = 86_400_000;
    // Walk day by day; sessions are at most a day long so this is cheap.
    while s < e {
        let next = ((s.div_euclid(DAY)) + 1) * DAY;
        let end = next.min(e);
        out[crate::time::month_of(s)] += (end - s) as f64 / 3_600_000.0;
        s = end;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const H: i64 = 3_600_000;

    fn g(id: &str) -> VoiceKey {
        VoiceKey::Guild(id.into())
    }

    #[test]
    fn overlapping_events_are_not_double_counted() {
        let mut v = Voice::default();
        // leave_voice_channel and voice_disconnect for the same 2h session.
        v.add(Some("a"), 10 * H, 2 * H, g("1"));
        v.add(Some("b"), 10 * H + 60_000, 2 * H, g("1"));
        let t = v.totals(0, 100 * H);
        assert!((t.hours - (2.0 + 1.0 / 60.0)).abs() < 1e-9);
        assert_eq!(t.sessions, 1);
    }

    #[test]
    fn duplicate_event_ids_are_ignored() {
        let mut v = Voice::default();
        v.add(Some("x"), 5 * H, H, g("1"));
        v.add(Some("x"), 5 * H, H, g("1"));
        assert!((v.totals(0, 10 * H).hours - 1.0).abs() < 1e-9);
    }

    #[test]
    fn clipped_to_window_and_capped() {
        let mut v = Voice::default();
        v.add(None, 10 * H, 4 * H, g("1")); // 6h..10h
        assert!((v.totals(8 * H, 20 * H).hours - 2.0).abs() < 1e-9);
        let mut v = Voice::default();
        v.add(None, 100 * H, 90 * H, g("1")); // glitch, capped to 24h
        assert!((v.totals(0, 200 * H).hours - 24.0).abs() < 1e-9);
    }

    #[test]
    fn per_key_totals() {
        let mut v = Voice::default();
        v.add(None, 2 * H, H, g("1"));
        v.add(None, 2 * H, H, VoiceKey::Channel("dm".into()));
        let t = v.totals(0, 10 * H);
        assert!((t.hours - 1.0).abs() < 1e-9); // same hour, two places at once
        assert!((t.by_key[&g("1")] - 1.0).abs() < 1e-9);
        assert!((t.by_key[&VoiceKey::Channel("dm".into())] - 1.0).abs() < 1e-9);
    }
}
