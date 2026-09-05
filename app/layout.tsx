import type { Metadata } from "next";
import { Gloock, Albert_Sans } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const gloock = Gloock({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-gloock",
  display: "swap",
});

const albertSans = Albert_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-albert-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Alejandría — Yanbal y Natura en Colombia",
    template: "%s · Alejandría",
  },
  description:
    "Catálogo de Yanbal y Natura con más de 800 productos, precios reales y compra por WhatsApp con una consultora independiente.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${gloock.variable} ${albertSans.variable} font-body antialiased`}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
