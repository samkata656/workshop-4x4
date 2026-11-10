import Link from "next/link";

/** Numbered form section: "01 АВТОМОБИЛ". */
export function Step({ index, title, error, children }: { index: string; title: string; error?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-6 flex items-baseline gap-4 border-b border-line-strong pb-3">
        <span className="label label-accent">{index}</span>
        <span className="display text-4xl">{title}</span>
      </h2>
      {children}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}

export function Select(props: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="field-label">{props.label}</span>
      <select className="input" value={props.value} disabled={props.disabled} onChange={(e) => props.onChange(e.target.value)}>
        <option value="">{props.disabled ? "—" : "Изберете"}</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  name?: string;
  autoComplete?: string;
  inputMode?: "tel" | "email" | "text" | "numeric";
  maxLength?: number;
}) {
  const id = `field-${props.name ?? props.autoComplete ?? props.label}`;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {props.label}
      </label>
      <input
        id={id}
        className="input"
        type={props.type ?? "text"}
        autoComplete={props.autoComplete ?? "off"}
        inputMode={props.inputMode}
        placeholder={props.hint}
        maxLength={props.maxLength}
        value={props.value}
        aria-invalid={Boolean(props.error)}
        aria-describedby={props.error ? `${id}-error` : undefined}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.error && (
        <p id={`${id}-error`} className="field-error">
          {props.error}
        </p>
      )}
    </div>
  );
}

/** Square checkbox with a label, used for options and for "Не е стоков джип?". */
export function CheckRow(props: { checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={`row-mech flex cursor-pointer items-center gap-4 px-3 py-4 ${props.checked ? "bg-olive/40" : ""}`}>
      <input type="checkbox" className="check" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span className="min-w-0 flex-1">{props.children}</span>
    </label>
  );
}

/** Required GDPR consent with a link to the privacy page. */
export function ConsentCheckbox(props: { checked: boolean; onChange: (checked: boolean) => void; error?: string }) {
  return (
    <>
      <label className="mt-6 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="check mt-0.5"
          checked={props.checked}
          aria-invalid={Boolean(props.error)}
          aria-describedby={props.error ? "consent-error" : undefined}
          onChange={(e) => props.onChange(e.target.checked)}
        />
        <span className="text-sm text-sand">
          Съгласен съм данните ми да се използват за тази заявка, както е описано в{" "}
          <Link href="/poveritelnost" target="_blank" className="underline underline-offset-4 hover:text-paper">
            политиката за поверителност
          </Link>
          .
        </span>
      </label>
      {props.error && (
        <p id="consent-error" className="field-error">
          {props.error}
        </p>
      )}
    </>
  );
}
