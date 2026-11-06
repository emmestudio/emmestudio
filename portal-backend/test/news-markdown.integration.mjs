import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const temp = await mkdtemp(resolve("test/.news-markdown-"));
try {
  const output = join(temp, "renderer.mjs");
  await build({
    entryPoints: [resolve("app/news/news-markdown.tsx")],
    outfile: output,
    bundle: true,
    packages: "external",
    platform: "node",
    format: "esm",
    jsx: "automatic",
    tsconfig: "tsconfig.json",
  });
  const { default: NewsMarkdown, NewsInlineMarkdown, plainNewsText } = await import(pathToFileURL(output).href);
  const render = (source) =>
    renderToStaticMarkup(React.createElement(NewsMarkdown, { source }));

  const announcement = render(
    "# Nasce EMME LABEL: una nuova visione per la musica indipendente\n\n" +
    "*Dall’esperienza di Emme Studio prende vita una nuova realtà.*\n\n" +
    "**Un nuovo capitolo prende forma.** Nasce ufficialmente **EMME LABEL**, " +
    "un’etichetta dedicata all’identità artistica.\n\n" +
    "### Una realtà indipendente, una visione condivisa\n\n" +
    "[Scopri EMME LABEL](https://emmestudioproduction.it/label.html)"
  );
  assert.match(announcement, /<h2>Nasce EMME LABEL: una nuova visione/);
  assert.match(announcement, /<em>Dall’esperienza di Emme Studio/);
  assert.match(announcement, /<strong>Un nuovo capitolo prende forma\.<\/strong>/);
  assert.match(announcement, /<strong>EMME LABEL<\/strong>/);
  assert.match(announcement, /<h4>Una realtà indipendente/);
  assert.match(announcement, /href="https:\/\/emmestudioproduction\.it\/label\.html"/);
  assert.doesNotMatch(announcement, /\*\*Un nuovo capitolo|### Una realtà/);

  const olderNews = render("Il primo paragrafo.\n\nIl secondo paragrafo.\nSeconda riga.");
  assert.match(olderNews, /<p>Il primo paragrafo\.<\/p><p>Il secondo paragrafo\.<br\/>Seconda riga\.<\/p>/);
  assert.match(render("## Sottotitolo\n\n- Una voce\n- Un’altra\n\n1. Primo\n2. Secondo"),
    /<h3>Sottotitolo<\/h3>.*<ul>.*<li>Una voce<\/li>.*<\/ul>.*<ol>.*<li>Primo<\/li>/);
  assert.match(render("> Una citazione importante."), /<blockquote><p>Una citazione importante\.<\/p><\/blockquote>/);
  assert.match(render("\\*non corsivo\\*"), /<p>\*non corsivo\*<\/p>/);
  assert.match(render("Uno & due, città, perché, l’identità: è così."),
    /Uno &amp; due, città, perché, l’identità: è così/);

  const malicious = render("<script>alert(1)</script>\n\n" +
    "[clicca](javascript:alert(1)) [ok](https://example.com/) " +
    "<img src=x onerror=alert(1)>");
  assert.doesNotMatch(malicious, /<script>|<img |href="javascript:/);
  assert.match(malicious, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(malicious, /href="https:\/\/example\.com\/"/);
  assert.match(malicious, /\[clicca\]\(javascript:alert\(1\)\)/);
  const shortDescription = "Nasce **EMME LABEL**, il nuovo progetto *indipendente* di Emme Studio.";
  const excerptHtml = renderToStaticMarkup(React.createElement(NewsInlineMarkdown, {source:shortDescription}));
  assert.match(excerptHtml, /Nasce <strong>EMME LABEL<\/strong>/);
  assert.match(excerptHtml, /<em>indipendente<\/em>/);
  assert.doesNotMatch(excerptHtml, /\*\*EMME LABEL\*\*/);
  assert.equal(plainNewsText(shortDescription), "Nasce EMME LABEL, il nuovo progetto indipendente di Emme Studio.");
  assert.match(renderToStaticMarkup(React.createElement(NewsInlineMarkdown, {
    source:"<img src=x onerror=alert(1)> [clicca](javascript:alert(1))"
  })), /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.equal(plainNewsText("Visita [Emme Label](https://emmestudioproduction.it/label.html)"), "Visita Emme Label");
  console.log("PASS news Markdown: headings, strong, emphasis, links, Unicode, lists, escapes, plain text, safe HTML.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
