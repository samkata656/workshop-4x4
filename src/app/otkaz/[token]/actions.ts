"use server";

import { refresh } from "next/cache";
import { cancelBookingByToken } from "@/lib/booking/engine";

/** The token in the link is the only credential; it is 64 random hex characters. */
export async function cancelBookingAction(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return;
  await cancelBookingByToken(token);
  refresh(); // re-render the page so it shows "Часът е отказан"
}
