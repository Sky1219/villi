import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { AnatomyBanner } from "@/components/AnatomyBanner";

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Villi",
  description: "Can a body with this much intestine actually use this? Cited answers for people with short bowel syndrome or an ostomy.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1714" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${atkinson.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <ConvexClientProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10">
            <AnatomyBanner />
            {children}
          </div>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
