import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import type { schema } from "@/db";
import { saveVehicleAction } from "@/lib/admin/actions";

type Vehicle = typeof schema.vehicles.$inferSelect;

const CAPACITIES = [
  ["engineOilWithFilterL", "Двигателно масло с филтър"],
  ["transmissionL", "Скоростна кутия"],
  ["frontDiffL", "Преден диференциал"],
  ["rearDiffL", "Заден диференциал"],
  ["transferCaseL", "Раздатъчна кутия"],
  ["coolantL", "Антифриз"],
  ["brakeFluidL", "Спирачна течност"],
] as const;

function Field(props: { id: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={props.className}>
      <label htmlFor={props.id} className="field-label">
        {props.label}
      </label>
      {props.children}
    </div>
  );
}

/** Edit form for one row of the vehicle table; without `vehicle` it creates a new row. */
export function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  const v = vehicle;
  return (
    <ActionForm action={saveVehicleAction} className="max-w-4xl">
      {v && <input type="hidden" name="id" value={v.id} />}

      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="label mb-4 border-b border-line-strong pb-3 w-full">
          <span className="label-accent">01</span> Модел
        </legend>
        <Field id="brand" label="Марка">
          <select id="brand" name="brand" defaultValue={v?.brand ?? "Toyota"} className="input">
            <option value="Toyota">Toyota</option>
            <option value="Lexus">Lexus</option>
          </select>
        </Field>
        <Field id="model" label="Модел">
          <input id="model" name="model" required maxLength={80} defaultValue={v?.model ?? ""} placeholder="Land Cruiser 150" className="input" />
        </Field>
        <Field id="generation" label="Поколение">
          <input id="generation" name="generation" required maxLength={80} defaultValue={v?.generation ?? ""} placeholder="J150" className="input" />
        </Field>
        <Field id="yearsFrom" label="От година">
          <input id="yearsFrom" name="yearsFrom" type="number" inputMode="numeric" min={1950} max={2100} defaultValue={v?.yearsFrom ?? ""} className="input font-mono" />
        </Field>
        <Field id="yearsTo" label="До година (празно = в производство)">
          <input id="yearsTo" name="yearsTo" type="number" inputMode="numeric" min={1950} max={2100} defaultValue={v?.yearsTo ?? ""} className="input font-mono" />
        </Field>
      </fieldset>

      <fieldset className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="label mb-4 border-b border-line-strong pb-3 w-full">
          <span className="label-accent">02</span> Двигател и кутия
        </legend>
        <Field id="engineCode" label="Двигател">
          <input id="engineCode" name="engineCode" required maxLength={80} defaultValue={v?.engineCode ?? ""} placeholder="1GD-FTV 2.8 D-4D" className="input" />
        </Field>
        <Field id="fuel" label="Гориво">
          <select id="fuel" name="fuel" defaultValue={v?.fuel ?? "diesel"} className="input">
            <option value="diesel">Дизел</option>
            <option value="petrol">Бензин</option>
          </select>
        </Field>
        <Field id="transmission" label="Скоростна кутия">
          <input id="transmission" name="transmission" required maxLength={80} defaultValue={v?.transmission ?? ""} placeholder="6AT A750F" className="input" />
        </Field>
        <Field id="transmissionType" label="Вид кутия">
          <select id="transmissionType" name="transmissionType" defaultValue={v?.transmissionType ?? "automatic"} className="input">
            <option value="automatic">Автоматична</option>
            <option value="manual">Ръчна</option>
          </select>
        </Field>
      </fieldset>

      <fieldset className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="label mb-4 border-b border-line-strong pb-3 w-full">
          <span className="label-accent">03</span> Вместимости, литри
        </legend>
        <p className="text-sm text-sand sm:col-span-2 lg:col-span-3">
          Празно поле = неизвестно. Клиентът тогава вижда „цена след оглед“ за тази течност.
        </p>
        {CAPACITIES.map(([name, label]) => (
          <Field key={name} id={name} label={label}>
            <input id={name} name={name} inputMode="decimal" defaultValue={v?.[name] ?? ""} className="input font-mono" />
          </Field>
        ))}
      </fieldset>

      <fieldset className="mt-10 grid gap-3">
        <legend className="label mb-4 border-b border-line-strong pb-3 w-full">
          <span className="label-accent">04</span> Проверка
        </legend>
        <Field id="source" label="Източник (сервизна книжка, линк…)">
          <input id="source" name="source" maxLength={500} defaultValue={v?.source ?? ""} className="input" />
        </Field>
        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input type="checkbox" name="verified" defaultChecked={v?.verified ?? false} className="check" />
          Вместимостите са проверени от сервиза
        </label>
      </fieldset>

      <div className="mt-8">
        <SubmitButton className="btn min-h-12 px-6">{v ? "Запиши автомобила" : "Добави автомобила"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
