// Made-up stats for the "try a demo" button. Same shape as the engine output.
export const DEMO = {
  window: { from: Date.UTC(2025, 0, 1), to: Date.UTC(2026, 0, 1) },
  user: { id: "", username: "you", display_name: "You", avatar: null, messages: 24817, voice_hours: 412 },
  messages: { total: 24817, by_month: [1830, 1702, 2011, 1950, 2204, 2390, 2911, 2650, 1980, 1830, 1705, 1654] },
  emojis: {
    total: 3120, in_messages: 2410, reactions: 710,
    top: [{ text: "😭", count: 540 }, { text: "💀", count: 311 }, { text: "❤", count: 260 }, { text: "🔥", count: 144 }, { text: "👀", count: 120 }],
  },
  voice: { hours: 412.4, by_month: Array(12).fill(34.4), sessions: 386 },
  servers: [
    { id: "1", name: "Midnight Snack Club", messages: 6120, voice_hours: 88 },
    { id: "2", name: "Pixel Pals", messages: 3904, voice_hours: 31 },
    { id: "3", name: "Study Hall", messages: 2210, voice_hours: 12 },
    { id: "4", name: "Cozy Corner", messages: 1840, voice_hours: 9 },
    { id: "5", name: "Retro Arcade", messages: 1320, voice_hours: 14 },
    { id: "6", name: "Art Dump", messages: 1105, voice_hours: 0 },
    { id: "7", name: "Speedrun Society", messages: 870, voice_hours: 6 },
    { id: "8", name: "Plant Parents", messages: 612, voice_hours: 0 },
    { id: "9", name: "Late Night Lo-fi", messages: 340, voice_hours: 21 },
    { id: "10", name: "Homework Help", messages: 298, voice_hours: 2 },
  ],
  squad: [
    { id: "", username: "moth", display_name: "Moth", avatar: null, messages: 8120, voice_hours: 190 },
    { id: "", username: "juniper", display_name: "Juniper", avatar: null, messages: 2210, voice_hours: 40 },
    { id: "", username: "kit", display_name: "Kit", avatar: null, messages: 1402, voice_hours: 22 },
    { id: "", username: "ren", display_name: "Ren", avatar: null, messages: 990, voice_hours: 9 },
    { id: "", username: "pip", display_name: "Pip", avatar: null, messages: 610, voice_hours: 4 },
  ],
  games: {
    source: "analytics",
    distinct: 7,
    hours: 486,
    top: [
      { name: "Minecraft", sessions: 52, hours: 212 }, { name: "Stardew Valley", sessions: 31, hours: 118 },
      { name: "Rocket League", sessions: 18, hours: 64 }, { name: "Hollow Knight", sessions: 9, hours: 41 },
      { name: "osu!", sessions: 6, hours: 12 },
    ],
  },
  quests: { completed: 2 },
  persona: { id: "capybara", name: "Capybara", blurb: "Unbothered and always in the call. Everyone relaxes when you join.", number: 2, of: 10 },
  card: { number: 4242, level: 81226 },
};
