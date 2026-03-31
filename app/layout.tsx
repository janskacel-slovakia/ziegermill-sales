import type { Metadata } from "next";
// 1. Import the fonts
import { Lato, Playfair_Display } from "next/font/google";
import "./globals.css";

// 2. Configure Lato (Body Font)
const lato = Lato({
  subsets: ["latin", "latin-ext"], // latin-ext is crucial for Slovak characters (ľ, š, č, ť, ž, ý, á, í, é)
  weight: ["300", "400", "700"],
  variable: "--font-lato",
  display: "swap",
});

// 3. Configure Playfair Display (Heading Font)
const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"], // 600 or 700 will look great next to your logo
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zieger Mill",
  description: "Loftové byty a ateliéry v budove bývalého mlyna",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 4. Inject the CSS variables into the HTML tag
    <html lang="sk" className={`${lato.variable} ${playfair.variable}`}>
      {/* 5. Set Lato as the default font for the whole body */}
      <body className="font-sans antialiased bg-[#FAF8F5] text-gray-900">
        {children}
      </body>
    </html>
  );
}