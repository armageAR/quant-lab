import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './styles.css';

export const metadata: Metadata = {
  title: 'Quant Lab',
  description: 'Multi-market quantitative research platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
