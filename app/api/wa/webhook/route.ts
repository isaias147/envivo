// GET/POST /api/wa/webhook — WhatsApp Cloud API (camino A). DORMIDO.
//
// La Sesión 12 usa confirmación manual desde /admin/registro. Este archivo
// deja listo el webhook para cuando exista la cuenta de Meta: al definir las
// variables de entorno se activa solo, sin tocar el resto de la app.
//
// Variables necesarias para activarlo:
//   WHATSAPP_APP_SECRET     — "App Secret" de la app de Meta (firma los POST)
//   WHATSAPP_VERIFY_TOKEN   — cadena inventada; la misma que pongas en Meta
//
// Qué hace cuando está activo:
//   GET  → responde el `hub.challenge` de Meta si el verify_token coincide.
//   POST → valida la firma X-Hub-Signature-256, saca el número del remitente
//          y el primer grupo de 4 dígitos del texto, y llama a
//          `confirmarCodigo(remitente, codigo)` (la misma que el modo manual).

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { confirmarCodigo } from "@/lib/registroPublicador";

const APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "";

function inactivo() {
  return new NextResponse("WhatsApp webhook inactivo", { status: 503 });
}

export async function GET(request: Request) {
  if (!APP_SECRET || !VERIFY_TOKEN) return inactivo();

  const url = new URL(request.url);
  const modo = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  if (modo === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  if (!APP_SECRET) return inactivo();

  const crudo = await request.text();
  const firma = request.headers.get("x-hub-signature-256") ?? "";
  const esperada =
    "sha256=" + createHmac("sha256", APP_SECRET).update(crudo).digest("hex");

  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new NextResponse("Firma inválida", { status: 401 });
  }

  try {
    const cuerpo = JSON.parse(crudo) as {
      entry?: {
        changes?: {
          value?: {
            messages?: { from?: string; text?: { body?: string } }[];
          };
        }[];
      }[];
    };

    const mensajes =
      cuerpo.entry?.flatMap(
        (e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? [],
      ) ?? [];

    for (const m of mensajes) {
      const de = m.from ?? "";
      const codigo = (m.text?.body ?? "").match(/\b(\d{4})\b/)?.[1];
      if (de && codigo) {
        await confirmarCodigo(de, codigo);
      }
    }
  } catch {
    // Un cuerpo raro no debe hacer que Meta reintente en bucle.
  }

  return new NextResponse(null, { status: 200 });
}
