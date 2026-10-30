// "Už čoskoro" page for ziegermill.sk while the new site is tested on workers.dev.
// When the site goes live, ziegermill.sk moves to the ziegermill-sales Worker and this one is retired.
import logo from "../public/logo.svg";

const svg = logo.replace(/<\?xml[^>]*>\s*/, "").replace(/<!--[\s\S]*?-->\s*/g, "");

const html = `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ziegermill · Už čoskoro</title>
<meta name="description" content="Ziegermill – ateliéry a byty v Bratislave. Už čoskoro.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
  html, body { height: 100%; margin: 0; }
  body {
    background: #f4f5ef; color: #544740;
    font-family: "Google Sans", system-ui, sans-serif;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2.5rem; padding: 0 16px; box-sizing: border-box; text-align: center;
  }
  .logo svg { width: min(420px, 80vw); height: auto; display: block; }
  h1 { margin: 0; font-weight: 500; font-size: clamp(1.5rem, 4vw, 2.25rem); letter-spacing: 0.02em; }
</style>
</head>
<body>
  <div class="logo" role="img" aria-label="Ziegermill">${svg}</div>
  <h1>Už čoskoro</h1>
</body>
</html>`;

export default {
  fetch() {
    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
    });
  },
};
