import { describe, expect, it } from "vitest";
import { computeSlots, listBookableDays, type BusyInterval, type DayHours } from "@/lib/booking/availability";
import { zonedToUtc } from "@/lib/booking/time";

const rules = { timezone: "Europe/Sofia", slotMinutes: 30, bookingMinDaysAhead: 1, bookingMaxDaysAhead: 30 };
const weekday = (n: number): DayHours => ({ weekday: n, closed: false, opensAt: "08:30:00", closesAt: "18:00:00" });
const hours: DayHours[] = [
  weekday(1),
  weekday(2),
  weekday(3),
  weekday(4),
  weekday(5),
  { weekday: 6, closed: false, opensAt: "09:00:00", closesAt: "14:00:00" },
  { weekday: 7, closed: true, opensAt: null, closesAt: null },
];
const bayIds = [1, 2, 3, 4];

// "Now" is Tuesday 10 Nov 2026, noon in Sofia.
const now = new Date("2026-11-10T10:00:00Z");
const THURSDAY = "2026-11-12";
const SATURDAY = "2026-11-14";
const SUNDAY = "2026-11-15";

const busy = (bayId: number, date: string, from: string, to: string): BusyInterval => ({
  bayId,
  startsAt: zonedToUtc(date, from),
  endsAt: zonedToUtc(date, to),
});
const slots = (date: string, durationMin: number, taken: BusyInterval[] = []) =>
  computeSlots({ date, durationMin, hours, rules, bayIds, busy: taken, now });
const at = (list: ReturnType<typeof slots>, time: string) => list.find((s) => s.time === time);

describe("two bookings at the same time", () => {
  it("offers the same start again and moves the second job to the next bay", () => {
    const first = at(slots(THURSDAY, 60), "09:00")!;
    expect(first.freeBayIds[0]).toBe(1);

    const second = at(slots(THURSDAY, 60, [busy(1, THURSDAY, "09:00", "10:00")]), "09:00")!;
    expect(second.freeBayIds).toEqual([2, 3, 4]);
  });

  it("never offers a bay whose job only partly overlaps", () => {
    // Bay 1 is busy 09:30-10:30; a 60 min job at 09:00 or 10:00 would collide with it.
    const taken = [busy(1, THURSDAY, "09:30", "10:30")];
    expect(at(slots(THURSDAY, 60, taken), "09:00")!.freeBayIds).not.toContain(1);
    expect(at(slots(THURSDAY, 60, taken), "10:00")!.freeBayIds).not.toContain(1);
  });

  it("treats back-to-back jobs as fine: one ends 10:00, the next starts 10:00", () => {
    const taken = [busy(1, THURSDAY, "09:00", "10:00")];
    expect(at(slots(THURSDAY, 60, taken), "10:00")!.freeBayIds[0]).toBe(1);
  });
});

describe("a job ending after closing", () => {
  it("stops offering starts once the job would run past 18:00", () => {
    const list = slots(THURSDAY, 140); // coolant change, 2 h 20 min
    expect(list.at(-1)!.time).toBe("15:30"); // ends 17:50
    expect(at(list, "16:00")).toBeUndefined(); // would end 18:20
  });

  it("allows a job that ends exactly at closing time", () => {
    const list = slots(THURSDAY, 60);
    expect(list.at(-1)!.time).toBe("17:00");
    expect(at(list, "17:30")).toBeUndefined();
  });

  it("uses the shorter Saturday hours", () => {
    const list = slots(SATURDAY, 140);
    expect(list[0].time).toBe("09:00");
    expect(list.at(-1)!.time).toBe("11:30"); // ends 13:50, closing is 14:00
  });

  it("offers nothing when the job is longer than the whole working day", () => {
    expect(slots(SATURDAY, 301)).toEqual([]);
  });
});

describe("all 4 bays full", () => {
  const allBays = bayIds.map((id) => busy(id, THURSDAY, "09:00", "11:00"));

  it("hides every start that would touch the fully booked interval", () => {
    const list = slots(THURSDAY, 60, allBays);
    for (const time of ["08:30", "09:00", "09:30", "10:00", "10:30"]) expect(at(list, time)).toBeUndefined();
    expect(at(list, "11:00")!.freeBayIds).toEqual([1, 2, 3, 4]);
  });

  it("offers the slot again as soon as one bay is free (a cancelled booking is simply not in the busy list)", () => {
    const threeBays = allBays.filter((b) => b.bayId !== 3);
    expect(at(slots(THURSDAY, 60, threeBays), "09:00")!.freeBayIds).toEqual([3]);
  });

  it("returns no slots at all when the whole day is full", () => {
    const fullDay = bayIds.map((id) => busy(id, THURSDAY, "08:30", "18:00"));
    expect(slots(THURSDAY, 60, fullDay)).toEqual([]);
  });
});

describe("booking window and opening days", () => {
  it("has no slots on Sunday, today, or beyond 30 days", () => {
    expect(slots(SUNDAY, 60)).toEqual([]);
    expect(slots("2026-11-10", 60)).toEqual([]); // today
    expect(slots("2026-12-11", 60)).toEqual([]); // day 31
    expect(slots("2026-12-10", 60).length).toBeGreaterThan(0); // day 30, a Thursday
  });

  it("lists tomorrow through day 30 and flags Sundays as closed", () => {
    const days = listBookableDays(now, rules, hours);
    expect(days[0].date).toBe("2026-11-11");
    expect(days.at(-1)!.date).toBe("2026-12-10");
    expect(days).toHaveLength(30);
    expect(days.find((d) => d.date === SUNDAY)!.open).toBe(false);
  });

  it("starts on the 30-minute grid in Sofia time, including across the clock change", () => {
    const winter = at(slots(THURSDAY, 60), "08:30")!;
    expect(winter.startsAt.toISOString()).toBe("2026-11-12T06:30:00.000Z"); // UTC+2
    const summerNow = new Date("2026-06-01T10:00:00Z");
    const summer = computeSlots({ date: "2026-06-02", durationMin: 60, hours, rules, bayIds, busy: [], now: summerNow });
    expect(summer[0].startsAt.toISOString()).toBe("2026-06-02T05:30:00.000Z"); // UTC+3
  });
});
