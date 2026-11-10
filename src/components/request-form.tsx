"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitRequestAction } from "@/lib/requests/actions";
import { MAX_DESCRIPTION, OPTIONS_BY_TYPE, type RequestType } from "@/lib/requests/options";
import { CheckRow, ConsentCheckbox, Step, TextField } from "./form-fields";
import { EMPTY_PICK, isPickComplete, VehiclePicker, type PickerVehicle, type VehiclePick } from "./vehicle-picker";

type Errors = Partial<
  Record<"vehicle" | "engine" | "transmission" | "description" | "options" | "mileage" | "name" | "phone" | "email" | "consent", string>
>;

const COPY = {
  repair: {
    detailsTitle: "Какво се случва",
    optionsLabel: "Бързи отметки (по желание)",
    textLabel: "Опишете симптомите",
    textHint: "Кога се появява, откога, при какви условия…",
    submit: "Изпрати заявката",
    done: "Получихме заявката. Ще се свържем с вас до 1 работен ден.",
  },
  modification: {
    detailsTitle: "Какво искате",
    optionsLabel: "Модификации",
    textLabel: "Коментар (по желание)",
    textHint: "Размер гуми, марка окачване, за какво ползвате джипа…",
    submit: "Изпрати заявката",
    done: "Получихме заявката. Ще се свържем с вас до 1 работен ден.",
  },
} as const;

export function RequestForm({ type, vehicles }: { type: RequestType; vehicles: PickerVehicle[] }) {
  const copy = COPY[type];
  const [pick, setPick] = useState<VehiclePick>(EMPTY_PICK);
  const [mileage, setMileage] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<{ quoted: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingQuote, setPendingQuote] = useState(false);
  const clear = (key: keyof Errors) => setErrors((e) => ({ ...e, [key]: undefined }));

  function validate(): Errors {
    const found: Errors = {};
    if (!isPickComplete(pick)) {
      if (pick.nonStock && pick.brand && pick.model && pick.generation) {
        if (pick.customEngine.trim().length < 2) found.engine = "Опишете двигателя, например „1UZ-FE 4.0 V8“.";
        if (pick.customTransmission.trim().length < 2) found.transmission = "Опишете скоростната кутия, например „A340F автоматична“.";
      } else {
        found.vehicle = pick.nonStock ? "Изберете марка, модел и поколение." : "Изберете автомобила до скоростна кутия.";
      }
    }
    if (mileage !== "" && !/^\d{1,7}$/.test(mileage)) found.mileage = "Въведете пробега в километри, само с цифри.";
    if (type === "repair" && description.trim().length < 5) found.description = "Опишете с няколко думи какво се случва с автомобила.";
    if (type === "modification" && options.length === 0 && description.trim() === "") {
      found.options = "Отбележете поне една модификация или опишете какво искате.";
    }
    if (name.trim().length < 2) found.name = "Въведете име, за да знаем към кого да се обърнем.";
    if (phone.replace(/\D/g, "").length < 8) found.phone = "Въведете телефон във формат 0888 123 456.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) found.email = "Въведете имейл, например ime@domain.bg.";
    if (!consent) found.consent = "Отбележете съгласието, за да обработим заявката.";
    return found;
  }

  function submit(wantsQuote: boolean) {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setMessage("Остават няколко неща за попълване — отбелязани са по-горе.");
      return;
    }
    setMessage(null);
    setPendingQuote(wantsQuote);
    startTransition(async () => {
      const response = await submitRequestAction({
        type,
        wantsQuote,
        contact: { name, phone, email, consent },
        details: {
          vehicle: pick.nonStock
            ? {
                nonStock: true,
                brand: pick.brand,
                model: pick.model,
                generation: pick.generation,
                engine: pick.customEngine,
                transmission: pick.customTransmission,
              }
            : { nonStock: false, vehicleId: pick.vehicleId },
          mileageKm: mileage === "" ? null : Number(mileage),
          description,
          options,
        },
      });
      if (response.ok) {
        setDone({ quoted: response.quoted });
        window.scrollTo({ top: 0 });
        return;
      }
      setMessage(response.message);
      if (response.fieldErrors) setErrors((e) => ({ ...e, ...response.fieldErrors }));
    });
  }

  if (done) {
    return (
      <section className="mt-12 border border-line-strong bg-carbon-raised" aria-live="polite">
        <div className="hatch h-2" aria-hidden />
        <div className="p-6 sm:p-10">
          <p className="label label-accent">Получено</p>
          <h2 className="display mt-4 text-6xl sm:text-7xl" tabIndex={-1} ref={(el) => el?.focus()}>
            Заявката е при нас.
          </h2>
          <p className="mt-6 text-lg text-sand">{copy.done}</p>
          {done.quoted && <p className="mt-3 text-sand">Офертата ще получите по имейл или телефон. Не сме запазили час.</p>}
          <Link href="/" className="btn btn-ghost mt-10">
            Към началото
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      noValidate
      className="mt-12 space-y-14"
      onSubmit={(event) => {
        event.preventDefault();
        submit(false);
      }}
    >
      <Step index="01" title="Автомобил" error={errors.vehicle}>
        <VehiclePicker
          vehicles={vehicles}
          value={pick}
          allowNonStock
          errors={{ engine: errors.engine, transmission: errors.transmission }}
          onChange={(next) => {
            setPick(next);
            setErrors((e) => ({ ...e, vehicle: undefined, engine: undefined, transmission: undefined }));
          }}
        />
        {type === "repair" && (
          <div className="mt-6 sm:max-w-xs">
            <TextField
              label="Пробег в км (по желание)"
              name="mileage"
              inputMode="numeric"
              hint="напр. 245000"
              maxLength={7}
              value={mileage}
              error={errors.mileage}
              onChange={(value) => {
                setMileage(value.replace(/[\s.,]/g, ""));
                clear("mileage");
              }}
            />
          </div>
        )}
      </Step>

      <Step index="02" title={copy.detailsTitle} error={errors.options}>
        <p className="field-label" id="options-label">
          {copy.optionsLabel}
        </p>
        <ul aria-labelledby="options-label" className={type === "repair" ? "grid border-t border-line-strong sm:grid-cols-2" : "border-t border-line-strong"}>
          {OPTIONS_BY_TYPE[type].map((option) => (
            <li key={option} className="border-b border-line">
              <CheckRow
                checked={options.includes(option)}
                onChange={(checked) => {
                  setOptions((current) => (checked ? [...current, option] : current.filter((o) => o !== option)));
                  clear("options");
                }}
              >
                <span className={type === "repair" ? "" : "font-semibold"}>{type === "repair" ? option[0].toUpperCase() + option.slice(1) : option}</span>
              </CheckRow>
            </li>
          ))}
        </ul>

        <label htmlFor="description" className="field-label mt-8">
          {copy.textLabel}
        </label>
        <textarea
          id="description"
          className="input min-h-36 py-3"
          placeholder={copy.textHint}
          maxLength={MAX_DESCRIPTION}
          value={description}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "description-error" : undefined}
          onChange={(e) => {
            setDescription(e.target.value);
            clear("description");
            clear("options");
          }}
        />
        {errors.description && (
          <p id="description-error" className="field-error">
            {errors.description}
          </p>
        )}
      </Step>

      <Step index="03" title="Контакт">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Име"
            autoComplete="name"
            value={name}
            error={errors.name}
            onChange={(value) => {
              setName(value);
              clear("name");
            }}
          />
          <TextField
            label="Телефон"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            hint="0888 123 456"
            value={phone}
            error={errors.phone}
            onChange={(value) => {
              setPhone(value);
              clear("phone");
            }}
          />
          <div className="sm:col-span-2">
            <TextField
              label="Имейл"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              error={errors.email}
              onChange={(value) => {
                setEmail(value);
                clear("email");
              }}
            />
          </div>
        </div>
        <ConsentCheckbox
          checked={consent}
          error={errors.consent}
          onChange={(checked) => {
            setConsent(checked);
            clear("consent");
          }}
        />
      </Step>

      <div className="border-t border-line-strong pt-8">
        {message && (
          <p role="alert" className="mb-6 border-l-2 border-rust bg-olive/40 px-4 py-3 text-sm">
            {message}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="submit" className="btn justify-center" disabled={pending}>
            {pending && !pendingQuote ? "Изпращаме…" : copy.submit}
            <span aria-hidden className="arrow">
              →
            </span>
          </button>
          <button type="button" className="btn btn-ghost justify-center" disabled={pending} onClick={() => submit(true)}>
            {pending && pendingQuote ? "Изпращаме…" : "Поискай оферта без записване на час"}
          </button>
        </div>
        <p className="mt-4 text-sm text-muted">Заявката не запазва час и не заема бокс. Офертата идва по имейл или телефон.</p>
      </div>
    </form>
  );
}
