import type { Analysis } from "./analyze";

export type DimensionId = "entity" | "subject" | "evidence" | "relationships" | "usefulness";

export type Dimension = {
  id: DimensionId;
  name: string;
  question: string;
};

export const DIMENSIONS: Dimension[] = [
  { id: "entity", name: "Entity", question: "Can Google identify the UCKG HelpCentre, church, meeting or programme this page is about?" },
  { id: "subject", name: "Subject", question: "Is the faith topic, meeting or support offered on this UCKG.org page clear?" },
  { id: "evidence", name: "Evidence", question: "Does this UCKG.org page support its claims with checkable details rather than broad assurances?" },
  {
    id: "relationships",
    name: "Relationships",
    question: "Does this page explain how its HelpCentre, meeting or programme relates to UCKG and other relevant sources?",
  },
  { id: "usefulness", name: "Usefulness", question: "Can someone reading this UCKG.org page understand what is offered and what to do next?" },
];

export type ItemState = "pass" | "fail" | "na";

export type ChecklistItem = {
  id: string;
  dimension: DimensionId;
  label: string;
  kind: "auto" | "manual";
  state: ItemState;
  /** What the computation actually found — shown under auto rows. */
  detail: string;
};

export type ManualTicks = Record<string, boolean>;

export const MANUAL_ITEM_IDS = [
  "entity-plain",
  "subject-opening",
  "evidence-verifiable",
  "relationships-context",
  "usefulness-next-action",
] as const;

const NA_DETAIL = "Not applicable — needs HTML source";

function autoItem(
  id: string,
  dimension: DimensionId,
  label: string,
  passed: boolean,
  detail: string,
): ChecklistItem {
  return { id, dimension, label, kind: "auto", state: passed ? "pass" : "fail", detail };
}

function naItem(id: string, dimension: DimensionId, label: string): ChecklistItem {
  return { id, dimension, label, kind: "auto", state: "na", detail: NA_DETAIL };
}

function manualItem(
  id: string,
  dimension: DimensionId,
  label: string,
  ticks: ManualTicks,
  detail = "Your call — tick it only if it's plainly true.",
): ChecklistItem {
  return {
    id,
    dimension,
    label,
    kind: "manual",
    state: ticks[id] ? "pass" : "fail",
    detail,
  };
}

export function buildChecklist(analysis: Analysis, ticks: ManualTicks): ChecklistItem[] {
  const htmlMode = analysis.mode === "html";
  const items: ChecklistItem[] = [];

  // — Entity —
  items.push(
    autoItem(
      "entity-title",
      "entity",
      "Named HelpCentre, church, meeting or programme appears in the title/headline",
      analysis.entityInTitle,
      analysis.aliases.length === 0
        ? "No entity name given, so nothing could be matched"
        : analysis.entityInTitle
          ? `Matched in: “${truncate(analysis.headline, 70)}”`
          : `Headline “${truncate(analysis.headline || "(empty)", 70)}” contains no alias`,
    ),
  );
  items.push(
    autoItem(
      "entity-opening",
      "entity",
      `Named HelpCentre, church, meeting or programme appears within the opening ~100 words`,
      analysis.entityInOpening,
      analysis.entityInOpening
        ? "Found inside the first 100 words of body text"
        : "Not found in the first 100 words of body text",
    ),
  );
  items.push(
    manualItem(
      "entity-plain",
      "entity",
      "The UCKG HelpCentre, church, meeting or programme is named consistently, not just called “we” or “it”",
      ticks,
    ),
  );

  // — Subject —
  items.push(
    htmlMode
      ? autoItem(
          "subject-h1",
          "subject",
          "Exactly one H1 present",
          analysis.h1s.length === 1,
          analysis.h1s.length === 1
            ? `One H1: “${truncate(analysis.h1s[0] ?? "", 70)}”`
            : `${analysis.h1s.length} H1 element${analysis.h1s.length === 1 ? "" : "s"} found`,
        )
      : naItem("subject-h1", "subject", "Exactly one H1 present"),
  );
  items.push(
    htmlMode
      ? autoItem(
          "subject-meta",
          "subject",
          "Meta description present and ≤160 characters",
          analysis.metaDescription !== null &&
            analysis.metaDescription.length > 0 &&
            analysis.metaDescription.length <= 160,
          analysis.metaDescription === null
            ? "No <meta name=\"description\"> found"
            : analysis.metaDescription.length === 0
              ? "Meta description tag present but empty"
              : `${analysis.metaDescription.length} characters`,
        )
      : naItem("subject-meta", "subject", "Meta description present and ≤160 characters"),
  );
  items.push(
    manualItem(
      "subject-opening",
      "subject",
      "Opening sentences explain the faith topic, meeting or support and who it is for",
      ticks,
    ),
  );

  // — Evidence —
  items.push(
    autoItem(
      "evidence-vague",
      "evidence",
      "Vague-claim scan is clean (zero flagged phrases)",
      analysis.vagueHits.length === 0,
      analysis.vagueHits.length === 0
        ? "No unproven superlatives found"
        : `${analysis.vagueTotal} flagged phrase${analysis.vagueTotal === 1 ? "" : "s"} — this item unchecks itself`,
    ),
  );
  items.push(
    autoItem(
      "evidence-specific",
      "evidence",
      "At least one specific, checkable detail present",
      analysis.specificDetailCount >= 1,
      analysis.specificDetailCount >= 1
        ? `${analysis.specificDetailCount} specific detail${analysis.specificDetailCount === 1 ? "" : "s"} found`
        : "No figures, dates, or measured quantities found",
    ),
  );
  items.push(
    manualItem(
      "evidence-verifiable",
      "evidence",
      "Claims about UCKG activities, reach or reported experiences have a verifiable source, not a promise of results",
      ticks,
    ),
  );

  // — Relationships —
  items.push(
    htmlMode
      ? autoItem(
          "rel-links",
          "relationships",
          "At least one link out to another page or source",
          analysis.links.total >= 1,
          analysis.links.total >= 1
            ? `${analysis.links.total} link${analysis.links.total === 1 ? "" : "s"} found`
            : "No usable <a href> links found",
        )
      : naItem("rel-links", "relationships", "At least one link out to another page or source"),
  );
  items.push(
    htmlMode
      ? autoItem(
          "rel-jsonld",
          "relationships",
          "Structured data (JSON-LD) present",
          analysis.jsonLd.parsed >= 1,
          analysis.jsonLd.blocks === 0
            ? "No application/ld+json blocks found"
            : analysis.jsonLd.parsed === 0
              ? `${analysis.jsonLd.blocks} block${analysis.jsonLd.blocks === 1 ? "" : "s"} found, none parsed as valid JSON`
              : `${analysis.jsonLd.parsed} valid block${analysis.jsonLd.parsed === 1 ? "" : "s"}${
                  analysis.jsonLd.types.length ? ` — ${analysis.jsonLd.types.join(", ")}` : ""
                }`,
        )
      : naItem("rel-jsonld", "relationships", "Structured data (JSON-LD) present"),
  );
  items.push(
    manualItem(
      "relationships-context",
      "relationships",
      "The page explains its connection to UCKG and the community, HelpCentre or programme it serves",
      ticks,
    ),
  );

  // — Usefulness —
  items.push(
    autoItem(
      "use-words",
      "usefulness",
      "Body content is ≥ ~300 words",
      analysis.wordCount >= 300,
      `${analysis.wordCount} word${analysis.wordCount === 1 ? "" : "s"} of visible text`,
    ),
  );
  items.push(
    htmlMode
      ? autoItem(
          "use-h2",
          "usefulness",
          "At least two H2s (distinct sub-topics)",
          analysis.h2s.length >= 2,
          `${analysis.h2s.length} H2 element${analysis.h2s.length === 1 ? "" : "s"} found`,
        )
      : naItem("use-h2", "usefulness", "At least two H2s (distinct sub-topics)"),
  );
  items.push(
    manualItem(
      "usefulness-next-action",
      "usefulness",
      "The reader knows a specific next step, such as finding a HelpCentre, checking a meeting time or contacting the team",
      ticks,
      analysis.readerOutcome
        ? `You said they should be able to: “${truncate(analysis.readerOutcome, 90)}”`
        : undefined,
    ),
  );

  return items;
}

export type Band = {
  display: number;
  label: string;
  raw: number;
  confirmed: number;
  applicable: number;
  naCount: number;
};

export function scoreBand(items: ChecklistItem[]): Band {
  const applicableItems = items.filter((item) => item.state !== "na");
  const naCount = items.length - applicableItems.length;
  const confirmed = applicableItems.filter((item) => item.state === "pass").length;
  const applicable = applicableItems.length;
  const raw = applicable === 0 ? 0 : (confirmed / applicable) * 100;

  let display = 5;
  let label = "Nothing confirmed yet";
  if (raw <= 0) {
    display = 5;
    label = "Nothing confirmed yet";
  } else if (raw < 25) {
    display = 15;
    label = "A couple of things confirmed";
  } else if (raw < 45) {
    display = 25;
    label = "Roughly a third of the way there";
  } else if (raw < 70) {
    display = 50;
    label = "About half confirmed";
  } else if (raw < 100) {
    display = 75;
    label = "Most of the way there";
  } else {
    display = 95;
    label = "Everything confirmed — the ceiling, on purpose";
  }

  return { display, label, raw, confirmed, applicable, naCount };
}

export function truncate(value: string, max: number): string {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}
