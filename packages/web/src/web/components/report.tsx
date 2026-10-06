import type { Analysis } from "../lib/analyze";

type Tone = "plain" | "good" | "caution" | "alarm";

function Card({
  label,
  value,
  note,
  tone = "plain",
  small = false,
  chips,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: Tone;
  small?: boolean;
  chips?: string[];
}) {
  const toneClass =
    tone === "good" ? " is-good" : tone === "caution" ? " is-caution" : tone === "alarm" ? " is-alarm" : "";
  return (
    <div className={`card${toneClass}`}>
      <p className="card-key">{label}</p>
      <p className={small ? "card-value small" : "card-value"}>{value}</p>
      {note ? <p className="card-note">{note}</p> : null}
      {chips && chips.length > 0 ? (
        <div className="chip-row">
          {chips.map((chip) => (
            <span className="chip" key={chip}>
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ReportCards({ analysis }: { analysis: Analysis }) {
  const html = analysis.mode === "html";
  const meta = analysis.metaDescription;
  const links = analysis.links;
  const ld = analysis.jsonLd;

  const linkValue = html ? String(links.total) : "n/a";
  const linkNote = !html
    ? "Needs HTML source"
    : links.classifiable
      ? `${links.internal} internal · ${links.external} external`
      : "Add the page URL to split internal/external";

  return (
    <div className="card-grid">
      <Card
        label="Visible body words"
        value={analysis.wordCount.toLocaleString()}
        note={
          analysis.wordCount >= 300
            ? "Past the ~300-word thin-content line"
            : "Thin — under the ~300-word line"
        }
        tone={analysis.wordCount >= 300 ? "good" : "caution"}
      />
      <Card
        label="Headings"
        value={html ? `${analysis.h1s.length} H1 · ${analysis.h2s.length} H2` : "n/a"}
        note={html ? (analysis.h1s.length === 1 ? "Single H1, as it should be" : "Want exactly one H1") : "Needs HTML source"}
        tone={html ? (analysis.h1s.length === 1 && analysis.h2s.length >= 2 ? "good" : "caution") : "plain"}
        small
      />
      <Card
        label="Meta description"
        value={html ? (meta === null ? "missing" : `${meta.length} chars`) : "n/a"}
        note={
          !html
            ? "Needs HTML source"
            : meta === null
              ? "No description tag found"
              : meta.length === 0
                ? "Tag present but empty"
                : meta.length <= 160
                  ? "Within the 160-character budget"
                  : "Over 160 — will be truncated"
        }
        tone={
          !html
            ? "plain"
            : meta === null || meta.length === 0
              ? "alarm"
              : meta.length <= 160
                ? "good"
                : "caution"
        }
        small={html ? meta === null : true}
      />
      <Card label="Links out" value={linkValue} note={linkNote} tone={html && links.total > 0 ? "good" : "caution"} />
      <Card
        label="Structured data"
        value={html ? (ld.parsed > 0 ? `${ld.parsed} JSON-LD` : ld.blocks > 0 ? "invalid" : "none") : "n/a"}
        note={
          !html
            ? "Needs HTML source"
            : ld.parsed > 0
              ? ld.types.length
                ? `@type: ${ld.types.join(", ")}`
                : "Parsed, but no @type declared"
              : ld.blocks > 0
                ? `${ld.blocks} block(s) failed to parse`
                : "No ld+json blocks"
        }
        tone={!html ? "plain" : ld.parsed > 0 ? "good" : "caution"}
        small
        chips={ld.relationshipKeys.length ? ld.relationshipKeys : undefined}
      />
      <Card
        label="Specific details"
        value={String(analysis.specificDetailCount)}
        note={
          analysis.specificDetailCount > 0
            ? "Figures, dates or measured quantities"
            : "Nothing checkable found"
        }
        tone={analysis.specificDetailCount > 0 ? "good" : "alarm"}
        chips={analysis.specificDetailExamples.slice(0, 6)}
      />
    </div>
  );
}

export function VagueScan({ analysis }: { analysis: Analysis }) {
  const flagged = analysis.vagueHits.length > 0;
  return (
    <div className={flagged ? "scan-panel is-alarm" : "scan-panel"}>
      <p className="scan-verdict">
        {flagged
          ? `${analysis.vagueHits.length} unproven superlative${analysis.vagueHits.length === 1 ? "" : "s"} found (${analysis.vagueTotal} occurrence${analysis.vagueTotal === 1 ? "" : "s"}). Each one asserts quality without evidence — the Evidence item stays unchecked until they're gone or backed up.`
          : "Clean. No unproven superlatives found in the headline or body text."}
      </p>
      {flagged ? (
        <ul className="scan-list">
          {analysis.vagueHits.map((hit) => (
            <li key={hit.phrase}>
              <span>“{hit.phrase}”</span>
              <span>
                ×{hit.count}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function MentionTable({ analysis }: { analysis: Analysis }) {
  if (analysis.mentions.length === 0) {
    return <p className="empty-note">No entity or subject given, so there was nothing to count.</p>;
  }
  return (
    <table className="mentions">
      <caption>
        Exact, case-insensitive matches. Entity counts cover the headline and body; the subject is counted in
        body text only.
      </caption>
      <thead>
        <tr>
          <th scope="col">Term</th>
          <th scope="col" className="num">
            In headline
          </th>
          <th scope="col" className="num">
            In body
          </th>
        </tr>
      </thead>
      <tbody>
        {analysis.mentions.map((row) => {
          const zero = row.kind === "entity" ? row.total === 0 : row.inBody === 0;
          return (
            <tr key={`${row.kind}-${row.label}`} className={zero ? "is-zero" : undefined}>
              <td>
                {row.label}
                <br />
                <span className="row-kind">{row.kind === "entity" ? "entity alias" : "subject"}</span>
              </td>
              <td className="num">{row.kind === "subject" ? `${row.inTitle}` : row.inTitle}</td>
              <td className="num">{row.inBody}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
