import { DIMENSIONS, type Band, type ChecklistItem } from "../lib/checklist";

function stateWord(item: ChecklistItem): string {
  if (item.state === "na") return "N/A";
  if (item.state === "pass") return item.kind === "auto" ? "PASS" : "CONFIRMED";
  return item.kind === "auto" ? "FAIL" : "UNCONFIRMED";
}

function mark(item: ChecklistItem): string {
  if (item.state === "na") return "–";
  if (item.state === "pass") return "✓";
  return item.kind === "auto" ? "✗" : "";
}

function rowClass(item: ChecklistItem): string {
  const state = item.state === "na" ? "is-na" : item.state === "pass" ? "is-pass" : "is-fail";
  return `check-row ${state} ${item.kind}`;
}

function AutoRow({ item }: { item: ChecklistItem }) {
  return (
    <div className={rowClass(item)} aria-readonly="true">
      <span className="mark" aria-hidden="true">
        {mark(item)}
      </span>
      <span className="label">{item.label}</span>
      <span className="state">
        {stateWord(item)} <span aria-hidden="true">·</span> auto
      </span>
      <p className="detail">{item.detail}</p>
    </div>
  );
}

function ManualRow({
  item,
  onToggle,
}: {
  item: ChecklistItem;
  onToggle: (id: string, next: boolean) => void;
}) {
  return (
    <label className={rowClass(item)}>
      <input
        type="checkbox"
        aria-label={item.label}
        checked={item.state === "pass"}
        onChange={(event) => onToggle(item.id, event.target.checked)}
      />
      <span className="mark" aria-hidden="true">
        {mark(item)}
      </span>
      <span className="label">{item.label}</span>
      <span className="state">
        {stateWord(item)} <span aria-hidden="true">·</span> by eye
      </span>
      <p className="detail">{item.detail}</p>
    </label>
  );
}

export function ChecklistPanel({
  items,
  onToggle,
}: {
  items: ChecklistItem[];
  onToggle: (id: string, next: boolean) => void;
}) {
  return (
    <div>
      {DIMENSIONS.map((dimension) => {
        const rows = items.filter((item) => item.dimension === dimension.id);
        const applicable = rows.filter((item) => item.state !== "na");
        const passed = applicable.filter((item) => item.state === "pass").length;
        return (
          <section className="dimension" key={dimension.id}>
            <div className="dimension-head">
              <h4>
                {dimension.name}
                <span className="tally">
                  {passed}/{applicable.length} confirmed
                  {applicable.length < rows.length ? ` · ${rows.length - applicable.length} n/a` : ""}
                </span>
              </h4>
              <p>{dimension.question}</p>
            </div>
            {rows.map((item) =>
              item.kind === "auto" ? (
                <AutoRow item={item} key={item.id} />
              ) : (
                <ManualRow item={item} key={item.id} onToggle={onToggle} />
              ),
            )}
          </section>
        );
      })}
    </div>
  );
}

const BAND_ORDER = [5, 15, 25, 50, 75, 95];

export function ScoreBand({ band }: { band: Band }) {
  return (
    <div className="score">
      <div className="score-figure">{band.display}%</div>
      <div>
        <p className="score-label">{band.label}</p>
        <p className="score-meta">
          {band.confirmed} of {band.applicable} applicable items confirmed
          {band.naCount > 0 ? ` · ${band.naCount} not applicable in plain-text mode` : ""}. Shown as a band because this is a checklist confirmation, not a
          measurement. 95% is the ceiling on purpose — the last judgment stays human.
        </p>
      </div>
      <div className="score-track" aria-hidden="true">
        {BAND_ORDER.map((value) => (
          <span key={value} className={value <= band.display ? "on" : undefined} />
        ))}
      </div>
    </div>
  );
}
