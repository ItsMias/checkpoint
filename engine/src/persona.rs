//! Picks the character on the collectible card.
//!
//! The ten characters are the ones from Discord's Checkpoint 2025 (each came with a matching
//! avatar decoration). The numbering matches real cards: it starts at 0, in the order Discord
//! created the decorations (Bonsai 0/10, Capybara 2/10, Cat 8/10, Cassette 9/10 seen on real
//! cards). Discord never published how it picked a character, so the rules are our own.

use serde::Serialize;

#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct Persona {
    /// Stable id the web app uses to pick the pixel art and card colours.
    pub id: &'static str,
    pub name: &'static str,
    pub blurb: &'static str,
    /// Position in the collection, from 0, shown as "n/10" on the card.
    pub number: usize,
    pub of: usize,
}

pub struct Inputs {
    pub messages: u64,
    pub emojis: u64,
    pub voice_hours: f64,
    pub active_servers: usize,
    pub sidekick_share: f64,
    pub distinct_games: usize,
    pub quests: u64,
    /// The card level (see `crate::level`).
    pub level: u64,
}

/// In collection order (card numbers 0..9).
const ALL: &[(&str, &str, &str)] = &[
    ("bonsai", "Bonsai", "You tend a small, well-kept corner of Discord."),
    ("donut", "Donut", "Sweet on your favourite person. Most of your DMs went one way."),
    ("capybara", "Capybara", "Unbothered and always in the call. Everyone relaxes when you join."),
    ("disco", "Disco", "The life of every server. A true Discord nerd, and proud of it."),
    ("origami", "Origami", "Patient and crafty. You fold every quest into a reward."),
    ("snail", "Snail", "Slow and steady. You pop in when it matters, and that's plenty."),
    ("duck", "Ducky", "Cap backwards, controller in hand, always queueing for one more."),
    ("banana", "Banana", "Goofy, expressive and fluent in emoji."),
    ("cat", "Cat", "You show up on your own schedule, and it's always a good time."),
    ("cassette", "Cassette", "Your chats play on repeat. There's always another track."),
];

pub fn pick(i: &Inputs) -> Persona {
    let msgs = i.messages.max(1) as f64;
    let id = if i.level < 20_000 && i.voice_hours < 100.0 {
        "snail"
    } else if i.voice_hours >= 300.0 || i.voice_hours * 100.0 > msgs {
        "capybara"
    } else if i.messages >= 40_000 && i.active_servers >= 15 {
        "disco"
    } else if i.sidekick_share > 0.4 {
        "donut"
    } else if i.emojis as f64 / msgs > 0.15 {
        "banana"
    } else if i.distinct_games >= 8 {
        "duck"
    } else if i.messages >= 30_000 {
        "cassette"
    } else if i.quests >= 3 {
        "origami"
    } else if i.active_servers <= 3 {
        "bonsai"
    } else {
        "cat"
    };
    let n = ALL.iter().position(|p| p.0 == id).unwrap();
    let (id, name, blurb) = ALL[n];
    Persona { id, name, blurb, number: n, of: ALL.len() }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> Inputs {
        Inputs {
            messages: 25_000,
            emojis: 100,
            voice_hours: 20.0,
            active_servers: 6,
            sidekick_share: 0.1,
            distinct_games: 0,
            quests: 0,
            level: 30_000,
        }
    }

    #[test]
    fn rules() {
        assert_eq!(pick(&base()).id, "cat");
        // The real 2025 card for the package this was validated against: Capybara, 2/10.
        let capy = pick(&Inputs { voice_hours: 1780.0, messages: 91_834, active_servers: 30, level: 287_354, ..base() });
        assert_eq!((capy.id, capy.number, capy.of), ("capybara", 2, 10));
        assert_eq!(pick(&Inputs { level: 5_000, messages: 3_000, ..base() }).id, "snail");
        assert_eq!(pick(&Inputs { messages: 60_000, active_servers: 20, ..base() }).id, "disco");
        assert_eq!(pick(&Inputs { sidekick_share: 0.6, ..base() }).id, "donut");
        assert_eq!(pick(&Inputs { emojis: 5_000, ..base() }).id, "banana");
        assert_eq!(pick(&Inputs { distinct_games: 12, ..base() }).id, "duck");
        assert_eq!(pick(&Inputs { messages: 35_000, ..base() }).id, "cassette");
        assert_eq!(pick(&Inputs { quests: 4, ..base() }).id, "origami");
        assert_eq!(pick(&Inputs { active_servers: 2, ..base() }).id, "bonsai");
    }
}
