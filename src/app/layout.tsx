import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Kivo — Gestión Financiera de Proyectos",
    template: "%s | Kivo",
  },
  description:
    "Gestión financiera para empresas que manejan proyectos en Perú. Control de presupuestos, gastos, IGV, detracciones y flujo de caja.",
  keywords: ["gestión financiera", "proyectos", "IGV", "detracciones", "Perú", "PME"],
  authors: [{ name: "Kivo" }],
  robots: {
    index: false, // App privada — no indexar
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
