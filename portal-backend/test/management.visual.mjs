import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
export async function verifyVisual({
  root,
  scratch,
  svc,
  projectId,
  artistId,
}) {
  const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  const playwright = runtime
    ? await import(pathToFileURL(join(runtime, "playwright/index.js")).href)
    : await import("playwright");
  const { chromium } = playwright.default ?? playwright;
  const source = `import React from 'react'; import {createRoot} from 'react-dom/client'; import Artists from '${root}/app/artisti/artists.tsx'; import Projects from '${root}/app/progetti/projects.tsx'; import Finance from '${root}/app/guadagni/finance.tsx'; import Production from '${root}/app/produzione/production.tsx'; import Costs from '${root}/app/costi/costs.tsx'; import Work from '${root}/app/lavoro/work.tsx'; import Navigation from '${root}/app/navigation.tsx'; const path=location.pathname;const titles=path==='/lavoro'?['Il lavoro al posto giusto.','Ogni giorno.']:path==='/produzione'?['Dalla prima idea.','Alla consegna finale.']:path==='/costi'?['Costi chiari.','Decisioni più consapevoli.']:path==='/artisti'?['Ogni artista.','Un percorso da costruire.']:path==='/guadagni'?['Il valore del lavoro.','Ogni cifra sotto controllo.']:['Una visione.','Un progetto concreto.'];createRoot(document.getElementById('app')).render(<><header className="brand"><img src="/logo-white.png" alt="Emme Studio" width="150" height="75"/><Navigation/></header><main className={path==='/produzione'||path==='/costi'?'shell dashboard':'shell'}><span className="eyebrow">EMME STUDIO · PORTALE</span><h1>{titles[0]}<br/><em>{titles[1]}</em></h1>{path==='/lavoro'?<Work/>:path==='/produzione'?<Production/>:path==='/costi'?<Costs/>:path==='/artisti'?<Artists/>:path==='/guadagni'?<Finance/>:<Projects/>}</main></>);`;
  await writeFile(join(scratch, "ui.tsx"), source);
  await build({
    entryPoints: [join(scratch, "ui.tsx")],
    outfile: join(scratch, "ui.js"),
    bundle: true,
    platform: "browser",
    jsx: "automatic",
    nodePaths: [join(root, "node_modules"), ...(runtime ? [runtime] : [])],
    tsconfig: join(root, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "next-harness",
        setup(b) {
          b.onResolve({ filter: /^next\/link$/ }, () => ({
            path: "link",
            namespace: "harness",
          }));
          b.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "navigation",
            namespace: "harness",
          }));
          b.onLoad({ filter: /.*/, namespace: "harness" }, (a) => ({
            contents:
              a.path === "link"
                ? `import React from 'react';export default function Link(props){return React.createElement('a',props,props.children);}`
                : "export const usePathname=()=>location.pathname;",
            loader: "js",
            resolveDir: root,
          }));
        },
      },
    ],
  });
  globalThis.emmeTestSession = {
    workspaceOwnerId: "owner",
    role: "admin",
    user: { email: "owner@example.test", name: "Studio Owner" },
  };
  const server = createServer(async (req, res) => {
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      const url = new URL(req.url, origin);
      if (url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/calendar/events" && req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              events: [],
              checkedAt: new Date().toISOString(),
              canEdit: true,
            }),
          );
          return;
        }
        if (url.pathname === "/api/workspace") {
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              canManageAccess: globalThis.emmeTestSession?.role === "admin",
            }),
          );
          return;
        }
        const api =
          url.pathname === "/api/operations"
            ? svc.operationsApi
            : url.pathname === "/api/backups"
              ? svc.backupApi
              : url.pathname === "/api/team"
                ? svc.teamApi
                : url.pathname === "/api/workflow"
                  ? svc.workflowApi
                  : url.pathname === "/api/tasks"
                    ? svc.tasksApi
                    : url.pathname === "/api/production"
                      ? svc.productionApi
                      : url.pathname === "/api/costs"
                        ? svc.costApi
                        : url.pathname === "/api/export"
                          ? svc.exportApi
                          : url.pathname === "/api/artists"
                            ? svc.artistApi
                            : url.pathname === "/api/projects"
                              ? svc.projectApi
                              : url.pathname === "/api/finance"
                                ? svc.financeApi
                                : null;
        if (!api) {
          res.writeHead(404).end();
          return;
        }
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const request = new Request(url, {
          method: req.method,
          headers: req.headers,
          body: req.method === "GET" ? undefined : Buffer.concat(chunks),
        });
        const response = await api[req.method](request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(await response.text());
        return;
      }
      if (url.pathname === "/ui.js") {
        res.setHeader("Content-Type", "text/javascript");
        res.end(await readFile(join(scratch, "ui.js")));
        return;
      }
      if (url.pathname === "/style.css") {
        res.setHeader("Content-Type", "text/css");
        res.end(await readFile(join(root, "app/globals.css")));
        return;
      }
      if (url.pathname === "/logo-white.png") {
        res.setHeader("Content-Type", "image/png");
        res.end(await readFile(join(root, "public/logo-white.png")));
        return;
      }
      if (url.pathname.startsWith("/preventivi/")) {
        const { createRequire } = await import("node:module");
        const require = createRequire(import.meta.url);
        const { renderToStaticMarkup } = require("react-dom/server");
        const markup = renderToStaticMarkup(
          await svc.quotePage({
            params: Promise.resolve({ id: url.pathname.split("/")[2] }),
          }),
        );
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><header class="brand"><img src="/logo-white.png" alt="Emme Studio" width="150" height="75"></header>' +
            markup +
            "</body></html>",
        );
        return;
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="app"></div><script src="/ui.js"></script></body></html>',
      );
    } catch (e) {
      res.writeHead(500).end(String(e.message));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  process.env.BETTER_AUTH_URL = base;
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    ...(process.env.VISUAL_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.VISUAL_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const shots = join(root, "../docs/portal-management-preview");
  await mkdir(shots, { recursive: true });
  try {
    await page.goto(base + "/artisti?artist=" + artistId);
    await page
      .getByRole("heading", { name: "Artista di prova", exact: true })
      .waitFor();
    await page.screenshot({
      path: join(shots, "artisti-desktop.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Modifica profilo", exact: true })
      .click();
    await page
      .getByLabel("Referente della direzione artistica")
      .fill("Team produzione");
    await page
      .getByRole("button", { name: "Salva artista", exact: true })
      .click();
    await page.getByText("Team produzione", { exact: false }).waitFor();
    await page.goto(base + "/progetti");
    await page
      .getByRole("button", { name: "+ Nuovo progetto", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "+ Nuovo progetto", exact: true })
      .click();
    await page.getByLabel("Titolo progetto").fill("Progetto creato dal modulo");
    await page.getByLabel("Artista registrato").selectOption("new");
    await page
      .getByLabel("Nome artista", { exact: true })
      .fill("Nuovo artista dal modulo");
    await page.getByLabel("Importo totale (€)").fill("1200,50");
    await page.getByLabel("Stato preventivo").selectOption("Confermato");
    await page
      .getByRole("button", { name: "Salva progetto", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Progetto creato dal modulo", exact: true })
      .waitFor();
    assert.equal(
      (await svc.listArtists("owner")).some(
        (a) => a.name === "Nuovo artista dal modulo",
      ),
      true,
    );
    await page.screenshot({
      path: join(shots, "progetti-desktop.png"),
      fullPage: true,
    });
    await page.goto(base + "/guadagni?project=" + projectId);
    await page
      .getByRole("heading", { name: "Singolo di prova", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "+ Incasso", exact: true }).click();
    await page.getByLabel("Importo (€)", { exact: true }).fill("100,00");
    await page.getByLabel("Ricevuto il").fill("2026-01-02");
    await page
      .getByRole("button", { name: "Conferma registrazione", exact: true })
      .click();
    await page.locator("dialog").waitFor({ state: "hidden" });
    assert.equal(
      (await svc.listLedger("owner")).payments
        .filter((p) => !p.voidReason)
        .reduce((s, p) => s + p.amount, 0),
      50000,
    );
    await page.screenshot({
      path: join(shots, "guadagni-desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      "artisti?artist=" + artistId,
      "progetti",
      "guadagni?project=" + projectId,
    ]) {
      await page.goto(base + "/" + route);
      await page
        .getByRole("heading", {
          name: route.startsWith("artisti")
            ? "Artista di prova"
            : route.startsWith("progetti")
              ? "Progetto creato dal modulo"
              : "Singolo di prova",
          exact: true,
        })
        .waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "horizontal overflow " + route,
      );
      await page.screenshot({
        path: join(shots, route.split("?")[0] + "-mobile.png"),
        fullPage: true,
      });
    }
    assert.equal(
      await page
        .getByRole("button", { name: "+ Scadenza", exact: true })
        .isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "+ Incasso", exact: true }).click();
    await page.getByLabel("Importo (€)", { exact: true }).waitFor();
    assert.ok(
      await page.evaluate(
        () =>
          document.querySelector("dialog").getBoundingClientRect().right <=
          innerWidth,
      ),
    );
    await page.screenshot({
      path: join(shots, "incasso-mobile.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/produzione?project=" + projectId);
    await page
      .getByRole("heading", { name: "Brano completo", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "+ Brano", exact: true }).click();
    await page.getByLabel("Titolo", { exact: true }).fill("Brano dal modulo");
    await page
      .getByLabel("Referente / gruppo (testo)", { exact: true })
      .fill("Team studio");
    await page.getByLabel("BPM", { exact: true }).fill("120");
    await page
      .getByRole("button", { name: "Salva scheda", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Brano dal modulo", exact: true })
      .waitFor();
    await page.screenshot({
      path: join(shots, "produzione-desktop.png"),
      fullPage: true,
    });

    const songCard = page.locator("article.project-card").filter({
      has: page.getByRole("heading", { name: "Brano dal modulo", exact: true }),
    });
    await songCard.getByRole("button", { name: /Apri scheda brano/ }).click();
    const workspace = page.getByRole("dialog", { name: "Brano dal modulo" });
    await workspace.getByText("Identità e lavorazione").waitFor();
    assert.ok(await workspace.getByText("120", { exact: true }).count());
    await workspace.getByRole("button", { name: /^Sessioni/ }).click();
    await workspace.getByRole("button", { name: "+ Nuova sessione" }).click();
    await page.getByLabel("Titolo", { exact: true }).fill("Voci demo");
    await page
      .getByLabel("Fase di produzione")
      .selectOption("Registrazione voce");
    await page.getByLabel("Strumento / parte").fill("Voce");
    await page.getByLabel("Musicista / voce / referente").fill("Cantante");
    await page
      .getByRole("button", { name: "Salva scheda", exact: true })
      .click();
    await workspace.getByRole("heading", { name: "Voci demo" }).waitFor();
    await workspace
      .getByRole("button", { name: /^Materiali e versioni/ })
      .click();
    await workspace.getByRole("button", { name: "+ Nuovo materiale" }).click();
    await page.getByLabel("Titolo", { exact: true }).fill("Mix dimostrativo");
    await page
      .getByLabel("Tipo materiale (mix, master, sessione, artwork…)")
      .fill("Mix");
    await page.getByLabel("Versione (es. Mix v03)").fill("Mix v01");
    await page
      .getByLabel("Link file / cartella Drive")
      .fill("https://drive.google.com/file/example");
    await page
      .getByRole("button", { name: "Salva scheda", exact: true })
      .click();
    await workspace
      .getByRole("heading", { name: "Mix dimostrativo", exact: true })
      .waitFor();
    await workspace.getByRole("button", { name: /^Revisioni/ }).click();
    await workspace.getByRole("button", { name: "+ Nuova revisione" }).click();
    await page
      .getByLabel("Titolo", { exact: true })
      .fill("Revisione dimostrativa");
    await page.getByLabel("Versione oggetto della revisione").fill("Mix v01");
    await page
      .getByLabel("Feedback ricevuto e modifiche richieste")
      .fill("Ridurre il livello della voce");
    await page
      .locator("dialog.production-dialog")
      .getByRole("combobox", { name: /^Stato/ })
      .selectOption("Approvata");
    await page
      .getByLabel("Approvazione ricevuta da / tramite")
      .fill("Artista, via email");
    await page.getByLabel("Data approvazione").fill("2026-01-02");
    await page
      .getByRole("button", { name: "Salva scheda", exact: true })
      .click();
    await workspace
      .getByRole("heading", { name: "Revisione dimostrativa", exact: true })
      .waitFor();
    await workspace.screenshot({
      path: join(shots, "brano-workspace-desktop.png"),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await workspace.evaluate(
        (el) => el.getBoundingClientRect().right <= innerWidth + 2,
      ),
      "song workspace mobile overflow",
    );
    await workspace.screenshot({
      path: join(shots, "brano-workspace-mobile.png"),
    });
    await workspace
      .getByRole("button", { name: "Chiudi scheda brano" })
      .click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page
      .getByRole("group", { name: "Aree produzione" })
      .getByRole("button", { name: /^Registrazioni/ })
      .click();
    await page
      .getByRole("button", { name: "+ Registrazione autonoma" })
      .click();
    await page.getByLabel("Titolo", { exact: true }).fill("Mix autonomo");
    await page.getByLabel("Fase di produzione").selectOption("Mix");
    await page
      .getByRole("button", { name: "Salva scheda", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Mix autonomo", exact: true })
      .waitFor();
    assert.equal(
      (await svc.listProduction("owner")).find(
        (i) => i.title === "Mix autonomo",
      )?.trackId,
      null,
    );
    await page.getByRole("button", { name: /^Show live/ }).click();
    await page
      .getByRole("button", { name: "+ Show live", exact: true })
      .click();
    await page.getByLabel("Titolo", { exact: true }).fill("Show dimostrativo");
    await page.getByLabel("Luogo / venue").fill("Teatro");
    await page
      .getByLabel("LTC / MTC e sincronizzazioni")
      .fill("LTC verso regia luci");
    await page
      .getByLabel("Piano backup e verifica tecnica")
      .fill("PC master e copia di sicurezza");
    await page
      .getByRole("button", { name: "Salva scheda", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Show dimostrativo", exact: true })
      .waitFor();
    await page.screenshot({
      path: join(shots, "live-desktop.png"),
      fullPage: true,
    });
    await page.goto(base + "/costi?project=" + projectId);
    await page
      .getByRole("heading", { name: "Registrazioni esterne", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "+ Nuovo costo", exact: true })
      .click();
    await page
      .getByLabel("Descrizione", { exact: true })
      .fill("Musicista dimostrativo");
    await page.getByLabel("Importo (€)", { exact: true }).fill("150,00");
    await page
      .getByRole("button", { name: "Salva costo", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Musicista dimostrativo", exact: true })
      .waitFor();
    await page.screenshot({
      path: join(shots, "costi-desktop.png"),
      fullPage: true,
    });
    const detailed = (await svc.listProjects("owner")).find(
      (p) => p.title === "Progetto creato dal modulo",
    );
    await page.goto(base + "/progetti?project=" + detailed.id);
    await page.getByLabel("Titolo progetto").waitFor();
    await page.getByRole("button", { name: "+ Voce", exact: true }).click();
    await page
      .getByLabel("Descrizione", { exact: true })
      .fill("Produzione completa");
    await page
      .getByRole("button", { name: "Salva progetto", exact: true })
      .click();
    await page.locator("dialog").waitFor({ state: "hidden" });
    assert.equal(
      (await svc.listLedger("owner")).quotes.find(
        (q) => q.projectId === detailed.id,
      ).items.length,
      1,
    );
    await page.goto(base + "/preventivi/" + detailed.id);
    await page
      .getByRole("heading", { name: "Progetto creato dal modulo", exact: true })
      .waitFor();
    await page.screenshot({
      path: join(shots, "preventivo-desktop.png"),
      fullPage: true,
    });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: join(shots, "preventivo-demo.pdf"),
      format: "A4",
      margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" },
    });
    await page.emulateMedia({ media: "screen" });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of [
      "produzione?project=" + projectId,
      "costi?project=" + projectId,
    ]) {
      await page.goto(base + "/" + route);
      await page
        .getByRole("heading", {
          name: route.startsWith("produzione")
            ? "Brano dal modulo"
            : "Musicista dimostrativo",
          exact: true,
        })
        .waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "horizontal overflow " + route,
      );
      await page.screenshot({
        path: join(shots, route.split("?")[0] + "-mobile.png"),
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/lavoro?project=" + projectId + "&tab=Modelli");
    await page
      .getByRole("heading", {
        name: "Un punto di partenza per ogni progetto",
        exact: true,
      })
      .waitFor();
    await page
      .getByLabel("Responsabile iniziale")
      .selectOption("owner@example.test");
    await page.getByLabel("Stima ore del progetto").fill("10");
    await page
      .getByRole("button", { name: "Applica modello", exact: true })
      .click();
    await page
      .getByText("Modello applicato: Singolo", { exact: false })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Applica modello", exact: true })
        .isDisabled(),
      true,
    );
    await page
      .getByRole("button", { name: "Il mio lavoro", exact: true })
      .click();
    await page
      .getByRole("heading", {
        name: "Definire reference e arrangiamento",
        exact: true,
      })
      .waitFor();
    await page.screenshot({
      path: join(shots, "lavoro-desktop.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Ore lavorate", exact: true })
      .click();
    await page
      .getByRole("button", { name: "+ Registra ore", exact: true })
      .click();
    await page.getByLabel("Data lavoro").fill("2026-01-03");
    await page.getByLabel("Minuti lavorati").fill("120");
    await page.getByLabel("Lavoro svolto").fill("Sessione di mix del team");
    await page
      .locator("dialog")
      .getByRole("button", { name: "Salva", exact: true })
      .click();
    await page.locator("dialog").waitFor({ state: "hidden" });
    await page.getByText("Sessione di mix del team", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Consegne", exact: true }).click();
    await page.locator(".ledger-row input[type=checkbox]").first().check();
    await page
      .getByRole("heading", { name: /1 \/ 5 verifiche completate/ })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Urgenze", exact: true }).click();
    await page
      .getByRole("heading", { name: "Revisioni in attesa", exact: true })
      .waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: join(shots, "urgenze-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + "/progetti");
    const opsProject = (await svc.listProjects("owner")).find(
      (p) => p.title === "Progetto gestione e cestino",
    );
    const boardCard = page.locator("article.board-project").filter({
      has: page.getByRole("button", { name: opsProject.title, exact: true }),
    });
    await boardCard
      .getByRole("button", { name: "Apri progetto ↗", exact: true })
      .click();
    await page
      .getByLabel("Referente del progetto")
      .selectOption("owner@example.test");
    await page
      .getByLabel("Prossima azione")
      .fill("Confermare le sessioni con il team");
    await page
      .getByRole("button", { name: "Salva organizzazione", exact: true })
      .click();
    await page.locator("dialog").waitFor({ state: "hidden" });
    await page
      .getByText("Confermare le sessioni con il team", { exact: true })
      .waitFor();
    await page.screenshot({
      path: join(shots, "bacheca-progetti-desktop.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Settimana", exact: true }).click();
    await page
      .getByRole("heading", { name: "Carico del team", exact: true })
      .waitFor();
    await page.screenshot({
      path: join(shots, "settimana-desktop.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Bacheca", exact: true }).click();
    await boardCard
      .getByRole("button", { name: "Apri progetto ↗", exact: true })
      .click();
    await page.getByText("Panoramica dei brani", { exact: true }).waitFor();
    await page.screenshot({
      path: join(shots, "progetto-regia-desktop.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Elimina progetto", exact: true })
      .click();
    await page
      .getByLabel("Scrivi il titolo per confermare")
      .fill(opsProject.title);
    await page
      .getByRole("button", { name: "Conferma eliminazione", exact: true })
      .click();
    await page.locator("dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Cestino", exact: true }).click();
    const trashRow = page
      .locator(".ledger-row")
      .filter({ hasText: opsProject.title });
    await trashRow
      .getByRole("button", { name: "Ripristina", exact: true })
      .click();
    await trashRow.waitFor({ state: "hidden" });
    assert.ok(
      (await svc.listProjects("owner")).some((p) => p.id === opsProject.id),
    );
    assert.ok(
      (await svc.listLedger("owner")).quotes.some(
        (q) => q.projectId === opsProject.id,
      ),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Bacheca", exact: true }).click();
    await boardCard
      .getByRole("button", { name: "Apri progetto ↗", exact: true })
      .waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: join(shots, "bacheca-progetti-mobile.png"),
      fullPage: true,
    });
    await boardCard
      .getByRole("button", { name: "Apri progetto ↗", exact: true })
      .click();
    await page.getByLabel("Referente del progetto").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: join(shots, "progetto-regia-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Chiudi", exact: true }).click();
    globalThis.emmeTestSession = {
      workspaceOwnerId: "owner",
      role: "viewer",
      user: { email: "team@example.test", name: "Team" },
    };
    await page.goto(base + "/progetti?project=" + projectId);
    await page.getByLabel("Titolo progetto").waitFor();
    assert.equal(await page.getByLabel("Titolo progetto").isDisabled(), true);
    assert.equal(await page.getByLabel("Importo totale (€)").count(), 0);
    assert.equal(
      await page.getByRole("link", { name: "Guadagni", exact: true }).count(),
      0,
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS desktop/mobile components, artist edit, inline artist/project/quote creation, receipt registration via actual APIs; screenshots captured",
  );
}
