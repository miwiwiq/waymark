import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import localFont from "next/font/local";
import { Header } from "@/components/header";
import { Providers } from "./providers";
import "./globals.css";

// An editorial serif for travel stories, paired with a clean UI sans (W5).
const display = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

// Flag emoji (Twemoji, CC BY 4.0) for every platform: Windows has none and shows
// letter pairs. The font covers only the flag code points, so other text is
// untouched and the browser fetches it only for pages that show a flag.
const flags = localFont({
  src: "../node_modules/country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2",
  variable: "--font-flags",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+1F1E6-1F1FF, U+1F3F4, U+E0062-E0063, U+E0065, U+E0067, U+E006C, U+E006E, U+E0073-E0074, U+E0077, U+E007F" }],
});

// Applies the saved theme (or the system's) before first paint, so the page
// never flashes the wrong one. ThemeSwitch keeps it in sync afterwards.
const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem("theme")}catch(e){}var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"})()`;

export const metadata: Metadata = {
  title: "Waymark",
  description: "Travel logs from the places people go.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before React hydrates.
    <html lang="en" className={`h-full antialiased ${display.variable} ${sans.variable} ${flags.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
