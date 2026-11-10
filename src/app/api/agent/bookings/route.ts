import { agentRoute, json, readJsonObject } from "@/lib/agent/http";
import { parseBookingInput } from "@/lib/agent/input";
import { priceJson } from "@/lib/agent/serialize";
import { createBooking } from "@/lib/booking/engine";
import { zonedDate, zonedTime } from "@/lib/booking/time";

/**
 * POST /api/agent/bookings
 *   { "vehicleId": 12, "serviceIds": [1, 4], "date": "2026-11-12", "time": "09:30",
 *     "contact": { "name": "...", "phone": "0888 123 456", "email": null, "consent": true },
 *     "notes": "optional" }
 * Books the lowest free bay. The response carries no cancel link: the agent can
 * not cancel or move bookings (SPEC.md section 9).
 */
export const POST = agentRoute(async (request) => {
  const input = parseBookingInput(await readJsonObject(request));
  const booking = await createBooking({ ...input, source: "agent" });

  return json(
    {
      booking: {
        id: booking.id,
        date: zonedDate(booking.startsAt),
        time: zonedTime(booking.startsAt),
        endTime: zonedTime(booking.endsAt),
        bay: booking.bayName,
        price: priceJson(booking.price),
      },
    },
    201,
  );
});
