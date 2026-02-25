# Privacy Architecture

## Core Guarantee

**Your tax data never leaves your browser. Period.**

OpenTax is a static website. There is no server that receives, processes, or stores your financial information. The "server" is just a file host that delivers the same JavaScript code to everyone — like downloading a calculator app.

## What Data Stays Local

ALL of it:
- Social Security Numbers
- Names, addresses, dates of birth
- W-2 information
- 1099 information
- Investment transactions
- Income amounts
- Deduction details
- Bank account / routing numbers (for refund direct deposit info on forms)
- Computed tax results
- Generated PDFs

## What the Server Sees

Only what any static website sees:
- Your IP address (in server logs — use a VPN if you want to avoid this)
- The fact that you visited the site
- Standard HTTP headers (browser type, etc.)

The server does NOT see:
- Any tax data
- Any form field values
- Any computation results
- Any PDFs generated

## How Data is Stored Locally

### During Session
- Tax data lives in React state (JavaScript memory)
- Lost when you close the tab (unless auto-saved)

### Auto-Save (Optional)
- Saved to browser's IndexedDB
- Encrypted at rest with a key derived from a user-chosen password (or a random key stored in the same browser)
- Survives page refresh and browser restart
- "Clear all data" button available at any time

### Encrypted Export
- User can save their return as a `.opentax` file
- Encrypted with AES-256-GCM (via browser's WebCrypto API)
- Key derived from user's password via PBKDF2 (600,000 iterations, SHA-256)
- File can be stored anywhere (cloud drive, USB, etc.) — useless without the password
- Can be re-imported to resume work

## No Analytics

OpenTax does not include:
- Google Analytics
- Facebook Pixel
- Mixpanel, Amplitude, or any tracking SDK
- Any third-party scripts whatsoever
- Cookies (except browser-standard same-origin storage)

If usage metrics are ever added, they would be limited to:
- Privacy-respecting, self-hosted analytics (e.g., Plausible)
- Aggregate page views only
- No PII, no tax data, no form interactions

## No Accounts

OpenTax does not require:
- Account creation
- Email address
- Phone number
- Any identifying information to use the service

You visit the site, do your taxes, download your PDFs, and leave.

## Open Source Verification

The entire codebase is open source. Anyone can:
1. Read the source code to verify no data is transmitted
2. Inspect network requests in browser DevTools while using the app
3. Build from source and self-host if desired
4. Audit the encryption implementation

## Content Security Policy

The site enforces strict CSP headers:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  connect-src 'none';
  font-src 'self';
  object-src 'none';
  frame-src 'none';
```

Note `connect-src 'none'` — the browser will block any attempt to make network requests from the application. This is enforced by the browser itself, not by our code.

## Self-Hosting

For maximum privacy, users can self-host OpenTax:
```bash
git clone https://github.com/[org]/opentax.git
cd opentax
npm install
npm run build
# Serve the dist/ folder with any static file server
npx serve dist
```

This runs entirely on your machine with zero external network requests.
