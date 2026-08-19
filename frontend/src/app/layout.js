import './globals.css';

export const metadata = {
  title: 'GP Clinic - Patient Management System',
  description: 'Premium clinical queue, diagnostic recording, investigations logs, and prescription dispensing system',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
