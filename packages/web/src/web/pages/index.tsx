import { useMemo, useRef, useState, type ReactNode } from "react";
import { HeroDiagram } from "../components/hero-diagram";
import { MentionTable, ReportCards, VagueScan } from "../components/report";
import { ChecklistPanel, ScoreBand } from "../components/checklist-panel";
import { analyze, looksLikeHtml, type Analysis } from "../lib/analyze";
import { buildChecklist, scoreBand, type ManualTicks } from "../lib/checklist";
import { SAMPLE } from "../lib/sample";
import { usePageLoader } from "../queries/page-loader";

function Step({
  index,
  title,
  blurb,
  children,
}: {
  index: string;
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  return (
    <section className="step">
      <div className="step-index" aria-hidden="true">
        {index}
      </div>
      <div className="step-head">
        <h2>{title}</h2>
        <p>{blurb}</p>
      </div>
      <div className="step-body">{children}</div>
    </section>
  );
}

function Index() {
  const [content, setContent] = useState("");
  const [entity, setEntity] = useState("");
  const [subject, setSubject] = useState("");
  const [outcome, setOutcome] = useState("");
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceError, setSourceError] = useState("");
  const [sourceNotice, setSourceNotice] = useState("");
  const sourceVersion = useRef(0);
  const pageLoader = usePageLoader();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [ticks, setTicks] = useState<ManualTicks>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const trimmedContent = content.trim();
  const mode = trimmedContent ? (looksLikeHtml(content) ? "html" : "text") : null;
  const missing: string[] = [];
  if (!trimmedContent) missing.push("page content");
  if (!entity.trim()) missing.push("entity name");
  if (!subject.trim()) missing.push("subject");

  const items = useMemo(
    () => (analysis ? buildChecklist(analysis, ticks) : []),
    [analysis, ticks],
  );
  const band = useMemo(() => (items.length ? scoreBand(items) : null), [items]);

  function run() {
    if (missing.length) return;
    setTicks({});
    setAnalysis(analyze({ content, entity, subject, outcome, url }));
    requestAnimationFrame(() => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultsRef.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    });
  }

  function readFile(file: File) {
    const version = ++sourceVersion.current;
    setSourceError("");
    setSourceNotice("");
    if (!/\.(html?|txt|md)$/i.test(file.name)) {
      setSourceError("Choose an .html, .htm, .txt or .md file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSourceError("Please choose a file smaller than 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (version !== sourceVersion.current) return;
      setContent(typeof reader.result === "string" ? reader.result : "");
      setFileName(file.name);
      setAnalysis(null);
      setTicks({});
      setSourceNotice(`Loaded ${file.name}. Name the entity and topic below, then run the check.`);
    };
    reader.onerror = () => setSourceError("Could not read that file. Try again or paste its contents.");
    reader.readAsText(file);
  }

  async function loadUrl() {
    const version = ++sourceVersion.current;
    setSourceError("");
    setSourceNotice("");
    try {
      const value = sourceUrl.trim();
      const normalized = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
      const result = await pageLoader.mutateAsync({ url: normalized });
      if (version !== sourceVersion.current) return;
      setContent(result.content);
      setUrl(result.url);
      setSourceUrl(result.url);
      setFileName(null);
      setAnalysis(null);
      setTicks({});
      setSourceNotice(`Loaded ${result.url}. This is the returned page source; JavaScript-generated content is not rendered. Name the entity and topic below, then run the check.`);
    } catch (error) {
      if (version !== sourceVersion.current) return;
      setSourceError(error instanceof Error ? error.message : "Could not load the page. Upload saved HTML or paste its source instead.");
    }
  }

  function loadSample() {
    sourceVersion.current += 1;
    setSourceError("");
    setSourceNotice("");
    setSourceUrl("");
    setContent(SAMPLE.content);
    setEntity(SAMPLE.entity);
    setSubject(SAMPLE.subject);
    setOutcome(SAMPLE.outcome);
    setUrl(SAMPLE.url);
    setFileName(null);
    setAnalysis(null);
    setTicks({});
  }

  function clearAll() {
    sourceVersion.current += 1;
    setSourceError("");
    setSourceNotice("");
    setSourceUrl("");
    setContent("");
    setEntity("");
    setSubject("");
    setOutcome("");
    setUrl("");
    setFileName(null);
    setAnalysis(null);
    setTicks({});
  }

  return (
    <main className="shell">
      <header className="masthead">
        <p className="tool-context">UCKG.org · Writer Tools</p>
        <h1>Clarity Check</h1>
        <p className="lede">
          Can a search engine tell which UCKG HelpCentre, meeting or programme your page is about,
          what it offers, and how a reader can take the next step? Check your UCKG.org page across
          five dimensions — then confirm the judgment calls by eye.
        </p>
        <p className="fineprint">
          Upload a saved file, load a live URL or paste page source. Files and pasted content are
          analysed locally. Loading a URL asks the app server to retrieve that public page; its
          source is returned here for analysis.
        </p>
        <HeroDiagram />
      </header>

      <Step
        index="01"
        title="Load your UCKG.org page"
        blurb="Choose a file or load a public page URL — or paste source below. HTML enables the full check; plain text skips the HTML-only items."
      >
        <div className="source-options">
          <button type="button" className="file-button" onClick={() => fileInput.current?.click()}>
            Load a file (.html, .htm, .txt or .md)
          </button>
          <p className="source-help">Saved HTML gives the full check. Text and Markdown give the lighter check.</p>
          <form className="url-loader" onSubmit={(event) => { event.preventDefault(); void loadUrl(); }}>
            <label className="field">
              <span className="field-label">Or load a live page URL</span>
              <input
                type="text"
                inputMode="url"
                aria-label="Live page URL to load"
                placeholder="https://uckg.org/your-page"
                value={sourceUrl}
                onChange={(event) => {
                  sourceVersion.current += 1;
                  setSourceUrl(event.target.value);
                  setSourceError("");
                }}
              />
            </label>
            <button type="submit" className="file-button" disabled={!sourceUrl.trim() || pageLoader.isPending}>
              {pageLoader.isPending ? "Loading URL…" : "Load URL"}
            </button>
          </form>
          <div className="source-feedback" aria-live="polite" aria-atomic="true">
            {pageLoader.isPending ? <p>Retrieving page source…</p> : null}
            {sourceError ? <p className="blocker" role="alert">{sourceError}</p> : null}
            {sourceNotice ? <p>{sourceNotice}</p> : null}
          </div>
        </div>
        <label className="field">
          <span className="field-label">
            Page content <span className="field-hint">— HTML source preferred</span>
          </span>
          <textarea
            aria-label="Page content — HTML source or plain text"
            value={content}
            onChange={(event) => {
              sourceVersion.current += 1;
              setContent(event.target.value);
              setFileName(null);
              setSourceNotice("");
              setAnalysis(null);
            }}
            spellCheck={false}
            placeholder={"<!doctype html>\n<html>\n  <head>…"}
            aria-describedby="source-state"
          />
        </label>
        <div className="source-toolbar" id="source-state">
          <input
            ref={fileInput}
            type="file"
            aria-label="Upload an HTML, text or Markdown file"
            accept=".html,.htm,.txt,.md,text/html,text/plain,text/markdown"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readFile(file);
              event.target.value = "";
            }}
          />
          <span className="mode-flag">
            {mode === null
              ? "nothing pasted yet"
              : mode === "html"
                ? `HTML detected — full check · ${content.length.toLocaleString()} chars`
                : `plain text — lighter check · ${content.length.toLocaleString()} chars`}
          </span>
          {fileName ? <span className="mode-flag">from {fileName}</span> : null}
          <button type="button" className="text-button" onClick={loadSample}>
            Load a UCKG example
          </button>
        </div>
      </Step>

      <Step
        index="02"
        title="Name the UCKG entity and topic"
        blurb="The checker counts your exact words. It does not guess the topic for you — that guess is the thing being tested."
      >
        <label className="field">
          <span className="field-label">
            Which HelpCentre, church, meeting or programme is this about? <span className="field-hint">— comma-separate aliases</span>
          </span>
          <input
            type="text"
            aria-label="Primary entity name, comma-separated aliases allowed"
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            placeholder="UCKG HelpCentre, Universal Church of the Kingdom of God"
          />
        </label>
        <label className="field">
          <span className="field-label">Which faith topic, meeting or support should the page explain?</span>
          <input
            type="text"
            aria-label="Subject the page should cover"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Faith and prayer"
          />
        </label>
        <label className="field">
          <span className="field-label">
            What should a UCKG.org reader be able to do next? <span className="field-hint">— optional</span>
          </span>
          <input
            type="text"
            aria-label="What a reader should be able to do after reading the page"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            placeholder="Find their nearest HelpCentre and check meeting times"
          />
        </label>
        <label className="field">
          <span className="field-label">
            Page URL <span className="field-hint">— filled after URL loading; for files, optional link classification</span>
          </span>
          <input
            type="url"
            aria-label="Page URL, used only to classify links as internal or external"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://uckg.org/your-page"
          />
        </label>
      </Step>

      <Step
        index="03"
        title="Run the check"
        blurb="Ten of the fifteen items are computed from the content. The other five are yours to judge by eye."
      >
        <div className="run-row">
          <button type="button" className="run-button" onClick={run} disabled={missing.length > 0}>
            {analysis ? "Re-run the check" : "Check this page"}
          </button>
          {missing.length > 0 ? (
            <span className="blocker">Still needed: {missing.join(", ")}.</span>
          ) : null}
          {content || entity || subject ? (
            <button type="button" className="text-button" onClick={clearAll}>
              Clear everything
            </button>
          ) : null}
        </div>
      </Step>

      <Step
        index="04"
        title="Read what it found"
        blurb="The report first, then the checklist. The score follows the checklist, not the other way round."
      >
        <div ref={resultsRef}>
          {!analysis || !band ? (
            <p className="empty-note">
              Nothing checked yet. Paste a page, name the entity and subject, and run it — results appear
              here.
            </p>
          ) : (
            <div className="reveal" key={`${analysis.wordCount}-${analysis.headline}`}>
              <h3 className="section-title">
                What's on the page
                {analysis.mode === "text" ? " (plain-text mode — HTML-only checks skipped)" : ""}
              </h3>
              <ReportCards analysis={analysis} />

              <h3 className="section-title">Vague-claim scan</h3>
              <VagueScan analysis={analysis} />

              <h3 className="section-title">Mention counts</h3>
              <MentionTable analysis={analysis} />

              <h3 className="section-title">The checklist</h3>
              <ChecklistPanel
                items={items}
                onToggle={(id, next) => setTicks((prev) => ({ ...prev, [id]: next }))}
              />

              <ScoreBand band={band} />
            </div>
          )}
        </div>
      </Step>

      <footer className="footnote">
        <h2>How the score works</h2>
        <p>
          This isn’t a correctness score, an SEO ranking prediction or a measure of faith. It shows
          how much of this UCKG.org clarity checklist you’ve confirmed: 15 items in total, with
          10 checked automatically and 5 for you to judge by eye. In plain-text mode, the 5
          HTML-only items are marked not applicable and excluded from the score.
        </p>
        <p>
          The score moves through six bands rather than showing a raw percentage. A figure such as
          “63% ready” suggests precision this checklist doesn’t have. Treat the band as a rough
          read of page clarity, not a number to chase.
        </p>
        <p>
          A flagged vague claim automatically leaves its checklist item unconfirmed, regardless
          of what else you tick. A clean scan does not verify claims, testimonies or promises —
          those still need an editorial read.
        </p>
        <ul className="band-guide">
          <li><strong>5%</strong><span>Nothing confirmed yet</span></li>
          <li><strong>15%</strong><span>A couple of things confirmed</span></li>
          <li><strong>25%</strong><span>Roughly a third of the way there</span></li>
          <li><strong>50%</strong><span>About half confirmed</span></li>
          <li><strong>75%</strong><span>Most of the way there</span></li>
          <li><strong>95%</strong><span>Everything confirmed — the ceiling, on purpose</span></li>
        </ul>
        <p>
          The scale stops at 95%, never 100%. Final sign-off for a UCKG.org page should always
          be a human read, not an automated score.
        </p>
        <p className="privacy-note">
          Page analysis runs in this browser tab. File contents and pasted text are not sent for
          analysis. When you choose Load URL, the URL is sent to the app server, which retrieves
          the public page and returns its source without saving it to a database. The target
          website sees a request from the server. The separate Page URL field only classifies
          links and does not trigger a fetch. Pages requiring login or blocking automated access
          may need a saved HTML file instead.
        </p>
      </footer>
    </main>
  );
}

export default Index;
