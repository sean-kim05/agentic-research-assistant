import type { Metadata } from "next";
import { Inter, Newsreader, Geist_Mono } from "next/font/google";
import "./globals.css";

// Inter = UI sans, Newsreader = serif (headings + answer prose), Geist Mono =
// labels/scores. All three are variable fonts, so no per-weight imports needed.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Docent — agentic research assistant",
  description:
    "Ask questions across your documents and the live web — decomposed, retrieved, and cited. Next.js + FastAPI + Claude + Pinecone.",
};

// Set the theme on <html> before first paint so there's no light/dark flash.
// Runtime toggling + persistence lives in lib/theme.ts.
const themeScript = `try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',(t==='dark'||t==='light')?t:'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${newsreader.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
