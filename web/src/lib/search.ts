export type ItemSearchDoc = {
  /** canonical key like "ak47" or "desert_eagle" or "karambit" */
  typeKey: string;
  /** skin name like "Devil's Eye" */
  skinName: string;
};

const TYPE_ALIASES: Record<string, string[]> = {
  // guns
  ak47: ["ak46", "ak"],
  desert_eagle: ["deagle", "deag", "de"],

  // knives (common user shorthand)
  karambit: ["kara"],
  butterfly: ["butter", "bfk"],
  huntsman: ["hunts"],
  bayonet: ["bay"],
  m9_bayonet: ["m9 bay", "m9bay", "m9"],
  falchion: ["falch"],
};

function norm(s: string) {
  return s.toLowerCase().replace(/[_-]+/g, " ").trim();
}

function tokenize(q: string) {
  return norm(q)
    .split(/\s+/g)
    .filter(Boolean);
}

export function typeSearchHaystack(typeKey: string) {
  const base = norm(typeKey);
  const aliases = (TYPE_ALIASES[typeKey] ?? []).map(norm);
  // also allow removing spaces for things like "m9bay"
  const compact = base.replace(/\s+/g, "");
  const aliasCompacts = aliases.map((a) => a.replace(/\s+/g, ""));
  return new Set([base, compact, ...aliases, ...aliasCompacts]);
}

export function matchesQuery(doc: ItemSearchDoc, query: string) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return true;

  const typeHay = typeSearchHaystack(doc.typeKey);
  const skinHay = norm(doc.skinName);

  // Each token must match either type (incl aliases) OR skin name.
  // "m4a1 devil" works; "m4a1" lists all; "devil" finds all devil skins.
  return tokens.every((t) => {
    const tNorm = norm(t);
    if (!tNorm) return true;
    if (typeHay.has(tNorm) || typeHay.has(tNorm.replace(/\s+/g, ""))) return true;
    return skinHay.includes(tNorm);
  });
}

