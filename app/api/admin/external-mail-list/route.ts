import type { NextRequest } from "next/server";

import { HttpError, toRouteErrorResponse } from "@/lib/backend/errors";
import { requireAdminRequest } from "@/lib/backend/route-helpers";
import { parseMailListVariant } from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

const BREVO_CONTACTS_URL_BASE = "https://api.brevo.com/v3/contacts/lists";

type BrevoContact = {
  id: number;
  email: string;
  attributes?: {
    VORNAME?: string | null;
    NACHNAME?: string | null;
  } | null;
};

type BrevoResponse = {
  contacts?: BrevoContact[];
  count?: number;
};

export type ExternalMailContact = {
  id: number;
  email: string;
  vorname: string | null;
  nachname: string | null;
};

export async function GET(request: NextRequest) {
  try {
    requireAdminRequest(request);

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new HttpError(
        500,
        "BREVO_API_KEY ist nicht konfiguriert",
        "config_missing",
      );
    }

    const variant = parseMailListVariant(
      new URL(request.url).searchParams.get("list"),
    );
    const envName =
      variant === "testing" ? "BREVO_LIST_ID_TESTING" : "BREVO_LIST_ID";
    const listIdRaw = process.env[envName];
    const listId = Number(listIdRaw);
    if (!listIdRaw || !Number.isInteger(listId) || listId <= 0) {
      throw new HttpError(
        500,
        `${envName} ist nicht konfiguriert`,
        "config_missing",
      );
    }

    const url = `${BREVO_CONTACTS_URL_BASE}/${listId}/contacts?limit=500`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new HttpError(
        502,
        `Brevo API Fehler (${response.status})`,
        "brevo_error",
      );
    }

    const data = (await response.json()) as BrevoResponse;

    const contacts: ExternalMailContact[] = (data.contacts ?? []).map(
      (contact) => ({
        id: contact.id,
        email: contact.email,
        vorname: contact.attributes?.VORNAME?.trim() || null,
        nachname: contact.attributes?.NACHNAME?.trim() || null,
      }),
    );

    contacts.sort((a, b) => {
      const an = (a.nachname ?? "").toLocaleLowerCase("de");
      const bn = (b.nachname ?? "").toLocaleLowerCase("de");
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      return an.localeCompare(bn, "de");
    });

    return Response.json({ contacts });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
