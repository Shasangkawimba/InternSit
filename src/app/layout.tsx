import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import './globals.css';

export const metadata: Metadata = {
  title: 'InternSit',
  description: 'Kelola status lamaran kerja dan magang kamu dalam satu tempat.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'InternSit', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0B0F14',
};

// Runs before first paint to avoid a flash of the wrong theme. Default: dark.
const themeScript = `(function(){try{var s=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',s!=='light');}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.bunny.net" />
        <link
          rel="stylesheet"
          href="https://fonts.bunny.net/css?family=inter:400,500,600,700,900|jetbrains-mono:400,500&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-background font-sans text-on-surface antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
