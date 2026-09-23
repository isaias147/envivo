import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import RestaurarScrollLogin from "@/components/RestaurarScrollLogin";

// La interfaz usa la fuente del sistema (globals.css). Plus Jakarta Sans se
// carga solo para el logotipo (components/Logo), como pide envivo-ui.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EnVivo",
  description: "¿Qué hay pasando cerca de mí esta noche? Eventos en vivo en Cali.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EnVivo",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000", // = --fondo (el viewport no lee variables CSS)
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={jakarta.variable}>
      <body>
        {children}
        <RegisterSW />
        <RestaurarScrollLogin />
      </body>
    </html>
  );
}
