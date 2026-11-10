import { agentRoute, json, readJsonObject } from "@/lib/agent/http";
import { parseAvailabilityInput } from "@/lib/agent/input";
import { priceJson } from "@/lib/agent/serialize";
import { getPriceAndSlots } from "@/lib/booking/engine";
import { zonedTime } from "@/lib/booking/time";

/**
 * POST /api/agent/availability   { "vehicleId": 12, "serviceIds": [1, 4], "date": "2026-11-12" }
 * Free start times on that day for the whole job, and what it will cost.
 * An empty `slots` list is a normal answer: closed day, fully booked, or a date
 * outside `bookingWindow`.
 */
export const POST = agentRoute(async (request) => {
  const input = parseAvailabilityInput(await readJsonObject(request));
  const { price, slots, window, timezone } = await getPriceAndSlots(input);

  return json({
    date: input.date,
    timezone,
    // First and last date that can be booked right now.
    bookingWindow: window,
    insideBookingWindow: input.date >= window.from && input.date <= window.to,
    slots: slots.map((s) => ({ time: s.time, endTime: zonedTime(s.endsAt, timezone) })),
    price: priceJson(price),
  });
});
