import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { UPProvider } from "@/context/up-context";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Residencies by Hubs Network",
    template: "%s | Hubs Network",
  },
  description:
    "An open platform for mapping hub capabilities, needs and networks. Browse registered hubs, register your own, and explore the residencies ecosystem.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground">
        <UPProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </UPProvider>
      </body>
    </html>
  );
}
