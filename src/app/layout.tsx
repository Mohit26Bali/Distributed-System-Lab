import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Headings only: an instrument-panel face that suits the oscilloscope look
const chakra = Chakra_Petch({
  variable: "--font-chakra",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Distributed Systems Lab",
  description: "Learn distributed systems by simulating, breaking, and inspecting them.",
};

export const viewport: Viewport = {
  themeColor: "#06130d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${chakra.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg-canvas text-text-primary">
        {children}
      </body>
    </html>
  );
}
