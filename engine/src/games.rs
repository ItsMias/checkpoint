//! Games, from two sources:
//!
//! - Everyone: the `game_name` field that voice events carry, so only games that were running
//!   while the user was in a voice channel.
//! - People who opted in to analytics: `launch_game`, `running_game_heartbeat` and
//!   `application_closed` in `Activity/analytics`, the full game history with playtime.
//!
//! Analytics wins whenever it has any games in the window.

use std::collections::{HashMap, HashSet};

/// A new session starts when a game hasn't been seen for this long.
const SESSION_GAP_MS: i64 = 45 * 60_000;

/// Detected apps that aren't games.
const NOT_GAMES: &[&str] = &[
    "discord", "geforce now", "modrinth", "modrinth app", "curseforge", "prism launcher",
    "steam", "epic games launcher", "battle.net", "ea app", "ubisoft connect", "xbox",
    "obsidian", "spotify", "visual studio code", "obs studio", "wallpaper engine",
    "code", "google chrome", "firefox", "microsoft edge", "opera gx", "the comet ai browser",
    "blender", "photoshop", "adobe photoshop", "medal", "overwolf",
];

/// Games are keyed case-insensitively ("VALORANT" and "Valorant" are one game) and shown with
/// the spelling seen most often.
#[derive(Default)]
pub struct Games {
    seen: HashMap<String, Vec<i64>>,
    played: HashMap<String, Played>,
    spellings: HashMap<String, HashMap<String, usize>>,
    event_ids: HashSet<String>,
}

/// One game's analytics events inside the window.
#[derive(Default)]
struct Played {
    /// Discord application ids seen for it, with counts; the most common one is used for icons.
    ids: HashMap<String, usize>,
    launches: usize,
    heartbeat_ms: i64,
    heartbeat_sessions: HashSet<String>,
    closed_ms: i64,
    closes: usize,
}

/// What an analytics game event says.
pub enum Analytics<'a> {
    /// `launch_game`.
    Launch,
    /// `running_game_heartbeat`: time since the previous heartbeat of the same session.
    Heartbeat { session: Option<&'a str>, ms: i64 },
    /// `application_closed`: length of the session that just ended.
    Closed { ms: i64 },
}

pub struct GameTotal {
    pub name: String,
    pub id: Option<String>,
    pub sessions: usize,
    /// Only known from analytics.
    pub hours: Option<f64>,
}

impl Games {
    /// Normalises a name, records its spelling, and returns the key it is counted under.
    fn key(&mut self, raw_name: &str) -> Option<String> {
        let name = normalise(raw_name)?;
        let key = name.to_lowercase();
        *self.spellings.entry(key.clone()).or_default().entry(name).or_default() += 1;
        Some(key)
    }

    fn display(&self, key: &str) -> String {
        self.spellings
            .get(key)
            .and_then(|m| m.iter().max_by(|a, b| a.1.cmp(b.1).then_with(|| b.0.cmp(a.0))).map(|(n, _)| n.clone()))
            .unwrap_or_else(|| key.to_owned())
    }

    pub fn add(&mut self, raw_name: &str, ts_ms: i64) {
        if let Some(key) = self.key(raw_name) {
            self.seen.entry(key).or_default().push(ts_ms);
        }
    }

    /// Records an analytics game event. The caller has already checked it is inside the window.
    pub fn add_analytics(&mut self, raw_name: &str, id: Option<String>, event_id: Option<&str>, ev: Analytics) {
        // Packages sometimes repeat an event; count each once.
        if let Some(e) = event_id {
            if !self.event_ids.insert(e.to_owned()) {
                return;
            }
        }
        let Some(key) = self.key(raw_name) else { return };
        let p = self.played.entry(key).or_default();
        if let Some(id) = id {
            *p.ids.entry(id).or_default() += 1;
        }
        match ev {
            Analytics::Launch => p.launches += 1,
            Analytics::Heartbeat { session, ms } => {
                // A heartbeat covers at most ~5 minutes; ignore anything absurd.
                p.heartbeat_ms += ms.clamp(0, 15 * 60_000);
                if let Some(s) = session {
                    p.heartbeat_sessions.insert(s.to_owned());
                }
            }
            Analytics::Closed { ms } => {
                p.closed_ms += ms.clamp(0, 48 * 3_600_000);
                p.closes += 1;
            }
        }
    }

    /// Whether analytics had any games (then [`Self::totals`] ignores the voice fallback).
    pub fn from_analytics(&self) -> bool {
        !self.played.is_empty()
    }

    /// Games in `[from_ms, to_ms)`, most played first.
    pub fn totals(&self, from_ms: i64, to_ms: i64) -> Vec<GameTotal> {
        if self.from_analytics() {
            let mut out: Vec<GameTotal> = self
                .played
                .iter()
                .map(|(key, p)| {
                    let ms = p.heartbeat_ms.max(p.closed_ms);
                    GameTotal {
                        name: self.display(key),
                        id: p.ids.iter().max_by(|a, b| a.1.cmp(b.1).then_with(|| b.0.cmp(a.0))).map(|(id, _)| id.clone()),
                        sessions: p.launches.max(p.heartbeat_sessions.len()).max(p.closes).max(1),
                        hours: Some(ms as f64 / 3_600_000.0),
                    }
                })
                .collect();
            out.sort_by(|a, b| {
                let h = |g: &GameTotal| g.hours.unwrap_or(0.0);
                h(b).total_cmp(&h(a)).then(b.sessions.cmp(&a.sessions)).then_with(|| a.name.cmp(&b.name))
            });
            return out;
        }
        let mut out: Vec<GameTotal> = self
            .seen
            .iter()
            .filter_map(|(key, times)| {
                let mut t: Vec<i64> = times.iter().copied().filter(|&x| x >= from_ms && x < to_ms).collect();
                if t.is_empty() {
                    return None;
                }
                t.sort_unstable();
                let sessions = 1 + t.windows(2).filter(|w| w[1] - w[0] > SESSION_GAP_MS).count();
                Some(GameTotal { name: self.display(key), id: None, sessions, hours: None })
            })
            .collect();
        out.sort_by(|a, b| b.sessions.cmp(&a.sessions).then_with(|| a.name.cmp(&b.name)));
        out
    }
}

/// Merges spelling variants ("Overwatch® 2" / "Overwatch 2", "osu!(lazer)" / "osu!") and drops non-games.
fn normalise(raw: &str) -> Option<String> {
    let mut name: String = raw.chars().filter(|c| !matches!(c, '®' | '™' | '©' | '*')).collect();
    // Window titles: "Minecraft* 26.1.2 - Multiplayer (3rd-party Server)" -> "Minecraft 26.1.2".
    if let Some((head, tail)) = name.split_once(" - ") {
        let tail = tail.to_lowercase();
        if ["multiplayer", "singleplayer", "server", "realms"].iter().any(|w| tail.contains(w)) {
            name = head.to_owned();
        }
    }
    for suffix in ["(lazer)", "(stable)", "(beta)", " on GeForce NOW"] {
        if let Some(stripped) = name.trim_end().strip_suffix(suffix) {
            name = stripped.to_owned();
        }
    }
    let mut words: Vec<&str> = name.split_whitespace().collect();
    // Drop trailing version tokens: "Obsidian v1.10.6", "Lunar Client 1.8.9 (v2.18.5-2401)".
    while let Some(last) = words.last() {
        let t = last.trim_start_matches(['(', 'v', 'V']);
        if words.len() > 1 && t.starts_with(|c: char| c.is_ascii_digit()) && t.contains('.') {
            words.pop();
        } else {
            break;
        }
    }
    let mut name = words.join(" ");
    if name.starts_with("Lunar Client") {
        name = "Minecraft".into();
    }
    if name.is_empty() || NOT_GAMES.contains(&name.to_lowercase().as_str()) {
        return None;
    }
    Some(name)
}

#[cfg(test)]
mod tests {
    use super::*;
    const M: i64 = 60_000;

    #[test]
    fn merges_variants_and_skips_apps() {
        assert_eq!(normalise("Overwatch® 2").as_deref(), Some("Overwatch 2"));
        assert_eq!(normalise("osu!(lazer)").as_deref(), Some("osu!"));
        assert_eq!(normalise("Overwatch 2 on GeForce NOW").as_deref(), Some("Overwatch 2"));
        assert_eq!(normalise("Obsidian v1.10.6"), None);
        assert_eq!(normalise("Lunar Client 1.8.9 (v2.18.5-2401)").as_deref(), Some("Minecraft"));
        assert_eq!(normalise("Minecraft* 26.1.2 - Multiplayer (3rd-party Server)").as_deref(), Some("Minecraft"));
        assert_eq!(normalise("Minecraft 1.21.4 - Singleplayer").as_deref(), Some("Minecraft"));
        assert_eq!(normalise("Overwatch 2").as_deref(), Some("Overwatch 2"));
        assert_eq!(normalise("GeForce NOW"), None);
        assert_eq!(normalise("Discord"), None);
    }

    #[test]
    fn sessions_split_on_gaps() {
        let mut g = Games::default();
        for t in [0, 5 * M, 10 * M, 200 * M, 205 * M, 1000 * M] {
            g.add("Minecraft", t);
        }
        g.add("Overwatch® 2", 0);
        g.add("Overwatch 2", 2 * M);
        let t = g.totals(0, 10_000 * M);
        assert_eq!((t[0].name.as_str(), t[0].sessions), ("Minecraft", 3));
        assert_eq!((t[1].name.as_str(), t[1].sessions), ("Overwatch 2", 1));
    }

    #[test]
    fn merges_case_variants() {
        let mut g = Games::default();
        for (name, id, ev) in [("VALORANT", "700", "a"), ("VALORANT", "700", "b"), ("Valorant", "700", "c"), ("valorant", "999", "d")] {
            g.add_analytics(name, Some(id.into()), Some(ev), Analytics::Heartbeat { session: Some(ev), ms: 5 * M });
        }
        let t = g.totals(0, 10_000 * M);
        assert_eq!(t.len(), 1);
        assert_eq!((t[0].name.as_str(), t[0].id.as_deref(), t[0].sessions), ("VALORANT", Some("700"), 4));
    }

    #[test]
    fn analytics_replaces_voice_games() {
        let mut g = Games::default();
        g.add("Overwatch 2", 0);
        g.add_analytics("Minecraft", Some("356".into()), Some("a"), Analytics::Launch);
        g.add_analytics("Minecraft", None, Some("b"), Analytics::Heartbeat { session: Some("s1"), ms: 5 * M });
        g.add_analytics("Minecraft", None, Some("b"), Analytics::Heartbeat { session: Some("s1"), ms: 5 * M });
        g.add_analytics("Minecraft", None, Some("c"), Analytics::Heartbeat { session: Some("s2"), ms: 5 * M });
        g.add_analytics("VALORANT", None, Some("d"), Analytics::Closed { ms: 60 * M });
        let t = g.totals(0, 10_000 * M);
        assert_eq!(t.len(), 2);
        assert_eq!((t[0].name.as_str(), t[0].sessions), ("VALORANT", 1));
        assert_eq!((t[1].name.as_str(), t[1].sessions, t[1].id.as_deref()), ("Minecraft", 2, Some("356")));
        assert!((t[1].hours.unwrap() - 10.0 / 60.0).abs() < 1e-9);
    }
}
