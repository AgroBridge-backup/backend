import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    template: '%s | AgroBridge',
    default: 'AgroBridge - Farm to Table Traceability',
  },
  description: 'Trace your food from farm to table. Meet the farmers, see the journey.',
  keywords: ['traceability', 'farming', 'agriculture', 'organic', 'sustainable', 'food safety'],
  authors: [{ name: 'AgroBridge' }],
  creator: 'AgroBridge',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'AgroBridge',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@agrobridge',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
