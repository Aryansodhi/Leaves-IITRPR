import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";

const sans = Space_Grotesk({
  variable: "--font-app-sans",
  display: "swap",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-app-mono",
  weight: ["400", "500"],
  display: "swap",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LeaveFlow | IIT Ropar",
  description:
    "Unified leave & approval workspace for IIT Ropar staff and faculty.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${mono.variable} bg-canvas text-slate-900 antialiased`}
      >
        <div className="min-h-dvh bg-grid text-base">
          <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-8 sm:py-10">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
