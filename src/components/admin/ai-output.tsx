/**
 * Shows the AI analysis stored on a request. The JSON comes from n8n, so it is
 * treated as untrusted: only known fields are rendered, as plain text, and any
 * other shape falls back to the raw JSON.
 */

type Cause = { cause?: unknown; how_to_confirm?: unknown; urgency?: unknown; likely_parts?: unknown };

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : null);
const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter((x): x is string => !!x) : []);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const URGENCY: Record<string, string> = { low: "ниска", medium: "средна", high: "висока", critical: "спешно" };

export function AiOutput({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <p className="text-sm text-muted">AI анализът още не е готов. Ще се появи тук, щом бъде получен.</p>;
  }
  if (!isObject(value)) return <RawJson value={value} />;

  const causes = Array.isArray(value.causes) ? (value.causes.filter(isObject) as Cause[]) : [];
  const summary = str(value.summary);
  const jobs = list(value.jobs);
  const missing = list(value.missing_info);

  if (!causes.length && !summary && !jobs.length && !missing.length) return <RawJson value={value} />;

  return (
    <div className="space-y-4 text-sm">
      {summary && <p className="text-paper">{summary}</p>}

      {causes.length > 0 && (
        <ol className="space-y-3">
          {causes.map((c, i) => {
            const urgency = str(c.urgency);
            const parts = list(c.likely_parts);
            return (
              <li key={i} className="border-l-2 border-rust bg-olive/40 px-3 py-2">
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-paper">{str(c.cause) ?? "Възможна причина"}</span>
                  {urgency && (
                    <span className={`badge ${urgency === "high" || urgency === "critical" ? "badge-warn" : ""}`}>
                      Спешност: {URGENCY[urgency] ?? urgency}
                    </span>
                  )}
                </p>
                {str(c.how_to_confirm) && <p className="mt-1 text-sand">Проверка: {str(c.how_to_confirm)}</p>}
                {parts.length > 0 && <p className="mt-1 font-mono text-xs text-muted">Части: {parts.join(", ")}</p>}
              </li>
            );
          })}
        </ol>
      )}

      {jobs.length > 0 && (
        <div>
          <p className="label">Работи</p>
          <ul className="mt-2 list-inside list-disc text-sand">
            {jobs.map((j, i) => (
              <li key={i}>{j}</li>
            ))}
          </ul>
        </div>
      )}

      {missing.length > 0 && (
        <div>
          <p className="label">Липсваща информация</p>
          <ul className="mt-2 list-inside list-disc text-sand">
            {missing.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RawJson({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto border border-line bg-carbon p-3 font-mono text-xs text-sand">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
