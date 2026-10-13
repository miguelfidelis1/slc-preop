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
const TEMPOS = { aposSelecionar: 30, estabilizar: 50, intervalo: 60, semResposta: 1500, aposFinalizar: 100 };

let browser;
before(async () => {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
after(async () => browser && browser.close());

// Abre o simulador e clica no "favorito" (mesma coisa que o bookmarklet faz).
async function abrir({ params = "", arquivo = "mercearia.js", config = {}, antes } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.alertas = [];
  page.on("dialog", (d) => {
    page.alertas.push(d.message());
    d.accept();
  });
  page.erros = [];
  page.on("pageerror", (e) => page.erros.push(e.message));
  await page.goto(SIMULADOR + "?atraso=150&poucos=1&" + params);
  await page.evaluate((cfg) => (window.SLC_PREOP_CONFIG = cfg), { tempos: TEMPOS, ...config });
  if (antes) await page.evaluate(antes);
  await favorito(page, arquivo);
  return page;
}

async function favorito(page, arquivo = "mercearia.js") {
  await page.evaluate((t) => Function(t)(), codigo(arquivo));
  await page.waitForFunction(() => window.__SLC_PREOP__ && !window.__SLC_PREOP__.estado.rodando, null, { timeout: 120000 });
}

const impressos = (page) => page.evaluate(() => window.__impressoes.map((x) => x.split(":")[0]));
const grupos = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...window.__SLC_PREOP__.estado.grupos.values()].map((g) => [
        g.nome,
        { situacao: g.resumo.situacao, aImprimir: g.resumo.aImprimir, fora: g.fora, erro: g.erro, naoConf: g.naoConfirmados.length, sim: g.simulados },
      ])
    )
  );

// Ordem esperada: 299A → 101H (100H–124H) → 210H (200A/H) → 400A (novo A) → 5B → RC (reimpressão 7d+) → 402C (novo C).
// 3001Z fica fora da fila; 299H e 5A já estão impressos; 150KA só tem pendente.
const ORDEM = ["299A", "299A", "299A", "101H", "101H", "210H", "400A", "400A", "5B", "RC", "402C"];

test("clicou no favorito: imprime tudo na ordem de prioridade e copia", async () => {
  const page = await abrir();
  assert.equal(await page.evaluate(() => window.__SLC_PREOP__.estado.estrategia), "porCaminhao");
  assert.deepEqual(await impressos(page), ORDEM);

  const reg = await page.evaluate(() => window.__SLC_PREOP__.estado.registros);
  assert.equal(reg.length, 11);
  assert.equal(new Set(reg.map((r) => r.pedido)).size, 11, "sem pedido repetido");
  const hoje = await page.evaluate(() => new Date().toLocaleDateString("pt-BR"));
  assert.ok(reg.every((r) => r.impressao === hoje));
  assert.equal(reg.filter((r) => r.reimpressao).length, 2);
  assert.match(page.alertas.at(-1), /Finalizado[\s\S]*Impressos V2: 11[\s\S]*Reimpressos 7\+d: 2/);

  const g = await grupos(page);
  for (const [nome, x] of Object.entries(g)) {
    assert.equal(x.erro, null, nome);
    assert.equal(x.naoConf, 0, nome);
    if (!x.fora && x.situacao !== "SO_PENDENTES") assert.equal(x.situacao, "IMPRESSO", nome);
  }
  assert.equal(g["3001Z"].aImprimir, 2, "fora da fila não é impresso");

  if (process.env.SCREENSHOT) await page.screenshot({ path: path.join(RAIZ, "docs", "img", "painel.png") });

  // Clicar no favorito de novo: roda de novo (como na v1), não imprime nada repetido
  // e o botão de copiar continua com a última impressão.
  await favorito(page);
  assert.equal((await impressos(page)).length, 11);
  assert.equal(await page.evaluate(() => document.querySelectorAll("#slc-preop-v2").length), 1);
  assert.match(page.alertas.at(-1), /Nenhum pedido imprimível/);
  const botao = await page.locator('#slc-preop-v2 [data-campo="copiarTxt"]').textContent();
  assert.match(botao, /Copiar última impressão \(\d\d:\d\d, 11\)/);

  assert.deepEqual(page.erros, []);
  await page.close();
});

test("sem Leva = Todos e com colunas em outra ordem", async () => {
  const page = await abrir({ params: "levaTodos=0&colunas=novas" });
  assert.equal(await page.evaluate(() => window.__SLC_PREOP__.estado.estrategia), "porCombinacao");
  assert.deepEqual(await impressos(page), ORDEM);
  assert.deepEqual(page.erros, []);
  await page.close();
});

test("tabela presa: pula o caminhão e não imprime nada errado", async () => {
  const page = await abrir({ antes: () => ((window.__congelar = "210"), (window.__congelarSoNaImpressao = true)) });
  const g = await grupos(page);
  assert.match(g["210H"].erro, /não atualizou/);
  const lista = await impressos(page);
  assert.deepEqual(lista, ORDEM.filter((x) => x !== "210H"));
  assert.equal(new Set(await page.evaluate(() => window.__impressoes)).size, 10, "nada impresso duas vezes");
  assert.match(page.alertas.at(-1), /Caminhões com erro \(não impressos\): 210H/);
  await page.close();
});

test("simulação (config) não imprime nada", async () => {
  const page = await abrir({ config: { simulacao: true } });
  assert.deepEqual(await impressos(page), []);
  const g = await grupos(page);
  assert.equal(g["299A"].sim, 3);
  assert.equal(g["RC"].sim, 1);
  assert.equal(g["3001Z"].sim, 0);
  assert.equal(await page.evaluate(() => document.querySelectorAll("#table_body input:checked").length), 0);
  await page.close();
});

test("favorito Fresh imprime no modo Fresh", async () => {
  const page = await abrir({ arquivo: "fresh.js" });
  assert.equal(await page.evaluate(() => document.querySelector(".itens_type_btn.active").dataset.modo), "fresh");
  assert.deepEqual(await impressos(page), ["299A", "7A", "7A"]);
  await page.close();
});
