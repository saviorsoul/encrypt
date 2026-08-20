import {
  GDPR_DATA_PAGE_INTRO,
  GDPR_DATA_PAGE_NOTICE,
  GDPR_DATA_PAGE_TITLE,
  GDPR_DATA_SECTIONS,
} from './gdprDataContent.ts';

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const PAGE_STYLES = `
  :root {
    color-scheme: light;
    --text: #1a1a1a;
    --text-muted: #5c5c5c;
    --surface: #ffffff;
    --border: #e0e0e0;
    --accent: #02baa5;
    --page-bg: #f6f7f8;
  }
  html[data-theme='dark'] {
    color-scheme: dark;
    --text: #f2f2f2;
    --text-muted: #b3b3b3;
    --surface: #1e1e1e;
    --border: #3a3a3a;
    --page-bg: #121212;
  }
  @media (prefers-color-scheme: dark) {
    html:not([data-theme]) {
      color-scheme: dark;
      --text: #f2f2f2;
      --text-muted: #b3b3b3;
      --surface: #1e1e1e;
      --border: #3a3a3a;
      --page-bg: #121212;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Noto Sans", system-ui, -apple-system, sans-serif;
    line-height: 1.5;
    color: var(--text);
    background: var(--page-bg);
  }
  .page {
    max-width: 40rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 2.5rem;
  }
  .back {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--accent);
    font: inherit;
    padding: 0;
    margin: 0 0 1rem;
    cursor: pointer;
    text-decoration: underline;
  }
  h1 {
    margin: 0 0 0.75rem;
    font-size: 1.5rem;
    line-height: 1.25;
    text-align: center;
  }
  .intro {
    margin: 0 0 1.25rem;
    color: var(--text-muted);
    font-size: 0.9375rem;
  }
  .notice {
    margin: 0 0 1.25rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    background: var(--surface);
    color: var(--text);
    font-size: 0.9375rem;
  }
  section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    margin: 0 0 0.75rem;
  }
  section h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    font-weight: 600;
  }
  section p {
    margin: 0 0 0.5rem;
    color: var(--text-muted);
    font-size: 0.9375rem;
  }
  section p:last-child { margin-bottom: 0; }
  ul {
    margin: 0.25rem 0 0;
    padding-left: 1.25rem;
    color: var(--text-muted);
    font-size: 0.9375rem;
  }
  li + li { margin-top: 0.25rem; }
`;

const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  var keys = ['encrypt:feed-lab:settings', 'encrypt:feednt:settings'];
  var colorMode = null;

  try {
    for (var i = 0; i < keys.length; i += 1) {
      var raw = localStorage.getItem(keys[i]);
      if (!raw) {
        continue;
      }
      var parsed = JSON.parse(raw);
      if (
        parsed &&
        (parsed.colorMode === 'dark' || parsed.colorMode === 'light')
      ) {
        colorMode = parsed.colorMode;
        break;
      }
    }
  } catch (_error) {
    colorMode = null;
  }

  if (colorMode) {
    document.documentElement.setAttribute('data-theme', colorMode);
  }
})();
`.trim();

export function renderGdprPageHtml(): string {
  const sections = GDPR_DATA_SECTIONS.map((section) => {
    const paragraphs = section.paragraphs
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join('');
    const bullets =
      section.bullets && section.bullets.length > 0
        ? `<ul>${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
        : '';

    return `<section id="${escapeHtml(section.id)}">
  <h2>${escapeHtml(section.title)}</h2>
  ${paragraphs}
  ${bullets}
</section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(GDPR_DATA_PAGE_TITLE)}</title>
    <meta name="description" content="${escapeHtml(GDPR_DATA_PAGE_INTRO)}" />
    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
    <script>${THEME_BOOTSTRAP_SCRIPT}</script>
    <style>${PAGE_STYLES}</style>
  </head>
  <body>
    <main class="page">
      <button type="button" class="back" onclick="history.back()">Back</button>
      <h1>${escapeHtml(GDPR_DATA_PAGE_TITLE)}</h1>
      <p class="notice">${escapeHtml(GDPR_DATA_PAGE_NOTICE)}</p>
      <p class="intro">${escapeHtml(GDPR_DATA_PAGE_INTRO)}</p>
      ${sections}
    </main>
  </body>
</html>
`;
}
