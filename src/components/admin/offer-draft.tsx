import { ActionForm, IntentButton } from "@/components/admin/action-form";
import { shortDate } from "@/components/admin/ui";
import { offerAction } from "@/lib/admin/actions";
import { zonedTime } from "@/lib/booking/time";
import { MAX_OFFER_BODY, MAX_OFFER_SUBJECT } from "@/lib/requests/offer";

/**
 * Offer e-mail for a modification request: the AI draft, editable by the
 * owner, with the prices the AI found online as reference. Nothing reaches the
 * customer until the owner presses the send button.
 *
 * `items` is JSON written by n8n, so it is treated as untrusted: only known
 * fields are rendered, as plain text, and links must be http(s).
 */

type Props = {
  requestId: number;
  customerEmail: string | null;
  subject: string | null;
  body: string | null;
  items: unknown;
  draftedAt: Date | null;
  sentAt: Date | null;
  sentTo: string | null;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const euros = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? `${v.toLocaleString("bg-BG")} €` : null);

function priceRange(item: Record<string, unknown>) {
  const from = euros(item.priceFromEur);
  const to = euros(item.priceToEur);
  if (from && to) return from === to ? from : `${from} – ${to}`;
  return from ?? to ?? "няма намерена цена";
}

export function OfferDraft(props: Props) {
  const { requestId, items } = props;
  const found = (Array.isArray(items) ? items : []).filter(isRecord).filter((item) => typeof item.name === "string");

  return (
    <div className="border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="label">Оферта по имейл</p>
        {props.sentAt ? (
          <span className="badge">
            Изпратена · {shortDate(props.sentAt)} {zonedTime(props.sentAt)}
          </span>
        ) : props.draftedAt ? (
          <span className="badge badge-warn">Чернова от AI · чака одобрение</span>
        ) : (
          <span className="badge">Няма чернова</span>
        )}
      </div>

      {!props.draftedAt && !props.subject && (
        <p className="mt-2 text-sm text-muted">AI черновата още не е готова. Можете да напишете офертата и сами.</p>
      )}

      {found.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted">Цени на части, намерени онлайн от AI — ориентир за вас, не се изпращат отделно:</p>
          <ul className="mt-2 space-y-1 text-sm">
            {found.map((item, i) => {
              const source = typeof item.source === "string" && /^https?:\/\//.test(item.source) ? item.source : null;
              return (
                <li key={i} className="flex flex-wrap justify-between gap-x-4 border-b border-line py-1.5">
                  <span className="min-w-0 break-words">
                    {String(item.name)}
                    {source && (
                      <>
                        {" · "}
                        <a href={source} target="_blank" rel="noopener noreferrer nofollow" className="text-sand underline underline-offset-4 hover:text-paper">
                          източник
                        </a>
                      </>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-sand">{priceRange(item)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ActionForm action={offerAction} className="mt-4 grid gap-3">
        <input type="hidden" name="id" value={requestId} />
        <div>
          <label htmlFor={`offer-subject-${requestId}`} className="field-label">
            Тема на имейла
          </label>
          <input
            id={`offer-subject-${requestId}`}
            name="subject"
            className="input"
            maxLength={MAX_OFFER_SUBJECT}
            required
            defaultValue={props.subject ?? ""}
          />
        </div>
        <div>
          <label htmlFor={`offer-body-${requestId}`} className="field-label">
            Текст на имейла
          </label>
          <textarea
            id={`offer-body-${requestId}`}
            name="body"
            rows={14}
            maxLength={MAX_OFFER_BODY}
            required
            defaultValue={props.body ?? ""}
            className="input h-auto py-3 font-mono text-sm leading-relaxed"
          />
        </div>
        <p className="text-xs text-muted">
          {props.customerEmail
            ? `Ще бъде изпратена на ${props.customerEmail}. Проверете цените и текста — клиентът получава точно това.`
            : "Клиентът няма записан имейл, затова офертата не може да се изпрати оттук."}
          {props.sentAt && props.sentTo && ` Последно изпратена на ${props.sentTo}.`}
        </p>
        <div className="flex flex-wrap gap-3">
          <IntentButton intent="save" pendingLabel="Записваме…" className="btn btn-ghost min-h-10 px-4">
            Запиши черновата
          </IntentButton>
          <IntentButton intent="send" pendingLabel="Изпращаме…" className="btn min-h-10 px-4" disabled={!props.customerEmail}>
            {props.sentAt ? "Изпрати отново" : "Одобри и изпрати на клиента"}
          </IntentButton>
        </div>
      </ActionForm>
    </div>
  );
}
