// apps/web/src/pages/_document.tsx
// M29-PWA-S1: Custom document for PWA manifest and meta tags

import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/* PWA manifest & basic meta */}
          <link rel="manifest" href="/manifest.webmanifest" />
          <meta name="theme-color" content="#020617" />
          <link rel="icon" href="/favicon.ico" />
          {/* iOS / Android install friendliness can be extended later */}
        </Head>
        <body className="bg-slate-950">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
