// Server icons and game art. Runs on the page after the stats are ready.
//
// - Server icons: from the package when it has them (servers you manage). Otherwise, only when
//   images are switched on, by asking Discord's public invite endpoint about invites for that
//   server: the one you joined with and ones you sent (from the activity log), then links posted
//   in its channels. Only the invite code is sent.
// - Game art: only when images are switched on. Discord's public list of detectable games gives
//   each game's icon and, for Steam games, the Steam id for portrait cover art.

const API = "https://discord.com/api/v9";
const MAX_INVITE_LOOKUPS = 8;

/**
 * @returns {{ servers: Map<string, Promise<{icon?:string,name?:string}>>, games: Promise<Map<string,{icon?:string,cover?:string}>> }}
 * `servers` has one promise per server id, settled in rank order so the top servers come first.
 * `name` is only filled in when an invite resolved to the server (for servers the package doesn't name).
 */
export function resolveArt(stats, { cdn, icons = {} }) {
  return {
    servers: serverIcons(stats.servers ?? [], cdn, icons),
    games: cdn && stats.games?.top.length ? gameArt(stats.games.top).catch(() => new Map()) : Promise.resolve(new Map()),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, retries = 2) {
  const r = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
  if (r.status === 429 && retries > 0) {
    // Rate limited: wait as long as Discord asks (capped), then try again.
    const wait = Number((await r.json().catch(() => ({}))).retry_after ?? r.headers.get("retry-after") ?? 1);
    await sleep(Math.min(5000, Math.max(250, wait * 1000)));
    return getJson(url, retries - 1);
  }
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// ---------- servers ----------

const guildIcon = (id, hash) =>
  `https://cdn.discordapp.com/icons/${id}/${hash}.${hash.startsWith("a_") ? "gif" : "webp"}?size=128`;

function serverIcons(servers, cdn, local) {
  const out = new Map();
  const found = new Map(); // any guild an invite resolved to -> icon hash
  // One server at a time, in rank order, to stay well under Discord's rate limit.
  let queue = Promise.resolve();
  for (const s of servers) {
    if (local[s.id] && s.name_known !== false) out.set(s.id, Promise.resolve({ icon: URL.createObjectURL(local[s.id]) }));
    else if (!cdn) out.set(s.id, Promise.resolve({}));
    else out.set(s.id, (queue = queue.then(() => lookupServer(s, found, local[s.id])).catch(() => ({}))));
  }
  return out;
}

async function lookupServer(s, found, localIcon) {
  for (const code of (s.invites ?? []).slice(0, MAX_INVITE_LOOKUPS)) {
    if (found.has(s.id)) break;
    try {
      const inv = await getJson(`${API}/invites/${encodeURIComponent(code)}?with_counts=false`);
      if (inv.guild?.id) found.set(inv.guild.id, { icon: inv.guild.icon, name: inv.guild.name });
    } catch { /* expired or rate limited */ }
  }
  const g = found.get(s.id);
  return {
    icon: localIcon ? URL.createObjectURL(localIcon) : g?.icon ? guildIcon(s.id, g.icon) : undefined,
    name: s.name_known === false ? g?.name : undefined,
  };
}

// ---------- games ----------

const norm = (s) => String(s).toLowerCase().replace(/[®™©]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

async function gameArt(top) {
  const list = await getJson(`${API}/applications/detectable`);
  const byId = new Map(), byName = new Map();
  for (const app of list) {
    byId.set(app.id, app);
    for (const n of [app.name, ...(app.aliases ?? [])]) {
      const k = norm(n);
      if (k && !byName.has(k)) byName.set(k, app);
    }
  }
  const out = new Map();
  for (const g of top) {
    let app = (g.id && byId.get(g.id)) || byName.get(norm(g.name));
    if (!app && g.id) {
      // Not in the detectable list (e.g. a Discord activity): ask for that one app.
      try {
        const rpc = await getJson(`${API}/applications/${encodeURIComponent(g.id)}/rpc`);
        app = { id: rpc.id, icon_hash: rpc.icon, third_party_skus: rpc.third_party_skus };
      } catch { /* no art */ }
    }
    if (!app) continue;
    const steam = app.third_party_skus?.find((x) => x.distributor === "steam" && /^\d+$/.test(x.id ?? ""));
    out.set(g.name, {
      icon: app.icon_hash ? `https://cdn.discordapp.com/app-icons/${app.id}/${app.icon_hash}.png?size=256` : undefined,
      cover: steam ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${steam.id}/library_600x900.jpg` : undefined,
    });
  }
  return out;
}
