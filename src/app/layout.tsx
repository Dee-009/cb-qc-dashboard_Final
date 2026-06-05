import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/ui/Sidebar';

export const metadata: Metadata = {
  title: 'Crown & Bridge QC | SKDLA',
  description: 'Crown & Bridge Quality Control Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar />
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
