/** Fixed choices on the request forms (SPEC.md 6.3 and 6.4). Shared by browser and server. */

export const REPAIR_SYMPTOMS = [
  "шум",
  "теч",
  "лампа на таблото",
  "вибрации",
  "трудно палене",
  "проблем със скоростите",
  "друго",
] as const;

export const MODIFICATION_OPTIONS = [
  "Повдигане +5 cm (пружини + амортисьори)",
  "Шнорхел",
  "Джанти и гуми",
  "Стоманени брони",
  "Стоманени кори под шасито",
  "Чекмеджета за багажника по поръчка",
  "LED бар и халогени",
] as const;

export type RequestType = "repair" | "modification";

export const OPTIONS_BY_TYPE: Record<RequestType, readonly string[]> = {
  repair: REPAIR_SYMPTOMS,
  modification: MODIFICATION_OPTIONS,
};

export const MAX_DESCRIPTION = 4000;
export const MAX_MILEAGE_KM = 2_000_000;
