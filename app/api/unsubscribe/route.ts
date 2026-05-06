import type { NextRequest } from "next/server";

import {
  removeEmailRecipientByEmail,
  verifyUnsubscribeToken,
} from "@/lib/backend/tasks-service";

export const runtime = "nodejs";

function renderHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:480px;margin:80px auto;padding:0 24px;">
  <h1 style="font-size:22px;margin:0 0 12px;">${title}</h1>
  <p style="margin:0;color:#374151;">${body}</p>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const token = searchParams.get("token")?.trim() ?? "";

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return new Response(
      renderHtml(
        "Ungültiger Link",
        "Dieser Abmeldelink ist ungültig. Bitte überprüfe den Link oder wende dich an den Technischen Leiter.",
      ),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  try {
    await removeEmailRecipientByEmail(email);
  } catch {
    return new Response(
      renderHtml(
        "Fehler",
        "Die Abmeldung konnte nicht durchgeführt werden. Bitte versuche es später erneut.",
      ),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return new Response(
    renderHtml(
      "Erfolgreich abgemeldet",
      `Die E-Mail-Adresse <strong>${email}</strong> wurde aus der Verteilerliste für Arbeitseinsätze entfernt. Du erhältst keine weiteren Benachrichtigungen. <br />Falls dies ein Fehler war oder du dich erneut anmelden möchtest, wende dich bitte an ${process.env.NEXT_PUBLIC_TECHNICAL_CONTACT_NAME || "den Technischen Leiter"}${process.env.NEXT_PUBLIC_TECHNICAL_CONTACT_EMAIL ? ` oder an <a href="mailto:${process.env.NEXT_PUBLIC_TECHNICAL_CONTACT_EMAIL}">${process.env.NEXT_PUBLIC_TECHNICAL_CONTACT_EMAIL}</a>` : ""}.`,
    ),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
