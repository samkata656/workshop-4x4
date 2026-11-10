/**
 * Starter data from SPEC.md sections 3-5. Everything marked "(starter)" in the
 * spec is editable later in the admin panel; the seed never overwrites edits.
 */

export const baySeed = [
  { id: 1, name: "Бокс 1" },
  { id: 2, name: "Бокс 2" },
  { id: 3, name: "Бокс 3" },
  { id: 4, name: "Бокс 4" },
];

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export const openingHoursSeed = [
  { weekday: 1, closed: false, opensAt: "08:30", closesAt: "18:00" },
  { weekday: 2, closed: false, opensAt: "08:30", closesAt: "18:00" },
  { weekday: 3, closed: false, opensAt: "08:30", closesAt: "18:00" },
  { weekday: 4, closed: false, opensAt: "08:30", closesAt: "18:00" },
  { weekday: 5, closed: false, opensAt: "08:30", closesAt: "18:00" },
  { weekday: 6, closed: false, opensAt: "09:00", closesAt: "14:00" },
  { weekday: 7, closed: true, opensAt: null, closesAt: null },
];

export const settingsSeed = {
  id: 1,
  timezone: "Europe/Sofia",
  slotMinutes: 30,
  bookingMinDaysAhead: 1,
  bookingMaxDaysAhead: 30,
};

export const fluidPriceSeed = [
  { fluid: "engine_oil", name: "Двигателно масло", pricePerLitreEur: "12.00" },
  { fluid: "atf", name: "ATF (масло за автоматична кутия)", pricePerLitreEur: "15.00" },
  { fluid: "gear_oil", name: "Трансмисионно масло", pricePerLitreEur: "14.00" },
  { fluid: "coolant", name: "Антифриз", pricePerLitreEur: "6.00" },
  { fluid: "brake_fluid", name: "Спирачна течност", pricePerLitreEur: "10.00" },
] as const;

export const consumableSeed = [
  { slug: "oil-filter", name: "Маслен филтър", priceEur: "20.00" },
  { slug: "basic-consumables", name: "Основни консумативи", priceEur: "5.00" },
];

export const serviceSeed = [
  {
    slug: "engine-oil",
    name: "Смяна на двигателно масло и филтър",
    durationMin: 60,
    fluidSource: "engine_oil",
    labourEur: "40.00",
    consumables: ["oil-filter", "basic-consumables"],
  },
  {
    slug: "coolant",
    name: "Смяна на антифриз",
    durationMin: 140,
    fluidSource: "coolant",
    labourEur: "80.00",
    consumables: ["basic-consumables"],
  },
  {
    slug: "transmission-oil",
    name: "Смяна на масло в скоростна кутия",
    durationMin: 90,
    fluidSource: "transmission",
    labourEur: "70.00",
    consumables: ["basic-consumables"],
  },
  {
    slug: "differential-oil",
    name: "Смяна на масло в преден и заден диференциал",
    durationMin: 75,
    fluidSource: "differentials",
    labourEur: "60.00",
    consumables: ["basic-consumables"],
  },
  {
    slug: "transfer-case-oil",
    name: "Смяна на масло в раздатъчна кутия",
    durationMin: 45,
    fluidSource: "transfer_case",
    labourEur: "35.00",
    consumables: ["basic-consumables"],
  },
  {
    slug: "brake-pads",
    name: "Смяна на накладки (на ос)",
    durationMin: 90,
    fluidSource: "none",
    labourEur: "70.00",
    consumables: ["basic-consumables"],
  },
  {
    slug: "brake-fluid",
    name: "Смяна на спирачна течност",
    durationMin: 60,
    fluidSource: "brake_fluid",
    labourEur: "45.00",
    consumables: ["basic-consumables"],
  },
] as const;
