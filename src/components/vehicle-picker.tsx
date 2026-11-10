import { Select, TextField } from "./form-fields";

/**
 * The common vehicle picker (SPEC.md 6.1), used by every public form:
 * Марка -> Модел -> Поколение -> Двигател -> Скоростна кутия.
 *
 * With `allowNonStock`, the "Не е стоков джип?" checkbox turns the engine and
 * gearbox dropdowns into free-text fields for swapped drivetrains.
 */

export type PickerVehicle = {
  id: number;
  brand: string;
  model: string;
  generation: string;
  yearsFrom: number | null;
  yearsTo: number | null;
  engineCode: string;
  fuel: "petrol" | "diesel";
  transmission: string;
  transmissionType: "manual" | "automatic";
};

export type VehiclePick = {
  brand: string;
  model: string;
  generation: string;
  engine: string;
  /** Catalogue row; set once the gearbox is chosen. Always null for non-stock. */
  vehicleId: number | null;
  nonStock: boolean;
  customEngine: string;
  customTransmission: string;
};

export const EMPTY_PICK: VehiclePick = {
  brand: "",
  model: "",
  generation: "",
  engine: "",
  vehicleId: null,
  nonStock: false,
  customEngine: "",
  customTransmission: "",
};

const unique = <T,>(values: T[]) => [...new Set(values)];

export function VehiclePicker(props: {
  vehicles: PickerVehicle[];
  value: VehiclePick;
  onChange: (next: VehiclePick) => void;
  allowNonStock?: boolean;
  errors?: { engine?: string; transmission?: string };
}) {
  const { vehicles, value, onChange } = props;
  const set = (patch: Partial<VehiclePick>) => onChange({ ...value, ...patch });

  const models = unique(vehicles.filter((v) => v.brand === value.brand).map((v) => v.model));
  const inModel = vehicles.filter((v) => v.brand === value.brand && v.model === value.model);
  const generations = unique(inModel.map((v) => v.generation));
  const inGeneration = inModel.filter((v) => v.generation === value.generation);
  const engines = unique(inGeneration.map((v) => v.engineCode));
  const gearboxes = inGeneration.filter((v) => v.engineCode === value.engine);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Марка"
          value={value.brand}
          options={unique(vehicles.map((v) => v.brand)).map((b) => ({ value: b, label: b }))}
          onChange={(brand) => set({ brand, model: "", generation: "", engine: "", vehicleId: null })}
        />
        <Select
          label="Модел"
          value={value.model}
          disabled={!value.brand}
          options={models.map((m) => ({ value: m, label: m }))}
          onChange={(model) => set({ model, generation: "", engine: "", vehicleId: null })}
        />
        <div className="sm:col-span-2">
          <Select
            label="Поколение"
            value={value.generation}
            disabled={!value.model}
            options={generations.map((g) => ({ value: g, label: g }))}
            onChange={(generation) => set({ generation, engine: "", vehicleId: null })}
          />
        </div>

        {value.nonStock ? (
          <>
            <TextField
              label="Двигател"
              name="custom-engine"
              hint="напр. 1UZ-FE 4.0 V8"
              maxLength={80}
              value={value.customEngine}
              error={props.errors?.engine}
              onChange={(customEngine) => set({ customEngine })}
            />
            <TextField
              label="Скоростна кутия"
              name="custom-transmission"
              hint="напр. A340F автоматична"
              maxLength={80}
              value={value.customTransmission}
              error={props.errors?.transmission}
              onChange={(customTransmission) => set({ customTransmission })}
            />
          </>
        ) : (
          <>
            <Select
              label="Двигател"
              value={value.engine}
              disabled={!value.generation}
              options={engines.map((code) => {
                const fuel = inGeneration.find((v) => v.engineCode === code)!.fuel;
                return { value: code, label: `${code} · ${fuel === "diesel" ? "дизел" : "бензин"}` };
              })}
              onChange={(engine) => set({ engine, vehicleId: null })}
            />
            <Select
              label="Скоростна кутия"
              value={value.vehicleId ? String(value.vehicleId) : ""}
              disabled={!value.engine}
              options={gearboxes.map((v) => ({
                value: String(v.id),
                label:
                  `${v.transmission} · ${v.transmissionType === "automatic" ? "автоматична" : "ръчна"}` +
                  // Same engine and gearbox across a facelift: tell the rows apart by year.
                  (gearboxes.filter((g) => g.transmission === v.transmission).length > 1
                    ? ` · ${v.yearsFrom ?? "?"}–${v.yearsTo ?? "днес"}`
                    : ""),
              }))}
              onChange={(id) => set({ vehicleId: id ? Number(id) : null })}
            />
          </>
        )}
      </div>

      {props.allowNonStock && (
        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="check mt-0.5"
            checked={value.nonStock}
            onChange={(e) => set({ nonStock: e.target.checked, engine: "", vehicleId: null })}
          />
          <span>
            <span className="font-semibold">Не е стоков джип?</span>
            <span className="mt-1 block text-sm text-muted">
              Отбележете, ако двигателят или скоростната кутия са сменени, и ги опишете със свои думи.
            </span>
          </span>
        </label>
      )}

      <p className="mt-4 text-sm text-muted">Работим само с рамкови модели на Toyota и Lexus GX/LX.</p>
    </>
  );
}

/** True when the pick identifies a car well enough to submit. */
export function isPickComplete(pick: VehiclePick) {
  return pick.nonStock
    ? Boolean(pick.brand && pick.model && pick.generation && pick.customEngine.trim().length >= 2 && pick.customTransmission.trim().length >= 2)
    : pick.vehicleId !== null;
}
