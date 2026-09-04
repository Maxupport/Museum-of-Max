import type { Metadata } from "next";
import { Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

const notoSans = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-sans",
});

const notoSerif = Noto_Serif_TC({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-noto-serif",
});

export const metadata: Metadata = {
  title: "Maxupport | 私人博物館 (Private Museum)",
  description: "跨界的思維，效率與價值的實踐者。記錄 Max 超過 14 年跨界軌跡：風險投資、職涯經歷、金融保險議題分析、聲音探索、創作 Lab 與跨世代溝通。",
  keywords: [
    "Maxupport",
    "風險投資",
    "Venture Capital",
    "創投項目評估",
    "金融保險議題分析",
    "聲音探索",
    "創作 Lab",
    "小說連載",
    "跨世代溝通",
    "職涯經歷",
    "個人作品集"
  ],
  authors: [{ name: "Maxupport Curator" }],
  creator: "Maxupport",
  publisher: "Maxupport Private Museum",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: "Maxupport | 私人博物館",
    description: "跨界的思維，效率與價值的實踐者。收錄風險投資、金融保險分析、創作 Lab 小說連載與跨世代溝通。",
    url: "https://maxupport.com",
    siteName: "Maxupport Private Museum",
    locale: "zh_TW",
    type: "website",
    images: [
      {
        url: "/favicon.ico",
        width: 1200,
        height: 630,
        alt: "Maxupport 私人博物館",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maxupport | 私人博物館",
    description: "跨界的思維，效率與價值的實踐者。",
  },
};

// JSON-LD 結構化資料 (提供給 ChatGPT, Claude, Perplexity 等 AI 搜尋引擎自動解析)
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://maxupport.com/#person",
      "name": "Maxupport",
      "jobTitle": "Venture Investor & Executive Coach",
      "description": "擁有 14 年以上跨界軌跡之風險投資、財務稽核、聲音藝術與跨世代溝通專家。",
      "knowsAbout": [
        "Venture Capital",
        "Financial Audit",
        "Insurance Analysis",
        "Creative Writing",
        "Sound Exploration",
        "Executive Coaching"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://maxupport.com/#website",
      "url": "https://maxupport.com",
      "name": "Maxupport Private Museum",
      "description": "Maxupport 的私人策展空間與數位作品集博物館。",
      "publisher": {
        "@id": "https://maxupport.com/#person"
      }
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${notoSans.variable} ${notoSerif.variable}`}>
        <Header />
        <main className="app-container">
          {children}
        </main>
      </body>
    </html>
  );
}
