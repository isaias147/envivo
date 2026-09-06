// POST /api/admin/logout — borra la cookie de sesión del panel.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_ADMIN } from "@/lib/adminSesion";

export async function POST() {
  const tarro = await cookies();
  tarro.set(COOKIE_ADMIN, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}
