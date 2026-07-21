// Vercel Serverless Function — mengambil HTML LANGSUNG dari deployment GAS
// (Index.html) setiap kali halaman dibuka, lalu menyajikannya di domain
// ekoinbaleharjo.vercel.app. Efeknya: cukup update & deploy "New version"
// di Apps Script, Vercel OTOMATIS ikut berubah — tidak perlu push HTML lagi.
//
// Kenapa tidak pakai <iframe> atau vercel.json rewrite biasa?
// - <iframe> pernah menyebabkan bug "null response" karena GAS mendeteksi
//   dirinya sedang di-embed dan setXFrameOptionsMode(ALLOWALL) mengacaukan
//   jalur komunikasi internal google.script.run.
// - Kalau cuma "rewrite" murni, GAS /exec biasanya me-redirect (302) ke
//   domain script.googleusercontent.com — kalau redirect ini diteruskan ke
//   browser, address bar akan LONCAT keluar dari vercel.app.
// Solusi di sini: fetch dilakukan di SERVER (Node), redirect otomatis
// diikuti oleh fetch() itu sendiri (tidak pernah sampai ke browser), lalu
// HTML akhirnya kita kirim balik sebagai response biasa dari vercel.app.
//
// GANTI URL INI kalau suatu saat deployment GAS-nya dibuat versi/URL baru:
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwxr2WZ9nHuXTELzNRDTPYQ57iST_Ts5ZO0AEFYNLP3RrCZsmOOMu9FrrLGAHjqu6y-/exec';

// Tag PWA (manifest, ikon, theme-color) SENGAJA tidak ada di Index.html versi
// GAS (karena GAS tidak butuh itu), jadi kita sisipkan manual di sini supaya
// "Add to Home Screen" tetap berfungsi di versi Vercel.
const PWA_TAGS = `
<link rel="icon" type="image/png" sizes="32x32" href="/ekoin-icon-32-favicon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/ekoin-icon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="/ekoin-icon-180-apple-touch.png">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0f5132">
`;

module.exports = async function handler(req, res) {
  try {
    const upstream = await fetch(GAS_WEB_APP_URL, {
      // fetch() Node otomatis mengikuti redirect (termasuk redirect GAS ke
      // script.googleusercontent.com), jadi ini tidak pernah bocor ke browser.
      redirect: 'follow'
    });

    if (!upstream.ok) {
      res.status(502).send('Gagal mengambil halaman dari GAS (status ' + upstream.status + ').');
      return;
    }

    let html = await upstream.text();

    // Sisipkan tag PWA sebelum </head>. Kalau karena suatu sebab tag
    // </head> tidak ketemu (harusnya selalu ada), fallback: tempel di awal.
    if (html.includes('</head>')) {
      html = html.replace('</head>', PWA_TAGS + '</head>');
    } else {
      html = PWA_TAGS + html;
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Jangan di-cache supaya update terbaru dari GAS selalu langsung tampil.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('Terjadi kesalahan saat memuat halaman: ' + (err && err.message ? err.message : String(err)));
  }
};
