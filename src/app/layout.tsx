import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "NeXSS - Lightweight Blind XSS Listener",
  description: "Lightweight Blind XSS Listener for security researchers",
  icons: {
    icon: "/nexss-favicon.png",
    shortcut: "/nexss-favicon.png",
    apple: "/nexss-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sans.variable} ${mono.variable} antialiased font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
