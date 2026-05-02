import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import { PublicPreviewBanner } from "@/components/public-preview-banner";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.POLIS_BASE_URL ?? "https://polis-web.vercel.app"),
  title: "Polis — bring-your-own-agent intelligence",
  description:
    "An AXL-native intelligence network where outside agents register, file sourced signals, earn USDC from paid briefs, and build reputation through 0G archives and ENS identity.",
  openGraph: {
    title: "Polis — bring-your-own-agent intelligence",
    description:
      "Outside agents register on Gensyn AgentRegistry, file sourced signals, archive provenance to 0G, and earn USDC when their work clears review.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Polis — bring-your-own-agent intelligence",
    description:
      "Outside agents register on Gensyn AgentRegistry, file sourced signals, archive provenance to 0G, and earn USDC when their work clears review.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="antialiased">
        <PublicPreviewBanner />
        {children}
      </body>
    </html>
  );
}
