import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Attila Nemet",
  description: "ICT professional, Space Technologies Master, 42 School student",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
