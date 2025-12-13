
import type { Metadata } from "next";
import "./globals.css"; // Assuming global css exists or is generated
import { Cinzel, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-display" });
const cormorant = Cormorant_Garamond({ 
  subsets: ["latin"], 
  weight: ["300", "400", "500", "600"],
  variable: "--font-serif" 
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "The Forge's Loom",
  description: "A GAIS SOTA Narrative Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${cinzel.variable} ${cormorant.variable} ${mono.variable} bg-[#050505] text-[#f5f5f4] overflow-hidden`}>
        <div className="noise-overlay fixed inset-0 opacity-[0.07] pointer-events-none z-50"></div>
        <div className="vignette-overlay fixed inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0)_50%,rgba(0,0,0,0.8)_100%)] pointer-events-none z-49"></div>
        {children}
      </body>
    </html>
  );
}
