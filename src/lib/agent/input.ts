/**
 * Turns an agent request body into checked values. The checks themselves are
 * the website's own (src/lib/booking/validation, src/lib/booking/time); this
 * file only collects the failures into one INVALID_INPUT error.
 */
import { isValidDate, isValidTime } from "@/lib/booking/time";
import { parseContact, parseId, parseIdList, type Contact } from "@/lib/booking/validation";
import { invalid } from "./http";

type Body = Record<string, unknown>;
type Fields = Record<string, string>;

const MAX_NOTES = 1000;

function finish(fields: Fields) {
  if (Object.keys(fields).length > 0) throw invalid("Some fields are missing or invalid. See `fields`.", fields);
}

function vehicleAndServices(body: Body, fields: Fields) {
  const vehicleId = parseId(body.vehicleId);
  if (!vehicleId) fields.vehicleId = "Required: a positive integer id from GET /api/agent/vehicles.";
  const serviceIds = parseIdList(body.serviceIds);
  if (!serviceIds) fields.serviceIds = "Required: an array of 1 to 20 positive integer ids from GET /api/agent/services.";
  return { vehicleId: vehicleId!, serviceIds: serviceIds! };
}

function date(body: Body, fields: Fields) {
  if (!isValidDate(body.date)) fields.date = 'Required: a real calendar date as "YYYY-MM-DD" (workshop time, Europe/Sofia).';
  return body.date as string;
}

/** name + phone (+ optional email) and `consent: true` — the same rules as the web form. */
function contact(body: Body, fields: Fields): Contact {
  const parsed = parseContact(body.contact);
  if (parsed.ok) return parsed.contact;
  for (const [field, message] of Object.entries(parsed.errors)) fields[`contact.${field}`] = message;
  if (parsed.errors.consent) {
    fields["contact.consent"] = "Required: true, sent only after the customer agreed to their data being processed.";
  }
  return null as never;
}

export function parseAvailabilityInput(body: Body) {
  const fields: Fields = {};
  const result = { ...vehicleAndServices(body, fields), date: date(body, fields) };
  finish(fields);
  return result;
}

export function parseBookingInput(body: Body) {
  const fields: Fields = {};
  const ids = vehicleAndServices(body, fields);
  const day = date(body, fields);
  if (!isValidTime(body.time)) fields.time = 'Required: a start time as "HH:MM" taken from POST /api/agent/availability.';

  let notes: string | null = null;
  if (body.notes !== undefined && body.notes !== null) {
    if (typeof body.notes !== "string" || body.notes.length > MAX_NOTES) {
      fields.notes = `Optional: text of at most ${MAX_NOTES} characters.`;
    } else {
      notes = body.notes.trim() || null;
    }
  }

  const who = contact(body, fields);
  finish(fields);
  return { ...ids, date: day, time: body.time as string, notes, contact: who };
}

export function parseQuoteInput(body: Body) {
  const fields: Fields = {};
  const ids = vehicleAndServices(body, fields);
  const who = contact(body, fields);
  finish(fields);
  return { ...ids, contact: who };
}

/** An id from the URL path or query string ("42"). */
export function parseIdText(value: string | null | undefined): number | null {
  return value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : null;
}
