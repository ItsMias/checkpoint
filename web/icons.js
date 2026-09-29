// Small line icons (24×24, currentColor). Drawn for this project, except `discord` (the Discord logo,
// used on the card back like the original Checkpoint card).

const svg = (body, { fill = false, vb = "0 0 24 24" } = {}) =>
  `<svg viewBox="${vb}" aria-hidden="true" fill="${fill ? "currentColor" : "none"}" stroke="${fill ? "none" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  flag: svg(`<path d="M6 21V3M6 4h12l-3 4.5L18 13H6"/>`),
  home: svg(`<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>`, { fill: true }),
  chat: svg(`<path d="M4 5h16v11H9l-5 4z"/>`, { fill: true }),
  smile: svg(`<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M8.5 14.5c1.8 2 5.2 2 7 0" stroke="#0d0b12"/><circle cx="9" cy="10" r="1.2" fill="#0d0b12" stroke="none"/><circle cx="15" cy="10" r="1.2" fill="#0d0b12" stroke="none"/>`),
  mic: svg(`<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>`),
  servers: svg(`<path d="M3 11 9 6l6 5v8H3z" fill="currentColor"/><path d="M14 8l3.5-3L22 9v10h-5"/>`),
  person: svg(`<circle cx="12" cy="7" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/>`),
  duo: svg(`<circle cx="9" cy="8" r="3.5" fill="currentColor"/><path d="M2.5 20c0-3.8 2.9-6 6.5-6s6.5 2.2 6.5 6" fill="currentColor"/><circle cx="17" cy="7" r="3"/><path d="M17 13c2.8 0 4.8 1.9 4.8 5"/>`),
  gamepad: svg(`<path d="M6 7h12a4 4 0 0 1 4 4v4a3 3 0 0 1-5.3 1.9L15 15H9l-1.7 1.9A3 3 0 0 1 2 15v-4a4 4 0 0 1 4-4z" fill="currentColor"/><path d="M7 10v3M5.5 11.5h3" stroke="#0d0b12"/><circle cx="16" cy="11" r="1" fill="#0d0b12" stroke="none"/><circle cx="18" cy="13" r="1" fill="#0d0b12" stroke="none"/>`),
  quest: svg(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>`),
  card: svg(`<rect x="5" y="3" width="14" height="18" rx="1" fill="currentColor"/><path d="M8 7h5" stroke="#0d0b12"/>`),
  star: svg(`<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" fill="currentColor"/>`),
  close: svg(`<path d="M6 6l12 12M18 6 6 18"/>`),
  left: svg(`<path d="M19 12H5m6-6-6 6 6 6"/>`),
  right: svg(`<path d="M5 12h14m-6-6 6 6-6 6"/>`),
  play: svg(`<path d="M7 4l13 8-13 8z" fill="currentColor"/>`),
  download: svg(`<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>`),
  upload: svg(`<path d="M12 16V4m-5 5 5-5 5 5M4 20h16"/>`),
  discord: svg(`<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>`, { fill: true }),
  shield: svg(`<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/>`),
  lock: svg(`<rect x="5" y="11" width="14" height="10" rx="1.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`),
  check: svg(`<path d="m5 12.5 4.5 4.5L19 7.5"/>`),
  chevron: svg(`<path d="m6 9 6 6 6-6"/>`),
  sound: svg(`<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>`),
  muted: svg(`<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="m17 9.5 5 5m0-5-5 5"/>`),

  // Decorative doodles used in the row under headlines.
  globe: svg(`<ellipse cx="18" cy="12" rx="16" ry="10"/><path d="M2 12h32M18 2c-5 5-5 15 0 20M18 2c5 5 5 15 0 20M5 6.5h26M5 17.5h26"/>`, { vb: "0 0 36 24" }),
  barcode: svg(`<path d="M3 4v16M7 4v16M10 4v16M14 4v16M17 4v16M21 4v16M25 4v16M28 4v16" stroke-width="2.4" stroke-linecap="butt"/>`, { vb: "0 0 31 24" }),
  eq: svg(`<path d="M3 20v-6M7 20V9M11 20v-8M15 20V4M19 20v-9M23 20v-5M27 20v-11M31 20v-7" stroke-width="2.6" stroke-linecap="butt"/>`, { vb: "0 0 34 24" }),
  dots: svg(`<g fill="currentColor" stroke="none">${[...Array(18)].map((_, i) => `<circle cx="${3 + (i % 9) * 4}" cy="${8 + Math.floor(i / 9) * 8}" r="1.6"/>`).join("")}</g>`, { vb: "0 0 38 24" }),
  heart: svg(`<path d="M12 20s-8-4.8-8-10.4A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.6C20 15.2 12 20 12 20z" fill="currentColor"/>`),
  phone: svg(`<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" fill="currentColor"/>`),
  swords: svg(`<path d="M4 4l10 10M20 4 10 14M4 4h4v4M20 4h-4v4M8 16l-3 3M16 16l3 3M6 14l4 4M18 14l-4 4"/>`),
  ring: svg(`<ellipse cx="12" cy="12" rx="10" ry="5"/><ellipse cx="12" cy="12" rx="5" ry="2" fill="currentColor"/>`),
};
