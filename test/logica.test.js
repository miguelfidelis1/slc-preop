// Testes das regras (sem navegador): node --test test/logica.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const L = require("../src/slc-preop.js");

const HOJE = new Date(2026, 9, 13); // 13/10/2026
const diasAtras = (n) => L.dataBR(new Date(2026, 9, 13 - n));
const classe = (entrega, impressao) => L.classificarPedido({ entrega, impressao }, HOJE, 7);

test("regra de impressão (igual à v1)", () => {
  assert.equal(classe("14/10/2026", "Não foi impresso"), "NAO_IMPRESSO");
  assert.equal(classe("14/10/2026", "NAO IMPRESSO"), "NAO_IMPRESSO");
  assert.equal(classe("Pedido pendente", "Não foi impresso"), "PENDENTE");
  assert.equal(classe("Pedido pendente", diasAtras(30)), "PENDENTE");
  assert.equal(classe("14/10/2026", diasAtras(0)), "IMPRESSO");
  assert.equal(classe("14/10/2026", diasAtras(6)), "IMPRESSO");
  assert.equal(classe("14/10/2026", diasAtras(7)), "REIMPRIMIR");
  assert.equal(classe("14/10/2026", diasAtras(40)), "REIMPRIMIR");
  assert.equal(classe("14/10/2026", ""), "DATA_INVALIDA");
  assert.equal(classe("14/10/2026", "31/02/2026"), "DATA_INVALIDA");
});

test("datas em formatos diferentes", () => {
  assert.equal(L.diasDesde("06/10/2026 14:32", HOJE), 7);
  assert.equal(L.diasDesde("06/10/26", HOJE), 7);
  assert.equal(L.diasDesde("2026-10-06", HOJE), 7);
  assert.equal(L.diasDesde("ontem", HOJE), null);
});

test("identifica caminhão e leva usando as opções da tela", () => {
  const nums = ["299", "100", "150", "15", "1", "R", "H", "3001"];
  const levas = ["A", "H", "B", "C", "KA", "KB", "NC", "Z"];
  assert.deepEqual(L.identificar("299A", nums, levas), { num: "299", leva: "A", nome: "299A" });
  assert.deepEqual(L.identificar("150KA", nums, levas), { num: "150", leva: "KA", nome: "150KA" });
  assert.deepEqual(L.identificar("RH", nums, levas), { num: "R", leva: "H", nome: "RH" });
  assert.deepEqual(L.identificar("299 a", nums, levas), { num: "299", leva: "A", nome: "299A" });
  // Caminhão que não está nos filtros: cai na regra número+letras.
  assert.deepEqual(L.identificar("777B"), { num: "777", leva: "B", nome: "777B" });
  assert.deepEqual(L.identificar("299"), { num: "299", leva: "", nome: "299" });
});

const grupo = (nome) => {
  const c = L.identificar(nome);
  return { nome, ...c, prioridade: L.prioridade(c), fora: L.foraDaFila(c) };
};
const ordem = (nomes) => L.ordenarGrupos(nomes.map(grupo)).map((g) => g.nome);

test("ordem de prioridade: 299A, 299H, demais 299, 100H–124H, depois A, B, C", () => {
  const v1 = [
    "299A", "299H", "299B", "299C", "100H", "101H", "124H",
    "RA", "RH", "HA", "150KA", "154KA", "1A", "2A", "60A", "200A", "200H", "201A", "210H", "300A", "310H",
    "RB", "HB", "150KB", "1B", "60B", "100B", "180NC", "184NC",
    "RC", "DC", "200C", "KC", "100C",
  ];
  const embaralhado = [...v1].reverse();
  assert.deepEqual(ordem(embaralhado), v1);
});

test("caminhões novos entram no fim do grupo da leva", () => {
  assert.deepEqual(ordem(["400C", "401B", "402A", "RC", "1B", "300A", "RA", "299A"]), [
    "299A", "RA", "300A", "402A", "1B", "401B", "RC", "400C",
  ]);
  assert.equal(grupo("402A").prioridade.grupo, "A");
  assert.equal(grupo("401B").prioridade.grupo, "B");
  assert.equal(grupo("ZZ9").prioridade.grupo, "OUTROS");
});

test("3000+ fica fora da fila e vai para o fim", () => {
  assert.equal(grupo("3000Z").fora, true);
  assert.equal(grupo("3001A").fora, true);
  assert.equal(grupo("2999A").fora, false);
  assert.deepEqual(ordem(["3001A", "RC", "299A"]), ["299A", "RC", "3001A"]);
});

test("situação do caminhão", () => {
  const r = (...classes) => L.resumir(classes.map((c) => ({ classe: c }))).situacao;
  assert.equal(r("IMPRESSO", "IMPRESSO"), "IMPRESSO");
  assert.equal(r("NAO_IMPRESSO", "NAO_IMPRESSO"), "NAO_IMPRESSO");
  assert.equal(r("NAO_IMPRESSO", "IMPRESSO"), "PARCIAL");
  assert.equal(r("REIMPRIMIR", "IMPRESSO"), "REIMPRIMIR");
  assert.equal(r("PENDENTE", "IMPRESSO"), "IMPRESSO");
  assert.equal(r("PENDENTE"), "SO_PENDENTES");
  assert.equal(r("DATA_INVALIDA"), "VERIFICAR");
  const x = L.resumir([{ classe: "NAO_IMPRESSO" }, { classe: "REIMPRIMIR" }, { classe: "PENDENTE" }]);
  assert.equal(x.aImprimir, 2);
  assert.equal(x.total, 3);
});

test("colunas pelo cabeçalho, em qualquer ordem", () => {
  assert.deepEqual(L.detectarColunas(["", "Pedido", "Data Impressão", "Caminhão", "Data Entrega", "Rota", "Volumes"]), {
    caminhao: 3, rota: 5, pedido: 1, entrega: 4, impressao: 2, fonte: "cabecalho",
  });
  const padrao = L.detectarColunas([]);
  assert.equal(padrao.fonte, "padrao");
  assert.deepEqual([padrao.caminhao, padrao.rota, padrao.pedido, padrao.entrega, padrao.impressao], [1, 2, 3, 4, 5]);
});

test("TSV no formato da Impressos V2", () => {
  const t = L.tsv([{ caminhao: "299A", rota: "R1", pedido: "123\t4", entrega: "14/10/2026", impressao: "13/10/2026", extra: "x" }]);
  assert.equal(t, "299A\tR1\t123 4\t14/10/2026\t13/10/2026");
});

test("CSV escapa aspas e usa ponto e vírgula", () => {
  assert.equal(L.csv([["a", 'b"c'], [1, null]]), '"a";"b""c"\r\n"1";""');
});

const LEVAS_FILTRO = ["A", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "B", "H", "HA", "J", "K", "KA", "KB", "L", "M", "N", "NC", "O", "P", "Q", "S", "T", "U", "V", "W", "X", "Y", "Z"];

test("só busca as levas da faixa do caminhão (sem 1AA, 2AH…)", () => {
  assert.deepEqual(L.levasPara("1", LEVAS_FILTRO), { levas: ["A", "B"], porFaixa: true });
  assert.deepEqual(L.levasPara("52", LEVAS_FILTRO).levas, ["A", "B"]);
  assert.deepEqual(L.levasPara("101", LEVAS_FILTRO).levas, ["HA"]);
  assert.deepEqual(L.levasPara("152", LEVAS_FILTRO).levas, ["KA", "KB"]);
  assert.deepEqual(L.levasPara("184", LEVAS_FILTRO).levas, ["NC"]);
  assert.deepEqual(L.levasPara("205", LEVAS_FILTRO).levas, ["A", "H"]);
  assert.deepEqual(L.levasPara("301", LEVAS_FILTRO).levas, ["A", "H"]);
  const l299 = L.levasPara("299", LEVAS_FILTRO).levas;
  assert.equal(l299.length, 28); // 19 letras que existem no filtro + AA–AI
  assert.ok(["A", "B", "H", "J", "Z", "AA", "AI"].every((x) => l299.includes(x)));
  assert.ok(!["HA", "KA", "KB", "NC"].some((x) => l299.includes(x)));
  // Sem faixa: busca todas, e avisa.
  assert.deepEqual(L.levasPara("R", LEVAS_FILTRO), { levas: LEVAS_FILTRO, porFaixa: false });
  assert.equal(L.levasPara("450", LEVAS_FILTRO).porFaixa, false);
  // Leva que não existe no filtro é ignorada.
  assert.deepEqual(L.levasPara("1", ["A"]).levas, ["A"]);
});

test("nomes de hoje (100HA, 299AA, 152KB) entram na prioridade certa", () => {
  assert.deepEqual(ordem(["5B", "152KB", "302H", "205A", "299AA", "299J", "299H", "101HA", "1A", "299B", "150KA", "299A", "299AB", "299Z"]), [
    "299A", "299H", "299B", "299J", "299Z", "299AA", "299AB", "101HA", "150KA", "1A", "205A", "302H", "152KB", "5B",
  ]);
  assert.equal(grupo("101HA").prioridade.grupo, "MAX");
  assert.equal(grupo("299AA").prioridade.grupo, "MAX");
});
