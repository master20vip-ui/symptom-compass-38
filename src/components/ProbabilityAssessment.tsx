import ReactMarkdown from "react-markdown";

type Row = { name: string; pct: number; rationale: string };

// Matches:  - **Condition** — 45% — rationale
// Accepts em-dash, en-dash, hyphen, or colon as separators.
const ROW_RE =
  /^\s*[-*]\s*\*\*(.+?)\*\*\s*[—–\-:]\s*(\d{1,3})\s*%\s*[—–\-:]?\s*(.*)$/;

function parseRows(block: string): Row[] {
  const rows: Row[] = [];
  for (const line of block.split("\n")) {
    const m = line.match(ROW_RE);
    if (m) {
      const pct = Math.max(0, Math.min(100, parseInt(m[2], 10)));
      rows.push({ name: m[1].trim(), pct, rationale: m[3].trim() });
    }
  }
  return rows;
}

function Bar({ row }: { row: Row }) {
  const tone =
    row.pct >= 60
      ? "bg-neon"
      : row.pct >= 30
        ? "bg-neon/70"
        : "bg-muted-foreground/50";
  return (
    <div className="rounded-xl border border-border bg-card/40 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-sm font-semibold">{row.name}</span>
        <span className="font-mono text-sm tabular-nums text-neon">
          {row.pct}%
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
        <div
          className={`h-full rounded-full ${tone} transition-[width] duration-500`}
          style={{ width: `${row.pct}%` }}
        />
      </div>
      {row.rationale && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {row.rationale}
        </p>
      )}
    </div>
  );
}

export function AssistantMarkdown({ text }: { text: string }) {
  // Split off the Probability Assessment block (keeps the rest as markdown).
  const headingRe = /(^|\n)##\s+Probability Assessment\s*\n/i;
  const match = text.match(headingRe);

  if (!match || match.index === undefined) {
    return <ReactMarkdown>{text}</ReactMarkdown>;
  }

  const beforeEnd = match.index + (match[1] ? 1 : 0);
  const before = text.slice(0, beforeEnd);
  const afterStart = match.index + match[0].length;
  const rest = text.slice(afterStart);

  // Block ends at the next "## " heading (or end of text).
  const nextHeading = rest.search(/\n##\s+/);
  const block = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  const after = nextHeading === -1 ? "" : rest.slice(nextHeading + 1);

  const rows = parseRows(block);

  return (
    <>
      {before.trim() && <ReactMarkdown>{before}</ReactMarkdown>}
      <div className="my-3">
        <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Probability assessment
        </h3>
        {rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <Bar key={i} row={r} />
            ))}
          </div>
        ) : (
          <ReactMarkdown>{block}</ReactMarkdown>
        )}
      </div>
      {after.trim() && <ReactMarkdown>{after}</ReactMarkdown>}
    </>
  );
}
