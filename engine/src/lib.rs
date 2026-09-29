//! Checkpoint engine: turns a Discord data package into year-in-review stats.
//!
//! The caller (CLI or browser worker) owns the zip. It asks [`wanted`] which entries to read,
//! passes small files to [`Engine::feed_file`] / [`Engine::feed_channel`] and streams the big
//! events files through [`Engine::feed_events`] / [`Engine::feed_analytics`] in chunks of any
//! size. Nothing here does I/O.

pub mod emoji;
pub mod games;
pub mod persona;
pub mod time;
pub mod voice;
#[cfg(target_arch = "wasm32")]
mod wasm;

use std::collections::HashMap;

use memchr::memmem::Finder;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use emoji::Emoji;
use voice::VoiceKey;

/// What a zip entry is used for.
#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Entry {
    User,
    MessagesIndex,
    ServersIndex,
    Quests,
    ChannelMeta,
    ChannelMessages,
    /// `Activity/reporting/events-*.json`: the large, streamed file.
    Events,
    /// `Activity/tns/events-*.json`: only read when `reporting` is missing.
    EventsFallback,
    /// `Activity/analytics/events-*.json`: only in packages of people who opted in to analytics.
    /// Read for game history only.
    Analytics,
}

/// Classifies a zip entry path. Anything returning `None` is never opened, which includes
/// the `modeling` folder.
pub fn wanted(path: &str) -> Option<Entry> {
    let p = path.to_ascii_lowercase();
    let file = p.rsplit('/').next().unwrap_or("");
    match p.as_str() {
        "account/user.json" => return Some(Entry::User),
        "messages/index.json" => return Some(Entry::MessagesIndex),
        "servers/index.json" => return Some(Entry::ServersIndex),
        "ads/quests_user_status.json" => return Some(Entry::Quests),
        _ => {}
    }
    let is_events = file.starts_with("events-") && file.ends_with(".json");
    if p.starts_with("activity/reporting/") && is_events {
        return Some(Entry::Events);
    }
    if p.starts_with("activity/tns/") && is_events {
        return Some(Entry::EventsFallback);
    }
    if p.starts_with("activity/analytics/") && is_events {
        return Some(Entry::Analytics);
    }
    if p.starts_with("messages/") && p.matches('/').count() == 2 {
        return match file {
            "channel.json" => Some(Entry::ChannelMeta),
            "messages.json" => Some(Entry::ChannelMessages),
            _ => None,
        };
    }
    None
}

// ---------- output ----------

#[derive(Serialize, Debug)]
pub struct Stats {
    pub window: Window,
    pub user: Option<Person>,
    pub messages: MessageStats,
    pub emojis: EmojiStats,
    /// `None` when the package has no voice events at all.
    pub voice: Option<VoiceStats>,
    pub servers: Vec<Place>,
    pub squad: Vec<Person>,
    /// `None` when no games were seen.
    pub games: Option<GameStats>,
    pub quests: QuestStats,
    pub persona: persona::Persona,
    pub card: Card,
}

#[derive(Serialize, Debug)]
pub struct Window {
    pub from: i64,
    pub to: i64,
}

#[derive(Serialize, Debug, Clone, Default)]
pub struct Person {
    pub id: String,
    pub username: String,
    pub display_name: String,
    /// Avatar hash for `cdn.discordapp.com/avatars/{id}/{hash}`.
    pub avatar: Option<String>,
    pub messages: u64,
    pub voice_hours: f64,
}

#[derive(Serialize, Debug)]
pub struct MessageStats {
    pub total: u64,
    pub by_month: [u64; 12],
}

#[derive(Serialize, Debug)]
pub struct EmojiStats {
    pub total: u64,
    pub in_messages: u64,
    pub reactions: u64,
    pub top: Vec<EmojiCount>,
}

#[derive(Serialize, Debug)]
pub struct EmojiCount {
    /// Unicode text, or `None` for custom emoji.
    pub text: Option<String>,
    pub name: Option<String>,
    pub id: Option<String>,
    pub animated: bool,
    pub count: u64,
}

#[derive(Serialize, Debug)]
pub struct VoiceStats {
    pub hours: f64,
    pub by_month: [f64; 12],
    pub sessions: usize,
}

#[derive(Serialize, Debug)]
pub struct Place {
    pub id: String,
    pub name: String,
    pub messages: u64,
    pub voice_hours: f64,
    /// False when the package doesn't name the server (it was deleted, or you left it without
    /// sending messages there). The page then tries the invite lookup for its name.
    pub name_known: bool,
    /// Invite codes for this server, best first: ones the activity log ties to it (the invite
    /// you joined with, invites you sent), then links posted in its channels. The page resolves
    /// them to find the server icon, which the package usually doesn't include.
    pub invites: Vec<String>,
}

#[derive(Serialize, Debug)]
pub struct GameStats {
    /// `"analytics"` (full history) or `"voice"` (only games running while in voice).
    pub source: &'static str,
    pub distinct: usize,
    /// Total playtime, analytics only.
    pub hours: Option<f64>,
    pub top: Vec<GameCount>,
}

#[derive(Serialize, Debug)]
pub struct GameCount {
    pub name: String,
    /// Discord application id, when analytics had it.
    pub id: Option<String>,
    pub sessions: usize,
    pub hours: Option<f64>,
}

#[derive(Serialize, Debug)]
pub struct QuestStats {
    pub completed: u64,
}

#[derive(Serialize, Debug)]
pub struct Card {
    /// Shown as "#6155".
    pub number: u32,
    /// Shown as "LVL 287354".
    pub level: u64,
}

// ---------- input shapes ----------

#[derive(Deserialize)]
struct RawUser {
    id: String,
    username: String,
    global_name: Option<String>,
    avatar_hash: Option<String>,
    #[serde(default)]
    relationships: Vec<RawRelationship>,
}

#[derive(Deserialize)]
struct RawRelationship {
    user: RawFriend,
}

#[derive(Deserialize)]
struct RawFriend {
    id: String,
    username: String,
    global_name: Option<String>,
    avatar: Option<String>,
}

#[derive(Deserialize)]
struct RawChannel {
    id: String,
    #[serde(rename = "type")]
    kind: Value,
    guild: Option<RawGuild>,
    #[serde(default)]
    recipients: Vec<String>,
}

#[derive(Deserialize)]
struct RawGuild {
    id: String,
    name: Option<String>,
}

#[derive(Deserialize)]
struct RawMessage {
    #[serde(rename = "Timestamp")]
    timestamp: String,
    #[serde(rename = "Contents", default)]
    contents: String,
}

/// Invites kept per server.
const INVITES_PER_SERVER: usize = 8;

#[derive(Deserialize)]
struct RawEvent {
    event_type: String,
    timestamp: Option<String>,
    event_id: Option<String>,
    guild_id: Option<Value>,
    channel_id: Option<Value>,
    duration: Option<Value>,
    duration_connected_ms: Option<Value>,
    game_name: Option<String>,
    emoji_name: Option<Value>,
    // Invite events: `accepted_instant_invite` (guild, invite), `invite_sent` (invite_guild_id, invite_code).
    guild: Option<Value>,
    invite: Option<Value>,
    invite_guild_id: Option<Value>,
    invite_code: Option<Value>,
    // Analytics game events.
    game: Option<String>,
    game_id: Option<Value>,
    application_id: Option<Value>,
    application_name: Option<String>,
    game_session_id: Option<String>,
    duration_tracked_ms: Option<Value>,
    activity_duration_s: Option<Value>,
    emoji_id: Option<Value>,
    emoji_animated: Option<Value>,
}

#[derive(Deserialize)]
struct RawQuest {
    completed_at: Option<String>,
}

fn as_str(v: &Option<Value>) -> Option<String> {
    match v.as_ref()? {
        Value::String(s) if !s.is_empty() => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn as_i64(v: &Option<Value>) -> Option<i64> {
    match v.as_ref()? {
        Value::String(s) => s.parse::<f64>().ok().map(|f| f as i64),
        Value::Number(n) => n.as_f64().map(|f| f as i64),
        _ => None,
    }
}

// ---------- engine ----------

enum ChannelKind {
    Dm(Vec<String>),
    Guild(String),
    Other,
}

pub struct Engine {
    from_ms: i64,
    to_ms: i64,

    user: Option<RawUser>,
    channel_names: HashMap<String, String>,
    server_names: HashMap<String, String>,
    channels: HashMap<String, ChannelKind>,

    msgs_total: u64,
    msgs_by_month: [u64; 12],
    msgs_by_guild: HashMap<String, u64>,
    msgs_by_dm: HashMap<String, u64>,
    /// Guild id -> (from the activity log?, timestamp, invite code).
    invites: HashMap<String, Vec<(bool, i64, String)>>,
    emoji_counts: HashMap<Emoji, u64>,
    emojis_in_messages: u64,
    reactions: u64,

    voice: voice::Voice,
    games: games::Games,
    quests_completed: u64,

    carry: Vec<u8>,
    carry_is_analytics: bool,
    finders: Vec<Finder<'static>>,
    analytics_finders: Vec<Finder<'static>>,
    invite_finder: Finder<'static>,
}

impl Engine {
    /// Stats cover `[from_ms, to_ms)`.
    pub fn new(from_ms: i64, to_ms: i64) -> Self {
        let needles: [&'static [u8]; 6] = [
            b"leave_voice_channel",
            b"voice_disconnect",
            b"\"game_name\"",
            b"add_reaction",
            b"accepted_instant_invite",
            b"\"invite_sent\"",
        ];
        let analytics_needles: [&'static [u8]; 3] =
            [b"\"launch_game\"", b"\"running_game_heartbeat\"", b"\"application_closed\""];
        Self {
            from_ms,
            to_ms,
            user: None,
            channel_names: HashMap::new(),
            server_names: HashMap::new(),
            channels: HashMap::new(),
            msgs_total: 0,
            msgs_by_month: [0; 12],
            msgs_by_guild: HashMap::new(),
            msgs_by_dm: HashMap::new(),
            invites: HashMap::new(),
            emoji_counts: HashMap::new(),
            emojis_in_messages: 0,
            reactions: 0,
            voice: voice::Voice::default(),
            games: games::Games::default(),
            quests_completed: 0,
            carry: Vec::new(),
            carry_is_analytics: false,
            finders: needles.iter().map(|n| Finder::new(*n)).collect(),
            analytics_finders: analytics_needles.iter().map(|n| Finder::new(*n)).collect(),
            invite_finder: Finder::new(b"discord"),
        }
    }

    fn in_window(&self, ms: i64) -> bool {
        ms >= self.from_ms && ms < self.to_ms
    }

    /// Feeds a single small file (user, indexes, quests). Channel files go through [`Self::feed_channel`].
    pub fn feed_file(&mut self, kind: Entry, bytes: &[u8]) -> Result<(), String> {
        let err = |e: serde_json::Error| format!("{kind:?}: {e}");
        match kind {
            Entry::User => self.user = Some(serde_json::from_slice(bytes).map_err(err)?),
            Entry::MessagesIndex => {
                let m: HashMap<String, Option<String>> = serde_json::from_slice(bytes).map_err(err)?;
                self.channel_names = m.into_iter().filter_map(|(k, v)| Some((k, v?))).collect();
            }
            Entry::ServersIndex => {
                self.server_names = serde_json::from_slice(bytes).map_err(err)?;
            }
            Entry::Quests => {
                let q: Vec<RawQuest> = serde_json::from_slice(bytes).map_err(err)?;
                self.quests_completed = q
                    .iter()
                    .filter_map(|q| time::parse_ms(q.completed_at.as_deref()?))
                    .filter(|&t| self.in_window(t))
                    .count() as u64;
            }
            _ => return Err(format!("{kind:?} is not a single file")),
        }
        Ok(())
    }

    /// Feeds one `Messages/c<id>/` folder: its `channel.json` and `messages.json`.
    pub fn feed_channel(&mut self, channel_json: &[u8], messages_json: &[u8]) -> Result<(), String> {
        let ch: RawChannel = serde_json::from_slice(channel_json).map_err(|e| format!("channel.json: {e}"))?;
        let msgs: Vec<RawMessage> =
            serde_json::from_slice(messages_json).map_err(|e| format!("messages.json in {}: {e}", ch.id))?;

        let is_dm = ch.kind.as_str() == Some("DM") || ch.kind.as_i64() == Some(1);
        let kind = if let Some(g) = &ch.guild {
            if let Some(name) = &g.name {
                self.server_names.entry(g.id.clone()).or_insert_with(|| name.clone());
            }
            ChannelKind::Guild(g.id.clone())
        } else if is_dm {
            ChannelKind::Dm(ch.recipients.clone())
        } else {
            ChannelKind::Other
        };

        let mut count = 0;
        for m in &msgs {
            let Some(t) = time::parse_ms(&m.timestamp) else { continue };
            if let ChannelKind::Guild(g) = &kind {
                if self.invite_finder.find(m.contents.as_bytes()).is_some() {
                    let list = self.invites.entry(g.clone()).or_default();
                    for code in invite_codes(&m.contents) {
                        list.push((false, t, code.to_owned()));
                    }
                }
            }
            if !self.in_window(t) {
                continue;
            }
            count += 1;
            self.msgs_by_month[time::month_of(t)] += 1;
            // Each emoji counts once per message, so "<:heart:><:heart:><:heart:>" spam doesn't dominate.
            let mut in_this: Vec<Emoji> = vec![];
            emoji::for_each(&m.contents, |e| {
                if !in_this.contains(&e) {
                    in_this.push(e);
                }
            });
            self.emojis_in_messages += in_this.len() as u64;
            for e in in_this {
                *self.emoji_counts.entry(e).or_default() += 1;
            }
        }
        self.msgs_total += count;
        match &kind {
            ChannelKind::Guild(g) => *self.msgs_by_guild.entry(g.clone()).or_default() += count,
            ChannelKind::Dm(_) => *self.msgs_by_dm.entry(ch.id.clone()).or_default() += count,
            ChannelKind::Other => {}
        }
        self.channels.insert(ch.id, kind);
        Ok(())
    }

    /// Streams part of a `reporting` / `tns` events file. Chunks may split lines anywhere.
    pub fn feed_events(&mut self, chunk: &[u8]) {
        self.stream(chunk, false);
    }

    /// Streams part of an `analytics` events file (game history only).
    pub fn feed_analytics(&mut self, chunk: &[u8]) {
        self.stream(chunk, true);
    }

    fn stream(&mut self, chunk: &[u8], analytics: bool) {
        let mut buf = std::mem::take(&mut self.carry);
        buf.extend_from_slice(chunk);
        let mut start = 0;
        for nl in memchr::memchr_iter(b'\n', &buf) {
            self.line(&buf[start..nl], analytics);
            start = nl + 1;
        }
        buf.drain(..start);
        self.carry = buf;
        self.carry_is_analytics = analytics;
    }

    fn line(&mut self, line: &[u8], analytics: bool) {
        if analytics { self.analytics_line(line) } else { self.event_line(line) }
    }

    /// Call after the last chunk of each events file.
    pub fn finish_events(&mut self) {
        let rest = std::mem::take(&mut self.carry);
        self.line(&rest, self.carry_is_analytics);
    }

    fn analytics_line(&mut self, line: &[u8]) {
        if line.is_empty() || !self.analytics_finders.iter().any(|f| f.find(line).is_some()) {
            return;
        }
        let Ok(ev) = serde_json::from_slice::<RawEvent>(line) else { return };
        let Some(ts) = ev.timestamp.as_deref().and_then(time::parse_ms) else { return };
        if !self.in_window(ts) {
            return;
        }
        let (name, id, what) = match ev.event_type.as_str() {
            "launch_game" => (ev.game.as_deref().or(ev.game_name.as_deref()), as_str(&ev.game_id), games::Analytics::Launch),
            "running_game_heartbeat" => (
                ev.game_name.as_deref().or(ev.game.as_deref()),
                as_str(&ev.game_id),
                games::Analytics::Heartbeat {
                    session: ev.game_session_id.as_deref(),
                    ms: as_i64(&ev.duration_tracked_ms).unwrap_or(0),
                },
            ),
            "application_closed" => (
                ev.application_name.as_deref(),
                as_str(&ev.application_id),
                games::Analytics::Closed { ms: as_i64(&ev.activity_duration_s).unwrap_or(0) * 1000 },
            ),
            _ => return,
        };
        if let Some(name) = name {
            self.games.add_analytics(name, id, ev.event_id.as_deref(), what);
        }
    }

    /// Whether any voice events were seen (decides if the `tns` fallback is needed).
    pub fn has_voice(&self) -> bool {
        !self.voice.is_empty()
    }

    fn event_line(&mut self, line: &[u8]) {
        // Cheap substring test first; only ~1% of lines are worth parsing.
        if line.is_empty() || !self.finders.iter().any(|f| f.find(line).is_some()) {
            return;
        }
        let Ok(ev) = serde_json::from_slice::<RawEvent>(line) else { return };
        let Some(ts) = ev.timestamp.as_deref().and_then(time::parse_ms) else { return };

        match ev.event_type.as_str() {
            "leave_voice_channel" | "voice_disconnect" => {
                let dur = if ev.event_type == "voice_disconnect" {
                    as_i64(&ev.duration_connected_ms)
                } else {
                    as_i64(&ev.duration)
                };
                let key = match (as_str(&ev.guild_id), as_str(&ev.channel_id)) {
                    (Some(g), _) => VoiceKey::Guild(g),
                    (None, Some(c)) => VoiceKey::Channel(c),
                    (None, None) => VoiceKey::Channel(String::new()),
                };
                if let Some(d) = dur {
                    self.voice.add(ev.event_id.as_deref(), ts, d, key);
                }
            }
            "accepted_instant_invite" | "invite_sent" => {
                let (guild, code) = if ev.event_type == "invite_sent" {
                    (as_str(&ev.invite_guild_id), as_str(&ev.invite_code))
                } else {
                    (as_str(&ev.guild), as_str(&ev.invite))
                };
                if let (Some(g), Some(c)) = (guild, code) {
                    self.invites.entry(g).or_default().push((true, ts, c));
                }
            }
            "add_reaction" if self.in_window(ts) => {
                self.reactions += 1;
                let name = as_str(&ev.emoji_name);
                let emoji = match (as_str(&ev.emoji_id), name) {
                    (Some(id), Some(name)) => Some(Emoji::Custom {
                        name,
                        id,
                        animated: matches!(ev.emoji_animated, Some(Value::Bool(true))),
                    }),
                    (None, Some(text)) => Some(Emoji::Unicode(text.trim_end_matches('\u{FE0F}').to_owned())),
                    _ => None,
                };
                if let Some(e) = emoji {
                    *self.emoji_counts.entry(e).or_default() += 1;
                }
            }
            _ => {}
        }
        // Only voice events: quest adverts also carry a game_name for games never played.
        if let Some(g) = ev.game_name.as_deref() {
            if VOICE_EVENTS_WITH_GAME.contains(&ev.event_type.as_str()) {
                self.games.add(g, ts);
            }
        }
    }

    /// Every game seen in the window, for debugging the not-a-game filter.
    pub fn all_games(&self) -> Vec<games::GameTotal> {
        self.games.totals(self.from_ms, self.to_ms)
    }

    pub fn finish(self) -> Stats {
        let voice = (!self.voice.is_empty()).then(|| self.voice.totals(self.from_ms, self.to_ms));
        let voice_for = |k: &VoiceKey| voice.as_ref().and_then(|v| v.by_key.get(k)).copied().unwrap_or(0.0);

        let self_id = self.user.as_ref().map(|u| u.id.clone()).unwrap_or_default();
        let friends: HashMap<&str, &RawFriend> = self
            .user
            .iter()
            .flat_map(|u| u.relationships.iter().map(|r| (r.user.id.as_str(), &r.user)))
            .collect();

        // Squad: one entry per DM partner, messages + voice across their DM channel(s).
        let mut squad: HashMap<String, Person> = HashMap::new();
        for (cid, kind) in &self.channels {
            let ChannelKind::Dm(recipients) = kind else { continue };
            let Some(other) = recipients.iter().find(|r| **r != self_id) else { continue };
            let p = squad.entry(other.clone()).or_insert_with(|| {
                let fallback = self
                    .channel_names
                    .get(cid)
                    .map(|n| n.trim_start_matches("Direct Message with ").trim_end_matches("#0").to_owned())
                    .unwrap_or_else(|| "Unknown user".into());
                match friends.get(other.as_str()) {
                    Some(f) => Person {
                        id: other.clone(),
                        username: f.username.clone(),
                        display_name: f.global_name.clone().unwrap_or_else(|| f.username.clone()),
                        avatar: f.avatar.clone(),
                        ..Default::default()
                    },
                    None => Person { id: other.clone(), username: fallback.clone(), display_name: fallback, ..Default::default() },
                }
            });
            p.messages += self.msgs_by_dm.get(cid).copied().unwrap_or(0);
            p.voice_hours += voice_for(&VoiceKey::Channel(cid.clone()));
        }
        let score = |m: u64, h: f64| m as f64 + h * 60.0;
        let mut squad: Vec<Person> = squad.into_values().filter(|p| p.messages > 0 || p.voice_hours > 0.0).collect();
        squad.sort_by(|a, b| score(b.messages, b.voice_hours).total_cmp(&score(a.messages, a.voice_hours)));
        let dm_total: u64 = squad.iter().map(|p| p.messages).sum();
        let sidekick_share = squad.first().map_or(0.0, |p| p.messages as f64 / dm_total.max(1) as f64);
        squad.truncate(5);

        // Servers: messages + voice.
        let mut guild_ids: Vec<&String> = self.msgs_by_guild.keys().collect();
        if let Some(v) = &voice {
            guild_ids.extend(v.by_key.keys().filter_map(|k| match k {
                VoiceKey::Guild(g) => Some(g),
                _ => None,
            }));
        }
        guild_ids.sort();
        guild_ids.dedup();
        let mut servers: Vec<Place> = guild_ids
            .into_iter()
            .map(|g| Place {
                id: g.clone(),
                name: self.server_names.get(g).cloned().unwrap_or_else(|| "Server no longer available".into()),
                name_known: self.server_names.contains_key(g),
                messages: self.msgs_by_guild.get(g).copied().unwrap_or(0),
                voice_hours: voice_for(&VoiceKey::Guild(g.clone())),
                invites: vec![],
            })
            .filter(|p| p.messages > 0 || p.voice_hours > 0.0)
            .collect();
        let active_servers = servers.iter().filter(|s| s.messages >= 20).count();
        servers.sort_by(|a, b| score(b.messages, b.voice_hours).total_cmp(&score(a.messages, a.voice_hours)));
        servers.truncate(10);
        for s in &mut servers {
            let Some(list) = self.invites.get(&s.id) else { continue };
            let mut list = list.clone();
            // Logged invites first (they are known to point at this server), newest first.
            list.sort_by(|a, b| b.0.cmp(&a.0).then(b.1.cmp(&a.1)));
            for (_, _, code) in list {
                if !s.invites.contains(&code) {
                    s.invites.push(code);
                }
                if s.invites.len() == INVITES_PER_SERVER {
                    break;
                }
            }
        }

        let mut top: Vec<(&Emoji, &u64)> = self.emoji_counts.iter().collect();
        top.sort_by(|a, b| b.1.cmp(a.1));
        let top = top
            .into_iter()
            .take(5)
            .map(|(e, &count)| match e {
                Emoji::Unicode(t) => EmojiCount { text: Some(t.clone()), name: None, id: None, animated: false, count },
                Emoji::Custom { name, id, animated } => {
                    EmojiCount { text: None, name: Some(name.clone()), id: Some(id.clone()), animated: *animated, count }
                }
            })
            .collect();
        let emojis = EmojiStats {
            total: self.emojis_in_messages + self.reactions,
            in_messages: self.emojis_in_messages,
            reactions: self.reactions,
            top,
        };

        let game_totals = self.games.totals(self.from_ms, self.to_ms);
        let from_analytics = self.games.from_analytics();
        let games = (!game_totals.is_empty()).then(|| GameStats {
            source: if from_analytics { "analytics" } else { "voice" },
            distinct: game_totals.len(),
            hours: from_analytics.then(|| game_totals.iter().filter_map(|g| g.hours).sum()),
            top: game_totals
                .iter()
                .take(5)
                .map(|g| GameCount { name: g.name.clone(), id: g.id.clone(), sessions: g.sessions, hours: g.hours })
                .collect(),
        });

        let voice_hours = voice.as_ref().map_or(0.0, |v| v.hours);
        let card = Card {
            number: (fnv1a(self_id.as_bytes()) % 10_000) as u32,
            level: level(self.msgs_total, voice_hours, emojis.total),
        };
        let persona = persona::pick(&persona::Inputs {
            messages: self.msgs_total,
            emojis: emojis.total,
            voice_hours,
            active_servers,
            sidekick_share,
            distinct_games: games.as_ref().map_or(0, |g| g.distinct),
            quests: self.quests_completed,
            level: card.level,
        });

        Stats {
            window: Window { from: self.from_ms, to: self.to_ms },
            user: self.user.as_ref().map(|u| Person {
                id: u.id.clone(),
                username: u.username.clone(),
                display_name: u.global_name.clone().unwrap_or_else(|| u.username.clone()),
                avatar: u.avatar_hash.clone(),
                messages: self.msgs_total,
                voice_hours,
            }),
            messages: MessageStats { total: self.msgs_total, by_month: self.msgs_by_month },
            emojis,
            voice: voice.map(|v| VoiceStats { hours: v.hours, by_month: v.by_month, sessions: v.sessions }),
            servers,
            squad,
            games,
            quests: QuestStats { completed: self.quests_completed },
            persona,
            card,
        }
    }
}

const VOICE_EVENTS_WITH_GAME: &[&str] =
    &["start_speaking", "start_listening", "join_voice_channel", "leave_voice_channel", "voice_disconnect"];

/// The card level. Discord never published its formula; these weights are fitted to 17 real 2025
/// cards (level next to messages, voice hours and emojis), tuned to land close on most of them
/// (12 of 17 within 10%) rather than to average in a few outliers the three stats can't explain.
/// Voice counts most: about 2 points per minute in a call.
pub fn level(messages: u64, voice_hours: f64, emojis: u64) -> u64 {
    (messages as f64 + 133.0 * voice_hours + 0.5 * emojis as f64).round() as u64
}

/// Invite codes in a message: `discord.gg/abc`, `discord.com/invite/abc`, `discordapp.com/invite/abc`.
fn invite_codes(text: &str) -> impl Iterator<Item = &str> {
    const PREFIXES: [&str; 3] = ["discord.gg/", "discord.com/invite/", "discordapp.com/invite/"];
    PREFIXES.iter().flat_map(move |p| {
        text.match_indices(p).filter_map(move |(i, _)| {
            let rest = &text[i + p.len()..];
            let end = rest.find(|c: char| !(c.is_ascii_alphanumeric() || c == '-')).unwrap_or(rest.len());
            (2..=32).contains(&end).then(|| &rest[..end])
        })
    })
}

fn fnv1a(b: &[u8]) -> u64 {
    b.iter().fold(0xcbf29ce484222325, |h, &x| (h ^ x as u64).wrapping_mul(0x100000001b3))
}

#[cfg(test)]
mod tests {
    use super::*;

    const Y25: i64 = 1_735_689_600_000; // 2025-01-01
    const Y26: i64 = 1_767_225_600_000; // 2026-01-01

    #[test]
    fn classifies_entries() {
        assert_eq!(wanted("Account/user.json"), Some(Entry::User));
        assert_eq!(wanted("Messages/c123/messages.json"), Some(Entry::ChannelMessages));
        assert_eq!(wanted("Activity/reporting/events-2026-00000-of-00001.json"), Some(Entry::Events));
        assert_eq!(wanted("Activity/tns/events-2026-00000-of-00001.json"), Some(Entry::EventsFallback));
        assert_eq!(wanted("Activity/analytics/events-2026-00000-of-00001.json"), Some(Entry::Analytics));
        assert_eq!(wanted("Activity/modeling/events-2026-00000-of-00001.json"), None);
        assert_eq!(wanted("Servers/1/guild.json"), None);
    }

    #[test]
    fn end_to_end_small_package() {
        let mut e = Engine::new(Y25, Y26);
        e.feed_file(
            Entry::User,
            br#"{"id":"me","username":"me","global_name":"Me","avatar_hash":null,
                 "relationships":[{"user":{"id":"bff","username":"bff","global_name":"Best Friend","avatar":"abc"}}]}"#,
        )
        .unwrap();
        e.feed_file(Entry::ServersIndex, br#"{"g1":"Test Server"}"#).unwrap();
        e.feed_channel(
            br#"{"id":"dm1","type":"DM","recipients":["me","bff"]}"#,
            "[{\"ID\":\"1\",\"Timestamp\":\"2025-03-01 10:00:00\",\"Contents\":\"hi \u{1F62D}\"},\
              {\"ID\":\"2\",\"Timestamp\":\"2024-03-01 10:00:00\",\"Contents\":\"old\"}]"
                .as_bytes(),
        )
        .unwrap();
        e.feed_channel(
            br#"{"id":"c1","type":"GUILD_TEXT","guild":{"id":"g1","name":"Nest"}}"#,
            br#"[{"ID":"3","Timestamp":"2025-06-01 10:00:00","Contents":"<:wow:123456789012345678>"},
                 {"ID":"4","Timestamp":"2023-06-01 10:00:00","Contents":"join https://discord.gg/nest-42 !"}]"#,
        )
        .unwrap();

        let events = concat!(
            r#"{"event_type":"time_spent","timestamp":"\"2025-05-01T00:00:00Z\""}"#, "\n",
            r#"{"event_type":"leave_voice_channel","event_id":"e1","timestamp":"\"2025-05-01T02:00:00Z\"","guild_id":"g1","duration":"3600000","game_name":"Minecraft"}"#, "\n",
            r#"{"event_type":"voice_disconnect","event_id":"e2","timestamp":"\"2025-05-01T02:00:30Z\"","channel_id":"dm1","duration_connected_ms":"1800000"}"#, "\n",
            r#"{"event_type":"add_reaction","timestamp":"\"2025-05-02T00:00:00Z\"","emoji_name":"😭"}"#, "\n",
            r#"{"event_type":"accepted_instant_invite","timestamp":"\"2021-05-02T00:00:00Z\"","guild":"g1","invite":"joined"}"#, "\n",
            r#"{"event_type":"invite_sent","timestamp":"\"2020-05-02T00:00:00Z\"","invite_guild_id":"g1","invite_code":"sent"}"#,
        );
        // Feed in awkward chunk sizes to exercise line carry-over.
        for chunk in events.as_bytes().chunks(7) {
            e.feed_events(chunk);
        }
        e.finish_events();

        let s = e.finish();
        assert_eq!(s.messages.total, 2);
        assert_eq!(s.emojis.total, 3);
        assert_eq!(s.emojis.top[0].text.as_deref(), Some("😭"));
        assert_eq!(s.emojis.top[0].count, 2);
        let v = s.voice.unwrap();
        assert!((v.hours - (1.0 + 30.0 / 3600.0)).abs() < 1e-6);
        assert_eq!(s.servers[0].name, "Test Server");
        assert!((s.servers[0].voice_hours - 1.0).abs() < 1e-9);
        assert_eq!(s.squad[0].display_name, "Best Friend");
        assert!((s.squad[0].voice_hours - 0.5).abs() < 1e-9);
        assert_eq!(s.servers[0].invites, vec!["joined", "sent", "nest-42"]);
        assert_eq!(s.card.level, level(2, 1.0 + 30.0 / 3600.0, 3));
        let g = s.games.unwrap();
        assert_eq!((g.source, g.top[0].name.as_str()), ("voice", "Minecraft"));
    }

    #[test]
    fn level_matches_real_cards() {
        // (messages, voice hours, emojis, level) from real 2025 Checkpoint cards.
        let cards = [
            (91_834, 1780.0, 6_228, 287_354), (77_057, 1712.0, 9_141, 294_250), (63_238, 566.0, 20_123, 156_681),
            (87_867, 44.0, 8_396, 92_707), (5_510, 50.0, 953, 11_976), (209_727, 275.0, 103_240, 295_000),
            (49_370, 29.0, 4_810, 93_000), (31_480, 1602.0, 58_570, 352_000), (1_590, 2010.0, 384, 296_000),
            (6_598, 22.0, 1_185, 9_400), (19_710, 1605.0, 5_210, 229_000), (284_600, 1059.0, 49_630, 451_000),
            (79_265, 17.0, 7_866, 116_719), (20_393, 172.0, 3_215, 60_000), (148_263, 71.0, 11_933, 170_530),
            (75_610, 640.0, 7_670, 170_000), (43_680, 915.0, 3_560, 184_000),
        ];
        let mut errs: Vec<f64> =
            cards.iter().map(|&(m, h, e, real)| (level(m, h, e) as f64 / real as f64 - 1.0).abs()).collect();
        errs.sort_by(f64::total_cmp);
        assert!(errs.iter().filter(|&&e| e <= 0.10).count() >= 12, "{errs:?}");
        assert!(errs[errs.len() / 2] < 0.06, "median {}", errs[errs.len() / 2]);
    }

    #[test]
    fn analytics_games() {
        let mut e = Engine::new(Y25, Y26);
        let events = concat!(
            r#"{"event_type":"leave_voice_channel","event_id":"e1","timestamp":"\"2025-05-01T02:00:00Z\"","duration":"60000","game_name":"Minecraft"}"#, "\n",
        );
        e.feed_events(events.as_bytes());
        e.finish_events();
        let analytics = concat!(
            r#"{"event_type":"launch_game","event_id":"a1","timestamp":"\"2025-05-01T00:00:00Z\"","game":"VALORANT","game_id":"700"}"#, "\n",
            r#"{"event_type":"running_game_heartbeat","event_id":"a2","timestamp":"\"2025-05-01T00:05:00Z\"","game_name":"VALORANT","game_id":"700","game_session_id":"s","duration_tracked_ms":"300000"}"#, "\n",
            r#"{"event_type":"launch_game","event_id":"a3","timestamp":"\"2024-05-01T00:00:00Z\"","game":"Old Game","game_id":"1"}"#,
        );
        for chunk in analytics.as_bytes().chunks(11) {
            e.feed_analytics(chunk);
        }
        e.finish_events();
        let g = e.finish().games.unwrap();
        assert_eq!((g.source, g.distinct), ("analytics", 1));
        assert_eq!((g.top[0].name.as_str(), g.top[0].id.as_deref()), ("VALORANT", Some("700")));
        assert!((g.top[0].hours.unwrap() - 5.0 / 60.0).abs() < 1e-9);
    }
}
