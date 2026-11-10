/** Bulgarian labels for the database enums, shared by all admin screens. */

export const BOOKING_STATUS: Record<string, string> = {
  booked: "Записан",
  in_progress: "В работа",
  done: "Готов",
  cancelled: "Отказан",
  no_show: "Неявил се",
};

export const REQUEST_STATUS: Record<string, string> = {
  new: "Нова",
  contacted: "Свързахме се",
  quoted: "Оферирана",
  booked: "Записан час",
  closed: "Затворена",
};

export const QUOTE_STATUS: Record<string, string> = {
  new: "Нова",
  contacted: "Свързахме се",
  converted: "Превърната в час",
  closed: "Затворена",
};

export const REQUEST_TYPE: Record<string, string> = { repair: "Ремонт", modification: "Модификация" };
export const QUOTE_KIND: Record<string, string> = { service: "Обслужване", repair: "Ремонт", modification: "Модификация" };

export const FLUID_SOURCE: Record<string, string> = {
  engine_oil: "Двигателно масло",
  coolant: "Антифриз",
  transmission: "Масло за скоростна кутия",
  differentials: "Диференциали (преден + заден)",
  transfer_case: "Раздатъчна кутия",
  brake_fluid: "Спирачна течност",
  none: "Без течност",
};

export const BOOKING_SOURCE: Record<string, string> = { web: "сайт", admin: "админ", agent: "AI асистент" };
