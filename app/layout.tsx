import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teller Waitlist Email",
  description: "Serviço de email transacional pós-cadastro na waitlist",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
