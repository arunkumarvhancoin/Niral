import type { Metadata } from 'next';
import './globals.css';
import { WorkspaceProvider } from '../components/providers/workspace-provider';

export const metadata: Metadata = {
  title: 'Niral - CRM Platform',
  description: 'Modern, scalable SaaS CRM platform with complete team isolation and RBAC',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/niral-icon.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <WorkspaceProvider>
          {children}
        </WorkspaceProvider>
      </body>
    </html>
  );
}
