// Client-side page analysis. No network access of any kind: the URL field is
// only ever compared as a string, never fetched.

export type Mode = "html" | "text";

export type LinkCounts = {
  total: number;
  internal: number | null;
  external: number | null;
  classifiable: boolean;
};

export type VagueHit = { phrase: string; count: number };

export type MentionRow = {
  label: string;
  kind: "entity" | "subject";
  inTitle: number;
  inBody: number;
  total: number;
};

export type JsonLdInfo = {
  blocks: number;
  parsed: number;
  invalid: number;
  types: string[];
  relationshipKeys: string[];
};

export type Analysis = {
  mode: Mode;
  headline: string;
  titleText: string;
  h1s: string[];
  h2s: string[];
  metaDescription: string | null;
  metaDescriptionLength: number | null;
  wordCount: number;
  bodyPreviewWords: number;
  aliases: string[];
  mentions: MentionRow[];
  entityTotal: number;
  entityInTitle: boolean;
  entityInOpening: boolean;
  subjectTotal: number;
  vagueHits: VagueHit[];
  vagueTotal: number;
  specificDetailCount: number;
  specificDetailExamples: string[];
  links: LinkCounts;
  jsonLd: JsonLdInfo;
  readerOutcome: string;
  subjectPhrase: string;
};

const OPENING_WORDS = 100;

const VAGUE_PHRASES = [
  "world-leading",
  "world leading",
  "world-class",
  "world class",
  "best-in-class",
  "best in class",
  "industry-leading",
  "industry leading",
  "market-leading",
  "market leading",
  "state-of-the-art",
  "state of the art",
  "cutting-edge",
  "cutting edge",
  "bleeding-edge",
  "revolutionary",
  "groundbreaking",
  "ground-breaking",
  "game-changing",
  "game changing",
  "next-generation",
  "next generation",
  "unparalleled",
  "unrivalled",
  "unrivaled",
  "unmatched",
  "unbeatable",
  "second to none",
  "leading provider",
  "leading supplier",
  "trusted leader",
  "number one",
  "#1",
  "no. 1",
  "top-rated",
  "top rated",
  "highest-rated",
  "premier destination",
  "premier provider",
  "one-stop shop",
  "one stop shop",
  "seamlessly integrated",
  "synergy",
  "best possible",
  "finest quality",
  "unique solution",
  "innovative solution",
  "holistic approach",
  "passionate about",
  "committed to excellence",
  "customer-centric",
  "customer centric",
  "bespoke solutions",
  "turnkey solution",
  "end-to-end solution",
  "hassle-free",
  "cost-effective solution",
  "wide range of",
  "vast experience",
  "years of experience", // only vague without a number in front; handled below
];

// Phrases that are only vague when *not* preceded by a figure.
const NUMBER_EXCUSED = new Set(["years of experience", "wide range of"]);

const UNIT_WORDS = [
  "years?",
  "yrs",
  "months?",
  "weeks?",
  "days?",
  "hours?",
  "minutes?",
  "seconds?",
  "members?",
  "customers?",
  "clients?",
  "users?",
  "subscribers?",
  "students?",
  "pupils?",
  "employees?",
  "staff",
  "volunteers?",
  "partners?",
  "countries",
  "cities",
  "states",
  "regions?",
  "locations?",
  "branches",
  "stores?",
  "sites?",
  "venues?",
  "rooms?",
  "beds?",
  "seats?",
  "km",
  "kilometres?",
  "kilometers?",
  "miles?",
  "metres?",
  "meters?",
  "feet",
  "ft",
  "acres?",
  "hectares?",
  "sq\\.? ?ft",
  "sqft",
  "m2",
  "kg",
  "kilograms?",
  "grams?",
  "lbs?",
  "pounds?",
  "tonnes?",
  "tons?",
  "litres?",
  "liters?",
  "gallons?",
  "mw",
  "kw",
  "kwh",
  "gwh",
  "mb",
  "gb",
  "tb",
  "mbps",
  "projects?",
  "products?",
  "titles?",
  "awards?",
  "patents?",
  "papers?",
  "languages?",
  "courses?",
  "episodes?",
  "reviews?",
  "ratings?",
];

/** A number, optionally grouped/decimal, with no trailing punctuation swept in. */
const NUMBER = "\\d+(?:[.,]\\d+)*";

type DetailPattern = {
  pattern: RegExp;
  /** Optional veto, given the match and the text that follows it. */
  reject?: (match: string, after: string) => boolean;
};

const DETAIL_PATTERNS: DetailPattern[] = [
  // percentages
  { pattern: new RegExp(`\\b${NUMBER}\\s?(?:%|per\\s?cent|percent)\\b`, "gi") },
  // numbers with units — but "42 Day Skipper weeks" is a course name, not a measurement
  {
    pattern: new RegExp(`\\b${NUMBER}\\+?[\\s-]?(?:${UNIT_WORDS.join("|")})\\b`, "gi"),
    reject: (match, after) => {
      // The unit word is capitalised and another capitalised word follows, so this is
      // a name ("42 Day Skipper weeks"), not a measured quantity.
      const unitWord = match.replace(/^[\d\s,.+-]+/, "");
      return /^\p{Lu}/u.test(unitWord) && /^\s+\p{Lu}/u.test(after);
    },
  },
  // currency amounts
  {
    pattern: new RegExp(
      `(?:[$£€¥₹]|\\b(?:USD|EUR|GBP|INR|AUD|CAD|CHF|JPY)\\s?)${NUMBER}\\s?(?:k|m|bn|b|tn|thousand|million|billion|trillion)?\\b`,
      "gi",
    ),
  },
  // four-digit years
  { pattern: /\b(?:1[5-9]\d{2}|20\d{2})\b/g },
  // explicit dates
  {
    pattern:
      /\b\d{1,2}(?:st|nd|rd|th)?\s(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/gi,
  },
];

const RELATIONSHIP_KEYS = [
  "memberOf",
  "sameAs",
  "parentOrganization",
  "isPartOf",
  "hasPart",
  "subOrganization",
  "containedInPlace",
  "containsPlace",
  "affiliation",
  "worksFor",
  "alumniOf",
  "brand",
  "publisher",
  "author",
  "founder",
  "location",
  "areaServed",
  "knowsAbout",
  "about",
  "mentions",
  "citation",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function words(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/ /g, " ").replace(/[ \t\r\f\v]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export function looksLikeHtml(content: string): boolean {
  return /<(?:!doctype|html|head|body|meta|title|div|section|article|main|header|footer|nav|p|span|h[1-6]|a|ul|ol|li|img|script|style|table|br|strong|em)\b[^>]*>/i.test(
    content,
  );
}

function countOccurrences(haystack: string, needle: string): number {
  const term = needle.trim();
  if (!term) return 0;
  let pattern: RegExp;
  try {
    pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "giu");
  } catch {
    pattern = new RegExp(escapeRegExp(term), "gi");
  }
  const matches = haystack.match(pattern);
  return matches ? matches.length : 0;
}

function scanVague(text: string): VagueHit[] {
  const hits: VagueHit[] = [];
  for (const phrase of VAGUE_PHRASES) {
    let pattern: RegExp;
    const escaped = escapeRegExp(phrase);
    try {
      pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
    } catch {
      pattern = new RegExp(escaped, "gi");
    }
    const found = [...text.matchAll(pattern)];
    if (!found.length) continue;
    const kept = NUMBER_EXCUSED.has(phrase)
      ? found.filter((m) => {
          const before = text.slice(Math.max(0, (m.index ?? 0) - 14), m.index ?? 0);
          return !/\d\s*\+?\s*$/.test(before);
        })
      : found;
    if (kept.length) hits.push({ phrase, count: kept.length });
  }
  return hits.sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase));
}

function scanSpecificDetails(text: string): { count: number; examples: string[] } {
  const ranges: Array<[number, number]> = [];
  const examples: string[] = [];
  for (const { pattern, reject } of DETAIL_PATTERNS) {
    const live = new RegExp(pattern.source, pattern.flags);
    for (const match of text.matchAll(live)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (reject?.(match[0], text.slice(end, end + 24))) continue;
      const overlaps = ranges.some(([s, e]) => start < e && end > s);
      if (overlaps) continue;
      ranges.push([start, end]);
      const snippet = match[0].trim().replace(/\s+/g, " ");
      if (snippet && !examples.includes(snippet) && examples.length < 10) examples.push(snippet);
    }
  }
  return { count: ranges.length, examples };
}

function hostnameOf(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function classifyLinks(hrefs: string[], siteUrl: string): LinkCounts {
  const meaningful = hrefs.filter((href) => {
    const h = href.trim();
    if (!h) return false;
    if (h.startsWith("#")) return false;
    return !/^(?:javascript:|mailto:|tel:|data:)/i.test(h);
  });
  const host = hostnameOf(siteUrl);
  if (!host) {
    return { total: meaningful.length, internal: null, external: null, classifiable: false };
  }
  let internal = 0;
  let external = 0;
  for (const href of meaningful) {
    const h = href.trim();
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(h)) {
      const linkHost = hostnameOf(h);
      if (linkHost && (linkHost === host || linkHost.endsWith(`.${host}`) || host.endsWith(`.${linkHost}`))) {
        internal += 1;
      } else {
        external += 1;
      }
    } else {
      internal += 1;
    }
  }
  return { total: meaningful.length, internal, external, classifiable: true };
}

function collectJsonLd(doc: Document): JsonLdInfo {
  const blocks = [...doc.querySelectorAll('script[type="application/ld+json"]')];
  const types = new Set<string>();
  const relKeys = new Set<string>();
  let parsed = 0;
  let invalid = 0;

  const visit = (node: unknown, depth = 0) => {
    if (depth > 12 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    const record = node as Record<string, unknown>;
    const nodeType = record["@type"];
    if (typeof nodeType === "string") types.add(nodeType);
    else if (Array.isArray(nodeType)) {
      for (const t of nodeType) if (typeof t === "string") types.add(t);
    }
    for (const key of Object.keys(record)) {
      const match = RELATIONSHIP_KEYS.find((candidate) => candidate.toLowerCase() === key.toLowerCase());
      if (match) relKeys.add(match);
      visit(record[key], depth + 1);
    }
  };

  for (const block of blocks) {
    const raw = block.textContent ?? "";
    if (!raw.trim()) {
      invalid += 1;
      continue;
    }
    try {
      const data = JSON.parse(raw) as unknown;
      parsed += 1;
      // Flatten @graph, then walk everything.
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const graph = (data as Record<string, unknown>)["@graph"];
        if (Array.isArray(graph)) for (const node of graph) visit(node);
      }
      visit(data);
    } catch {
      invalid += 1;
    }
  }

  return {
    blocks: blocks.length,
    parsed,
    invalid,
    types: [...types].sort(),
    relationshipKeys: [...relKeys].sort(),
  };
}

export type AnalyzeInput = {
  content: string;
  entity: string;
  subject: string;
  outcome: string;
  url: string;
};

export function parseAliases(entity: string): string[] {
  return entity
    .split(",")
    .map((value) => value.trim())
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
}

export function analyze(input: AnalyzeInput): Analysis {
  const content = input.content;
  const mode: Mode = looksLikeHtml(content) ? "html" : "text";
  const aliases = parseAliases(input.entity);
  const subjectPhrase = input.subject.trim();

  let titleText = "";
  let h1s: string[] = [];
  let h2s: string[] = [];
  let metaDescription: string | null = null;
  let bodyText = "";
  let links: LinkCounts = { total: 0, internal: null, external: null, classifiable: false };
  let jsonLd: JsonLdInfo = { blocks: 0, parsed: 0, invalid: 0, types: [], relationshipKeys: [] };

  if (mode === "html") {
    const doc = new DOMParser().parseFromString(content, "text/html");
    titleText = normalizeWhitespace(doc.querySelector("title")?.textContent ?? "");
    h1s = [...doc.querySelectorAll("h1")].map((el) => normalizeWhitespace(el.textContent ?? "")).filter(Boolean);
    h2s = [...doc.querySelectorAll("h2")].map((el) => normalizeWhitespace(el.textContent ?? "")).filter(Boolean);

    const metaEl =
      doc.querySelector('meta[name="description"]') ??
      doc.querySelector('meta[name="Description"]') ??
      doc.querySelector('meta[property="og:description"][data-fallback]');
    const metaContent = metaEl?.getAttribute("content");
    metaDescription = metaContent === null || metaContent === undefined ? null : normalizeWhitespace(metaContent);

    const hrefs = [...doc.querySelectorAll("a[href]")].map((el) => el.getAttribute("href") ?? "");
    links = classifyLinks(hrefs, input.url);
    jsonLd = collectJsonLd(doc);

    // querySelectorAll returns a static NodeList, so removing while iterating is safe.
    for (const el of doc.querySelectorAll("script, style, noscript, template, svg")) el.remove();
    const root = doc.body ?? doc.documentElement;
    bodyText = normalizeWhitespace(root?.textContent ?? "");
  } else {
    const lines = normalizeWhitespace(content).split("\n");
    titleText = (lines.find((line) => line.trim().length > 0) ?? "").trim();
    bodyText = normalizeWhitespace(content);
  }

  const headline = titleText || h1s[0] || "";
  const bodyWords = words(bodyText);
  const wordCount = bodyWords.length;
  const openingText = bodyWords.slice(0, OPENING_WORDS).join(" ");

  const mentions: MentionRow[] = aliases.map((alias) => {
    const inTitle = countOccurrences(headline, alias);
    const inBody = countOccurrences(bodyText, alias);
    return { label: alias, kind: "entity", inTitle, inBody, total: inTitle + inBody };
  });

  if (subjectPhrase) {
    const inBody = countOccurrences(bodyText, subjectPhrase);
    mentions.push({
      label: subjectPhrase,
      kind: "subject",
      inTitle: countOccurrences(headline, subjectPhrase),
      inBody,
      total: inBody,
    });
  }

  const entityRows = mentions.filter((row) => row.kind === "entity");
  const entityTotal = entityRows.reduce((sum, row) => sum + row.inBody, 0);
  const entityInTitle = entityRows.some((row) => row.inTitle > 0);
  const entityInOpening = aliases.some((alias) => countOccurrences(openingText, alias) > 0);
  const subjectTotal = subjectPhrase ? countOccurrences(bodyText, subjectPhrase) : 0;

  const vagueHits = scanVague(`${headline}\n${bodyText}`);
  const details = scanSpecificDetails(bodyText);

  return {
    mode,
    headline,
    titleText,
    h1s,
    h2s,
    metaDescription,
    metaDescriptionLength: metaDescription === null ? null : metaDescription.length,
    wordCount,
    bodyPreviewWords: Math.min(OPENING_WORDS, wordCount),
    aliases,
    mentions,
    entityTotal,
    entityInTitle,
    entityInOpening,
    subjectTotal,
    vagueHits,
    vagueTotal: vagueHits.reduce((sum, hit) => sum + hit.count, 0),
    specificDetailCount: details.count,
    specificDetailExamples: details.examples,
    links,
    jsonLd,
    readerOutcome: input.outcome.trim(),
    subjectPhrase,
  };
}
