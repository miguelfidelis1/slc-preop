// Teste ponta a ponta no simulador (test/simulador/kdabra-falso.html) com Chromium.
//   npm run test:e2e
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const RAIZ = path.join(__dirname, "..");
const SIMULADOR = "file://" + path.join(__dirname, "simulador", "kdabra-falso.html");
const codigo = (arquivo) => fs.readFileSync(path.join(RAIZ, "src", arquivo), "utf8");
// Tempos curtos só para o teste andar rápido.
const RAPIDO = { tempos: { aposSelecionar: 30, estabilizar: 50, intervalo: 60, semResposta: 1500, aposFinalizar: 100 } };

let browser;
before(async () => {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
after(async () => browser && browser.close());

async function abrir(params = "", arquivo = "mercearia.js") {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on("dialog", (d) => d.accept());
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.goto(SIMULADOR + "?atraso=150&poucos=1&" + params);
  await page.evaluate((cfg) => (window.SLC_PREOP_CONFIG = cfg), RAPIDO);
  // Igual ao favorito: fetch(...).then(t => Function(t)())
  await page.evaluate((t) => Function(t)(), codigo(arquivo));
  page.erros = erros;
  return page;
}

async function acao(page, nome) {
  await page.locator(`#slc-preop-v2 [data-acao="${nome}"]`).click();
  await page.waitForFunction(() => !window.__SLC_PREOP__.estado.rodando, null, { timeout: 120000 });
}

const grupos = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...window.__SLC_PREOP__.estado.grupos.values()].map((g) => [
        g.nome,
        { situacao: g.resumo.situacao, aImprimir: g.resumo.aImprimir, fora: g.fora, erro: g.erro, sel: g.selecionado, naoConf: g.naoConfirmados.length, sim: g.simulados },
      ])
    )
  );

const ESPERADO_MERCEARIA = {
  "299A": { situacao: "PARCIAL", aImprimir: 3, fora: false },
  "299H": { situacao: "IMPRESSO", aImprimir: 0, fora: false },
  "101H": { situacao: "PARCIAL", aImprimir: 2, fora: false },
  "5A": { situacao: "IMPRESSO", aImprimir: 0, fora: false },
  "5B": { situacao: "NAO_IMPRESSO", aImprimir: 1, fora: false },
  RC: { situacao: "REIMPRIMIR", aImprimir: 1, fora: false },
  "400A": { situacao: "NAO_IMPRESSO", aImprimir: 2, fora: false },
  "402C": { situacao: "PARCIAL", aImprimir: 1, fora: false },
  "150KA": { situacao: "SO_PENDENTES", aImprimir: 0, fora: false },
  "3001Z": { situacao: "NAO_IMPRESSO", aImprimir: 2, fora: true },
  "210H": { situacao: "NAO_IMPRESSO", aImprimir: 1, fora: false },
};

function conferirMapa(g) {
  assert.deepEqual(Object.keys(g).sort(), Object.keys(ESPERADO_MERCEARIA).sort());
  for (const [nome, e] of Object.entries(ESPERADO_MERCEARIA)) {
    assert.equal(g[nome].situacao, e.situacao, nome);
    assert.equal(g[nome].aImprimir, e.aImprimir, nome);
    assert.equal(g[nome].fora, e.fora, nome);
    assert.equal(g[nome].sel, e.aImprimir > 0 && !e.fora, nome + " selecionado");
  }
}

test("mapeia todos os caminhões, simula e imprime na ordem de prioridade", async () => {
  const page = await abrir();
  await acao(page, "mapear");
  assert.equal(await page.evaluate(() => window.__SLC_PREOP__.estado.estrategia), "porCaminhao");
  conferirMapa(await grupos(page));

  // Simulação: marca e confere, mas não imprime nada.
  await page.locator('#slc-preop-v2 [data-campo="simulacao"]').check();
  await acao(page, "imprimir");
  assert.deepEqual(await page.evaluate(() => window.__impressoes), []);
  const g1 = await grupos(page);
  assert.equal(g1["299A"].sim, 3);
  assert.equal(g1["3001Z"].sim, 0);
  assert.equal(g1["RC"].sim, 1);
  assert.equal(await page.evaluate(() => document.querySelectorAll("#table_body input:checked").length), 0);

  // Impressão de verdade.
  await page.locator('#slc-preop-v2 [data-campo="simulacao"]').uncheck();
  await acao(page, "imprimir");
  const impressos = await page.evaluate(() => window.__impressoes.map((x) => x.split(":")[0]));
  assert.deepEqual(impressos, ["299A", "299A", "299A", "101H", "101H", "210H", "400A", "400A", "5B", "RC", "402C"]);

  const reg = await page.evaluate(() => window.__SLC_PREOP__.estado.registros);
  assert.equal(reg.length, 11);
  assert.equal(new Set(reg.map((r) => r.pedido)).size, 11, "sem pedido repetido");
  const hoje = await page.evaluate(() => new Date().toLocaleDateString("pt-BR"));
  assert.ok(reg.every((r) => r.impressao === hoje));
  assert.equal(reg.filter((r) => r.reimpressao).length, 2);

  const g2 = await grupos(page);
  for (const [nome, g] of Object.entries(g2)) {
    assert.equal(g.erro, null, nome);
    assert.equal(g.naoConf, 0, nome);
    if (!g.fora && g.situacao !== "SO_PENDENTES") assert.equal(g.situacao, "IMPRESSO", nome);
  }
  assert.equal(g2["3001Z"].aImprimir, 2, "fora da fila não é impresso");
  assert.ok(Object.values(g2).every((g) => g.sim === 0), "marcas da simulação somem na impressão real");

  // Registros ficam guardados para "Copiar para Impressos V2" mesmo após recarregar.
  const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem("slcPreop.v2.ultimaExecucao")).registros.length);
  assert.equal(salvo, 11);
  if (process.env.SCREENSHOT) await page.screenshot({ path: path.join(RAIZ, "docs", "img", "painel.png") });
  assert.deepEqual(page.erros, []);
  await page.close();
});

test("sem Leva = Todos e com colunas em outra ordem", async () => {
  const page = await abrir("levaTodos=0&colunas=novas");
  await acao(page, "mapear");
  assert.equal(await page.evaluate(() => window.__SLC_PREOP__.estado.estrategia), "porCombinacao");
  conferirMapa(await grupos(page));
  await acao(page, "imprimir");
  assert.equal((await page.evaluate(() => window.__impressoes)).length, 11);
  assert.deepEqual(page.erros, []);
  await page.close();
});

test("não imprime quando a tabela não atualiza (tabela presa)", async () => {
  const page = await abrir();
  await acao(page, "mapear");
  await page.evaluate(() => (window.__congelar = "210"));
  await acao(page, "imprimir");
  const g = await grupos(page);
  assert.match(g["210H"].erro, /não atualizou/);
  const impressos = await page.evaluate(() => window.__impressoes.map((x) => x.split(":")[0]));
  assert.ok(!impressos.includes("210H"));
  assert.equal(impressos.length, 10);
  assert.equal(new Set(await page.evaluate(() => window.__impressoes)).size, 10, "nada impresso duas vezes");
  await page.close();
});

test("favorito Fresh abre no modo Fresh e não duplica o painel", async () => {
  const page = await abrir("", "fresh.js");
  await acao(page, "mapear");
  assert.equal(await page.evaluate(() => document.querySelector(".itens_type_btn.active").dataset.modo), "fresh");
  assert.deepEqual(Object.keys(await grupos(page)).sort(), ["299A", "401B", "60B", "7A"]);
  await page.evaluate((t) => Function(t)(), codigo("fresh.js"));
  assert.equal(await page.evaluate(() => document.querySelectorAll("#slc-preop-v2").length), 1);
  await page.close();
});
