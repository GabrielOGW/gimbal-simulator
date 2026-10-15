import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gimbal Simulator",
  description:
    "Monte e simule setups de câmera em gimbals: peso, centro de massa, capacidade e ajustes de balanceamento antes do set.",
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  width: "device-width",
  initialScale: 1,
  // Ocupa a tela toda no iPhone (atrás do notch/Dynamic Island e do home
  // indicator); as áreas seguras são respeitadas via --sa-* em globals.css.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
