/*
 * ARQUIVO GERADO — não edite. Edite src/slc-preop.js e rode `npm run build`.
 * SLC PreOp KDABRA — abre já no modo Fresh.
 */
{
const SLC_PREOP_MODO = "fresh";
/*
 * SLC PreOp KDABRA — v2
 *
 * Clicou no favorito, ele faz tudo sozinho (como a v1):
 *   1. lê TODOS os caminhões do filtro da tela (sem lista fixa);
 *   2. imprime, na ordem de prioridade, os pedidos não impressos ou impressos há 7+ dias;
 *   3. confere se o KDABRA registrou a impressão;
 *   4. copia os pedidos impressos em TSV para colar na planilha Impressos V2.
 *
 * Este é o arquivo-fonte único. src/mercearia.js e src/fresh.js são gerados
 * a partir dele com `npm run build` (só muda o modo inicial).
 *
 * Não coloque API key, token, senha ou dado real de pedido neste arquivo.
 */
(function () {
  "use strict";

  const VERSAO = "2.0.0";
  // Definido no topo de src/mercearia.js / src/fresh.js (gerados pelo build).
  const MODO_INICIAL = typeof SLC_PREOP_MODO !== "undefined" ? SLC_PREOP_MODO : null;

  // ============================================================
  // CONFIGURAÇÃO — ajuste aqui quando o KDABRA mudar
  // ============================================================
  const CONFIG = {
    // Pedido impresso há esta quantidade de dias (ou mais) volta a ser impresso.
    reprintDias: 7,
    // Depois de imprimir, busca o caminhão de novo para conferir se o KDABRA
    // registrou a impressão. Pedidos não confirmados ficam em vermelho no painel.
    conferirAposImprimir: true,
    // A tabela do KDABRA é paginada no servidor (só a página atual fica na tela).
    // Depois de cada busca o script pede páginas deste tamanho, para ver todos os pedidos.
    linhasPorPagina: 1000,
    // Capa "CHECK CAMINHÃO" (mesma da planilha CHECK CAMINHAO FRESH NOVO): uma folha por
    // caminhão impresso na execução, com os pedidos que acabaram de ser impressos.
    capa: {
      modos: ["fresh"], // só no Fresh
      automatica: true, // abre a impressão das capas sozinha no fim da execução
      linhasMinimas: 27, // a tabela da planilha tem 27 linhas (13 a 39)
      escala: 1, // ajuste fino do tamanho impresso (ex.: 1.02 = 2% maior), se precisar igualar ao papel
    },
    // true = marca e confere os pedidos, mas NÃO clica em Finalizar (para testar).
    simulacao: false,
    // Como descobrir os caminhões:
    //   "auto"          → usa Leva = Todos se existir (1 busca por caminhão),
    //                     senão busca cada combinação caminhão × leva.
    //   "porCaminhao"   → 1 busca por caminhão com Leva = Todos.
    //   "porCombinacao" → 1 busca por combinação caminhão × leva, usando só as
    //                     levas de `levasPorCaminhao` (é o caso do KDABRA hoje).
    //   "tudo"          → 1 busca só, com Caminhão = Todos e Leva = Todos.
    varredura: "auto",
    // Levas que cada faixa de caminhão usa (tirado da planilha Impressos V2).
    // O script só busca essas combinações, sem testar as 32 levas em todo caminhão.
    // Caminhão fora de todas as faixas: busca todas as levas (mais lento) e avisa no Log.
    levasPorCaminhao: [
      { de: 1, ate: 99, levas: ["A", "B"] },
      { de: 100, ate: 149, levas: ["HA"] },
      { de: 150, ate: 179, levas: ["KA", "KB"] },
      { de: 180, ate: 199, levas: ["NC"] },
      { de: 200, ate: 298, levas: ["A", "H"] },
      // 299: todas as letras de A a Z (as que existirem no filtro) e depois AA–AI.
      { de: 299, ate: 299, levas: [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI"] },
      { de: 300, ate: 399, levas: ["H", "A"] },
    ],
    modos: {
      mercearia: { nome: "Mercearia", botao: "mercearia" },
      fresh: { nome: "Fresh", botao: "fresh" },
    },
    seletores: {
      caminhao: "#truckInput",
      leva: "#waveInput",
      impresso: "#printedInput",
      buscar: "#filtrar_busca",
      tabela: "#toPrint_list",
      linhas: "#table_body tr, #toPrint_list tbody tr",
      finalizar: "#finalizar_button",
      itensToggle: "#printOrdersToogle",
      carregando: ".loadBlocker",
      botoesModo: ".itens_type_btn",
      checkAllId: "check_all",
      // Botões de confirmação que aparecem depois de Finalizar (clicados em qualquer ordem).
      confirmacoes: ["#acaoBotaoFinalizar_sim", "#boxes_barcodes_yes", "#alert_action"],
    },
    // Colunas da tabela: procuradas pelo texto do cabeçalho (sem acento).
    // Se o cabeçalho não for encontrado, usa a posição padrão (0 = checkbox).
    colunas: {
      caminhao: { cabecalho: ["caminhao"], padrao: 1 },
      rota: { cabecalho: ["rota"], padrao: 2 },
      pedido: { cabecalho: ["pedido"], padrao: 3 },
      entrega: { cabecalho: ["data entrega", "entrega"], padrao: 4 },
      impressao: { cabecalho: ["data impressao", "impressao"], padrao: 5 },
    },
    tempos: {
      aposSelecionar: 150, // depois de trocar um filtro
      estabilizar: 300, // depois que a tabela parou de mudar
      semResposta: 3000, // sem loader e sem mudança nesse tempo = resultado igual ao anterior
      limiteBusca: 45000, // tempo máximo esperando uma busca
      aposFinalizar: 1000,
      intervalo: 250, // de quanto em quanto tempo confere a tabela
    },
  };

  // Ajustes sem editar o arquivo: defina window.SLC_PREOP_CONFIG antes de abrir.
  // Ex.: window.SLC_PREOP_CONFIG = { reprintDias: 5, tempos: { limiteBusca: 60000 } }
  const ajustes = typeof window !== "undefined" && window.SLC_PREOP_CONFIG;
  if (ajustes) {
    Object.assign(CONFIG.tempos, ajustes.tempos || {});
    ["reprintDias", "conferirAposImprimir", "varredura", "simulacao", "levasPorCaminhao", "linhasPorPagina"].forEach((k) => {
      if (k in ajustes) CONFIG[k] = ajustes[k];
    });
  }

  // Ordem de prioridade. A primeira regra que casar define a posição do caminhão.
  // `nomes` casa pelo nome exato e mantém a ordem da lista; `se` é uma condição livre.
  // Caminhões novos (que não estavam na lista da v1) entram no fim do grupo da leva deles.
  const entre = (num, a, b) => /^\d+$/.test(num) && +num >= a && +num <= b;
  const PRIORIDADES = [
    { grupo: "MAX", tipo: "299A", nomes: ["299A"] },
    { grupo: "MAX", tipo: "299H", nomes: ["299H"] },
    { grupo: "MAX", tipo: "299 demais (B…Z, depois AA…AI)", se: (c) => c.num === "299" },
    { grupo: "MAX", tipo: "100HA–124HA", se: (c) => ["H", "HA"].includes(c.leva) && entre(c.num, 100, 124) },
    { grupo: "A", tipo: "RA / RH / HA", nomes: ["RA", "RH", "HA"] },
    { grupo: "A", tipo: "150–179 KA", se: (c) => c.leva === "KA" && entre(c.num, 150, 179) },
    { grupo: "A", tipo: "Original A (1–99)", se: (c) => c.leva === "A" && entre(c.num, 1, 99) },
    { grupo: "A", tipo: "200A / 200H", se: (c) => ["A", "H"].includes(c.leva) && entre(c.num, 200, 298) },
    { grupo: "A", tipo: "300A / 300H", se: (c) => ["A", "H"].includes(c.leva) && entre(c.num, 300, 399) },
    { grupo: "A", tipo: "Novo · leva A/H/HA/KA", se: (c) => ["A", "H", "HA", "KA"].includes(c.leva) },
    { grupo: "B", tipo: "RB / HB / 150KB", nomes: ["RB", "HB", "150KB"] },
    { grupo: "B", tipo: "150–179 KB", se: (c) => c.leva === "KB" && entre(c.num, 150, 179) },
    { grupo: "B", tipo: "Original B (1–99)", se: (c) => c.leva === "B" && entre(c.num, 1, 99) },
    { grupo: "B", tipo: "100B", nomes: ["100B"] },
    { grupo: "B", tipo: "Leva noturna NC", se: (c) => c.leva === "NC" && entre(c.num, 180, 199) },
    { grupo: "B", tipo: "Novo · leva B/KB/NC", se: (c) => ["B", "KB", "NC"].includes(c.leva) },
    { grupo: "C", tipo: "RC / DC / 200C / KC / 100C", nomes: ["RC", "DC", "200C", "KC", "100C"] },
    { grupo: "C", tipo: "Novo · leva C", se: (c) => c.leva === "C" },
    { grupo: "OUTROS", tipo: "Outros", se: () => true },
  ];

  // Caminhões fora da fila: aparecem no painel, mas não são selecionados para impressão.
  const foraDaFila = (c) => /^\d+$/.test(c.num) && +c.num >= 3000;

  // ============================================================
  // LÓGICA PURA (sem DOM) — coberta por test/logica.test.js
  // ============================================================
  const norm = (x) =>
    String(x == null ? "" : x)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const chave = (x) => norm(x).toUpperCase().replace(/\s+/g, "");
  const limpar = (x) => String(x == null ? "" : x).replace(/[\t\r\n]+/g, " ").trim();
  const compararNatural = (a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true });
  const dataBR = (d) => {
    const p = (n) => String(n).padStart(2, "0");
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  };

  function parseData(s) {
    const t = String(s || "");
    let m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      const ano = m[3].length === 2 ? 2000 + +m[3] : +m[3];
      const d = new Date(ano, +m[2] - 1, +m[1]);
      return d.getMonth() === +m[2] - 1 ? d : null;
    }
    m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      return d.getMonth() === +m[2] - 1 ? d : null;
    }
    return null;
  }

  function diasDesde(s, hoje = new Date()) {
    const d = parseData(s);
    if (!d) return null;
    const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    return Math.round((h - d) / 86400000);
  }

  // PENDENTE | NAO_IMPRESSO | REIMPRIMIR | IMPRESSO | DATA_INVALIDA
  function classificarPedido(p, hoje = new Date(), reprintDias = CONFIG.reprintDias) {
    if (norm(p.entrega).includes("pendente")) return "PENDENTE";
    const im = norm(p.impressao);
    if (/nao (foi )?impress/.test(im)) return "NAO_IMPRESSO";
    const d = diasDesde(p.impressao, hoje);
    if (d === null) return "DATA_INVALIDA";
    return d >= reprintDias ? "REIMPRIMIR" : "IMPRESSO";
  }
  const IMPRIMIVEL = ["NAO_IMPRESSO", "REIMPRIMIR"];

  // Levas a buscar para um caminhão: as da faixa dele que existem no filtro.
  // Sem faixa → todas as levas do filtro (porFaixa: false).
  function levasPara(caminhao, levasDoFiltro, faixas = CONFIG.levasPorCaminhao) {
    const k = chave(caminhao);
    const f = /^\d+$/.test(k) ? faixas.find((x) => +k >= x.de && +k <= x.ate) : null;
    if (!f) return { levas: [...levasDoFiltro], porFaixa: false };
    const quer = new Set(f.levas.map(chave));
    return { levas: levasDoFiltro.filter((l) => quer.has(chave(l))), porFaixa: true };
  }

  // Separa "299A" em { num: "299", leva: "A" }, de preferência usando as opções
  // reais dos filtros Caminhão e Leva da tela.
  function identificar(nome, nums = [], levas = []) {
    const k = chave(nome);
    const ns = nums.map(chave).filter(Boolean).sort((a, b) => b.length - a.length);
    const ls = new Set(levas.map(chave));
    for (const n of ns) if (k.startsWith(n) && ls.has(k.slice(n.length))) return { num: n, leva: k.slice(n.length), nome: k };
    const m = k.match(/^(\d+)([A-Z]+)$/) || k.match(/^([A-Z])([A-Z]+)$/);
    if (m) return { num: m[1], leva: m[2], nome: k };
    return { num: k, leva: "", nome: k };
  }

  function prioridade(c) {
    const nome = c.num + c.leva;
    for (let i = 0; i < PRIORIDADES.length; i++) {
      const r = PRIORIDADES[i];
      const casa = r.nomes ? r.nomes.includes(nome) : r.se(c);
      if (casa) return { ordem: i, sub: r.nomes ? r.nomes.indexOf(nome) : 0, grupo: r.grupo, tipo: r.tipo };
    }
  }

  function ordenarGrupos(lista) {
    return [...lista].sort(
      (a, b) =>
        (a.fora ? 1 : 0) - (b.fora ? 1 : 0) ||
        a.prioridade.ordem - b.prioridade.ordem ||
        a.prioridade.sub - b.prioridade.sub ||
        compararNatural(a.num, b.num) ||
        a.leva.length - b.leva.length || // leva de uma letra antes da de duas (299Z antes de 299AA)
        compararNatural(a.leva, b.leva)
    );
  }

  function resumir(pedidos) {
    const r = { total: 0, naoImpresso: 0, reimprimir: 0, impresso: 0, pendente: 0, invalido: 0 };
    for (const p of pedidos) {
      r.total++;
      if (p.classe === "NAO_IMPRESSO") r.naoImpresso++;
      else if (p.classe === "REIMPRIMIR") r.reimprimir++;
      else if (p.classe === "IMPRESSO") r.impresso++;
      else if (p.classe === "PENDENTE") r.pendente++;
      else r.invalido++;
    }
    r.aImprimir = r.naoImpresso + r.reimprimir;
    if (r.aImprimir === 0) {
      r.situacao = r.impresso ? "IMPRESSO" : r.pendente ? "SO_PENDENTES" : r.invalido ? "VERIFICAR" : "VAZIO";
    } else if (r.naoImpresso === 0) {
      r.situacao = "REIMPRIMIR";
    } else {
      r.situacao = r.impresso || r.reimprimir ? "PARCIAL" : "NAO_IMPRESSO";
    }
    return r;
  }

  function detectarColunas(cabecalhos) {
    const h = cabecalhos.map(norm);
    const res = {};
    const usados = new Set();
    let porCabecalho = 0;
    for (const [nome, def] of Object.entries(CONFIG.colunas)) {
      let idx = -1;
      for (const alvo of def.cabecalho) {
        idx = h.findIndex((t, i) => !usados.has(i) && t === alvo);
        if (idx >= 0) break;
      }
      if (idx < 0)
        for (const alvo of def.cabecalho) {
          idx = h.findIndex((t, i) => !usados.has(i) && t.includes(alvo));
          if (idx >= 0) break;
        }
      if (idx >= 0) {
        usados.add(idx);
        porCabecalho++;
      }
      res[nome] = idx >= 0 ? idx : def.padrao;
    }
    res.fonte = porCabecalho === Object.keys(CONFIG.colunas).length ? "cabecalho" : porCabecalho ? "misto" : "padrao";
    return res;
  }

  // Mesmo formato da v1: Caminhão, Rota, Pedido, Data Entrega, Data Impressão.
  const tsv = (registros) =>
    registros.map((x) => [x.caminhao, x.rota, x.pedido, x.entrega, x.impressao].map(limpar).join("\t")).join("\n");

  const escHtml = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // Rota da capa = "ROTA FORMULA" da planilha: 1º caractere + o que vem depois do traço.
  // Ex.: "6.0001.001-0645" → "60645". Sem traço, fica como está.
  const rotaCapa = (rota) => {
    const r = limpar(rota);
    const i = r.indexOf("-");
    return i >= 0 ? r.charAt(0) + r.slice(i + 1) : r;
  };

  // Agrupa os pedidos impressos por caminhão, na ordem em que foram impressos.
  function montarCapas(registros) {
    const porCaminhao = new Map();
    for (const x of registros) {
      const cam = limpar(x.caminhao);
      if (!porCaminhao.has(cam)) porCaminhao.set(cam, { caminhao: cam, linhas: [] });
      porCaminhao.get(cam).linhas.push({ caminhao: cam, rota: rotaCapa(x.rota), pedido: limpar(x.pedido) });
    }
    return [...porCaminhao.values()];
  }

  // Logo da Planilha1 da CHECK CAMINHAO FRESH NOVO.xlsm (xl/media/image1.png).
  const LOGO_CAPA = "data:image/png;base64,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";

  // Folha A4 por caminhão, reproduzindo a Planilha1 da CHECK CAMINHAO FRESH NOVO.xlsm
  // célula por célula: colunas A–G, linhas 1–49, mesmas larguras, alturas, bordas,
  // fontes, logo, moldura e centralização na página.
  function htmlCapas(capas) {
    const e = escHtml;
    const LARGURAS = [9, 16.44140625, 15.77734375, 26.21875, 15.5546875, 12.33203125, 0.44140625]; // A–G, em caracteres do Excel
    const PX = (w) => (w * 7.2).toFixed(1) + "px"; // mesma conversão que o Excel usou para posicionar o logo
    const td = (cls, txt = "", extra = "") => `<td class="${cls}"${extra}>${txt}</td>`;
    const linha = (alturaPt, celulas) => `<tr style="height:${alturaPt}pt">${celulas}</tr>`;
    const lado = (meio) => td("bl") + meio + td("br") + td("");
    const vazias = (n) => td("") + td("") + td("") + td("");
    const folha = (c) => {
      const L = [];
      L.push(linha(22.8, td("bl bt") + td("bt") + td("bt") + td("bt") + td("bt") + td("br bt") + td(""))); // 1
      for (let r = 2; r <= 9; r++) L.push(linha(14.4, lado(vazias()))); // 2–9 (logo)
      L.push(linha(28.8, lado(td("") + td("titulo", "CHECK CAMINHÃO " + e(c.caminhao), ' colspan="2"') + td("c", e(c.caminhao))))); // 10
      L.push(linha(14.4, lado(vazias()))); // 11
      L.push(linha(14.4, td("bl") + td("cab", "<span>CAMINHÃO</span>") + td("cab", "<span>ROTA</span>") + td("cab", "<span>NÚMERO PEDIDO</span>") + td("cab", "<span>CHECK</span>") + td("cab cab-f", "<span>MAPEADO?</span>") + td(""))); // 12
      // 13–39: 27 linhas com borda (cresce se o caminhão tiver mais pedidos).
      const total = Math.max(CONFIG.capa.linhasMinimas, c.linhas.length);
      for (let i = 0; i < total; i++) {
        const l = c.linhas[i] || { caminhao: "", rota: "", pedido: "" };
        const rotaCls = 13 + i <= 24 ? "g m" : "g c m"; // na planilha, a rota fica à esquerda até a linha 24 e centralizada depois
        L.push(linha(14.4, td("bl") + td("g m", e(l.caminhao)) + td(rotaCls, e(l.rota)) + td("g c m", e(l.pedido)) + td("g") + td("g") + td("")));
      }
      L.push(linha(14.4, lado(vazias()))); // 40
      L.push(linha(14.4, lado(vazias()))); // 41
      L.push(linha(16.2, lado(vazias()))); // 42
      L.push(linha(15, lado(td("bb") + td("bb") + td("") + td("m", "_______:_______")))); // 43
      L.push(linha(14.4, lado(vazias()))); // 44
      L.push(linha(14.4, lado(td("c m", "FISCAL RESPONSÁVEL", ' colspan="2"') + td("") + td("c m", "HORÁRIO FIM")))); // 45
      for (let r = 46; r <= 48; r++) L.push(linha(14.4, lado(vazias()))); // 46–48
      L.push(linha(14.4, td("bl bb") + td("bb") + td("bb") + td("bb") + td("bb") + td("br bb") + td(""))); // 49
      return `<section class="pagina"><div class="planilha">
<img class="logo" src="${LOGO_CAPA}" alt="">
<table><colgroup>${LARGURAS.map((w) => `<col style="width:${PX(w)}">`).join("")}</colgroup><tbody>
${L.join("\n")}
</tbody></table></div></section>`;
    };
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>CHECK CAMINHÃO</title><style>
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0;background:#fff}
body{font:11pt Calibri,Carlito,"Segoe UI",Arial,sans-serif;color:#000}
.pagina{width:210mm;min-height:297mm;display:flex;align-items:center;justify-content:center;break-after:page;page-break-after:always}
.pagina:last-child{break-after:auto;page-break-after:auto}
.planilha{position:relative;zoom:${Number(CONFIG.capa.escala) || 1}}
.logo{position:absolute;left:116.8px;top:12.8px;width:452px;height:178.9px}
table{border-collapse:collapse;table-layout:fixed}
td{padding:0 2px;white-space:nowrap;overflow:hidden;vertical-align:bottom;line-height:1.1}
.bl{border-left:1px solid #000}.br{border-right:1px solid #000}.bt{border-top:1px solid #000}.bb{border-bottom:1px solid #000}
.g{border:1px solid #000}
.c{text-align:center}.m{vertical-align:middle}
.titulo{font-weight:bold;font-size:22pt;text-align:center}
.cab{position:relative;border:1px solid #000;background:#000;color:#fff;font-weight:bold;text-align:center;vertical-align:middle}
.cab-f{border-left:0;border-top:0;border-bottom:0}
/* Fundo preto também quando "gráficos de fundo" estiver desligado na impressão: bordas sempre saem. */
.cab::before{content:"";position:absolute;inset:0;border-top:40px solid #000;z-index:0}
.cab span{position:relative;z-index:1}
</style></head><body>${capas.map(folha).join("")}</body></html>`;
  }

  // Colunas A–C da Planilha2 da CHECK CAMINHAO FRESH NOVO (Caminhão, Rota, Número pedido).
  const tsvPlanilhaCapa = (registros) => registros.map((x) => [x.caminhao, x.rota, x.pedido].map(limpar).join("\t")).join("\n");

  const csv = (linhas) =>
    linhas.map((l) => l.map((v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(";")).join("\r\n");

  const LOGICA = {
    VERSAO, CONFIG, PRIORIDADES, foraDaFila, norm, chave, parseData, diasDesde, classificarPedido,
    identificar, levasPara, prioridade, ordenarGrupos, resumir, detectarColunas, tsv, csv, dataBR,
    rotaCapa, montarCapas, htmlCapas, tsvPlanilhaCapa,
  };
  if (typeof document === "undefined") {
    if (typeof module !== "undefined") module.exports = LOGICA;
    return;
  }

  // ============================================================
  // NAVEGADOR — leitura e controle da tela do KDABRA
  // ============================================================
  if (window.__SLC_PREOP__ && window.__SLC_PREOP__.host && document.body.contains(window.__SLC_PREOP__.host)) {
    window.__SLC_PREOP__.mostrar(MODO_INICIAL);
    return;
  }

  const S = CONFIG.seletores;
  const T = CONFIG.tempos;
  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visivel = (e) => {
    if (!e || !e.isConnected) return false;
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
  };
  const textoCel = (td) => String(td.innerText || td.textContent || "").replace(/\s+/g, " ").trim();
  const disparar = (el, ...tipos) => tipos.forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })));

  const elementos = () => {
    const E = {
      caminhao: $(S.caminhao),
      leva: $(S.leva),
      impresso: $(S.impresso),
      buscar: $(S.buscar),
      tabela: $(S.tabela),
      finalizar: $(S.finalizar),
    };
    E.faltando = Object.keys(E).filter((k) => !E[k]);
    return E;
  };

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e2) {}
      ta.remove();
      return ok;
    }
  }

  function lerOpcoes(sel) {
    const lista = [];
    const vistos = new Set();
    let todos = null;
    for (const o of sel ? sel.options : []) {
      const text = String(o.textContent || o.value || "").trim();
      const key = chave(text);
      if (["TODOS", "TODAS", "TODO"].includes(key)) {
        todos = todos || { value: o.value, text, key };
        continue;
      }
      if (!o.value || ["", "SELECIONE", "SELECIONAR", "SIM", "NAO"].includes(key) || vistos.has(key)) continue;
      vistos.add(key);
      lista.push({ value: o.value, text, key });
    }
    return { lista, todos };
  }

  function selecionar(sel, valor) {
    sel.disabled = false;
    sel.value = valor;
    if (window.jQuery) {
      try {
        window.jQuery(sel).val(valor).trigger("change");
        return;
      } catch (e) {}
    }
    disparar(sel, "input", "change");
  }

  async function esperarOpcao(sel, valor, ms = 3000) {
    const fim = Date.now() + ms;
    while (Date.now() < fim) {
      if ([...sel.options].some((o) => o.value === valor)) return true;
      await sleep(100);
    }
    return false;
  }

  function dataTable() {
    try {
      const jq = window.jQuery;
      if (jq && jq.fn.DataTable && jq.fn.DataTable.isDataTable(S.tabela)) return jq(S.tabela).DataTable();
    } catch (e) {}
    return null;
  }

  function linhasTabela() {
    const dt = dataTable();
    if (dt) {
      try {
        return dt.rows({ search: "applied" }).nodes().toArray();
      } catch (e) {}
    }
    return [...document.querySelectorAll(S.linhas)];
  }

  // Com paginação no servidor, só a página atual existe na tela: pedidos das outras
  // páginas não seriam vistos nem impressos. Aumenta a página para caber tudo.
  let avisouPaginacao = false;
  async function mostrarTodasAsLinhas() {
    const dt = dataTable();
    if (!dt) return;
    const info = dt.page.info();
    if (info.pages <= 1 || info.length < 0) return;
    const antes = assinatura();
    const obs = observarTabela();
    dt.page.len(Math.max(CONFIG.linhasPorPagina, info.recordsDisplay)).draw();
    await esperarTabela(antes, obs);
    await sleep(T.estabilizar);
    const depois = dt.page.info();
    if (depois.pages > 1)
      log(`ATENÇÃO: a tabela continua paginada (${depois.end - depois.start} de ${depois.recordsDisplay} pedidos na tela). Os demais ficam para a próxima passada.`);
    else if (!avisouPaginacao) {
      avisouPaginacao = true;
      log(`Tabela paginada (${info.length} por página): passando a mostrar todos os pedidos de uma vez.`);
    }
  }

  const cabecalhos = () => [...document.querySelectorAll(S.tabela + " thead th")].map((th) => th.textContent || "");

  function lerTabela() {
    let col = detectarColunas(cabecalhos());
    if (col.fonte === "misto") col = detectarColunas([]); // cabeçalhos incompletos: usa as posições da v1
    const hoje = new Date();
    const pedidos = [];
    for (const row of linhasTabela()) {
      const tds = [...row.querySelectorAll("td")];
      if (tds.length < 3) continue; // linha "nenhum registro"
      const v = (k) => (tds[col[k]] ? textoCel(tds[col[k]]) : "");
      const p = { row, caminhao: v("caminhao"), rota: v("rota"), pedido: v("pedido"), entrega: v("entrega"), impressao: v("impressao") };
      if (!p.pedido) continue;
      p.classe = classificarPedido(p, hoje);
      pedidos.push(p);
    }
    return pedidos;
  }

  function assinatura() {
    const ls = linhasTabela();
    const amostra = [...ls.slice(0, 3), ...ls.slice(-2)].map((r) => String(r.textContent).replace(/\s+/g, " ").trim());
    return ls.length + "#" + amostra.join("|");
  }

  const carregando = () => [...document.querySelectorAll(S.carregando)].some(visivel);

  // Observa qualquer redesenho da tabela (mesmo que o conteúdo fique igual).
  function observarTabela() {
    const o = { mutou: false };
    const mo = new MutationObserver(() => (o.mutou = true));
    mo.observe($(S.tabela) || document.body, { childList: true, subtree: true, characterData: true });
    o.parar = () => mo.disconnect();
    return o;
  }

  // Espera a busca terminar: o loader some E a tabela para de mudar.
  // Devolve `mudou: false` quando a tabela ficou igual à de antes da busca,
  // o que serve para detectar tabela "presa" no caminhão anterior.
  async function esperarTabela(antes, obs) {
    const inicio = Date.now();
    let viuLoader = false;
    let ultima = null;
    let estavel = 0;
    await sleep(Math.min(150, T.intervalo));
    try {
      while (Date.now() - inicio < T.limiteBusca) {
        if (carregando()) {
          viuLoader = true;
          estavel = 0;
          await sleep(T.intervalo);
          continue;
        }
        const a = assinatura();
        estavel = a === ultima ? estavel + 1 : 0;
        ultima = a;
        const mudou = a !== antes;
        const respondeu = viuLoader || mudou || (obs && obs.mutou);
        if (respondeu && estavel >= 2) return { ok: true, mudou };
        if (!respondeu && Date.now() - inicio > T.semResposta) return { ok: true, mudou: false };
        await sleep(T.intervalo);
      }
      return { ok: false, mudou: assinatura() !== antes };
    } finally {
      if (obs) obs.parar();
    }
  }

  function desligarItens() {
    const x = $(S.itensToggle);
    if (!x) return;
    if (window.jQuery && window.jQuery.fn.bootstrapToggle) {
      try {
        window.jQuery(x).bootstrapToggle("off");
      } catch (e) {}
    }
    if (x.checked) {
      x.checked = false;
      disparar(x, "change");
    }
  }

  async function ativarModo(modo) {
    const alvo = CONFIG.modos[modo].botao;
    const b = [...document.querySelectorAll(S.botoesModo)].find((x) => norm(x.innerText || x.textContent).includes(alvo));
    if (b && !b.classList.contains("active")) {
      const antes = assinatura();
      b.click();
      await sleep(800);
      await esperarTabela(antes);
    }
  }

  async function buscar(consulta) {
    const E = elementos();
    if (E.faltando.length) throw new Error("Elementos não encontrados na tela: " + E.faltando.join(", "));
    const antes = assinatura();
    // Só troca o filtro que mudou: cada troca faz o KDABRA recarregar a tabela.
    if (E.caminhao.value !== consulta.caminhao.value) {
      selecionar(E.caminhao, consulta.caminhao.value);
      await sleep(T.aposSelecionar);
    }
    if (consulta.leva && E.leva.value !== consulta.leva.value) {
      await esperarOpcao(E.leva, consulta.leva.value);
      selecionar(E.leva, consulta.leva.value);
      await sleep(T.aposSelecionar);
    }
    const todos = lerOpcoes(E.impresso).todos;
    const valorTodos = todos ? todos.value : "0";
    if (E.impresso.value !== valorTodos) selecionar(E.impresso, valorTodos);
    desligarItens();
    E.buscar.disabled = false;
    const obs = observarTabela();
    E.buscar.click();
    const r = await esperarTabela(antes, obs);
    await sleep(T.estabilizar);
    if (r.ok) await mostrarTodasAsLinhas();
    return { ok: r.ok, mudou: r.mudou, pedidos: lerTabela() };
  }


  const caixaDaLinha = (row) => [...row.querySelectorAll("input[type='checkbox']")].find((x) => x.id !== S.checkAllId);
  const linhaMarcada = (row) => {
    const cb = caixaDaLinha(row);
    return cb ? cb.checked : row.classList.contains("selected") || row.getAttribute("aria-selected") === "true";
  };

  function marcar(row, valor = true) {
    const cb = caixaDaLinha(row);
    if (cb) {
      if (cb.checked !== valor) {
        cb.click();
        if (cb.checked !== valor) {
          cb.checked = valor;
          disparar(cb, "change");
          if (window.jQuery) window.jQuery(cb).trigger("change");
        }
      }
      return cb.checked === valor;
    }
    // Sem checkbox: tenta selecionar a linha (DataTables Select) e confere.
    if (linhaMarcada(row) !== valor) {
      const td = row.querySelector("td");
      if (td) td.click();
    }
    return linhaMarcada(row) === valor;
  }

  function desmarcarTodos() {
    for (const row of linhasTabela()) if (linhaMarcada(row)) marcar(row, false);
    const all = document.getElementById(S.checkAllId);
    if (all && all.checked) {
      all.checked = false;
      disparar(all, "change");
    }
  }

  const contarMarcados = () => linhasTabela().filter(linhaMarcada).length;

  async function confirmarDialogos() {
    let vazias = 0;
    for (let i = 0; i < 20 && vazias < 3; i++) {
      await sleep(400);
      const b = S.confirmacoes.map((s) => $(s)).find(visivel);
      if (b) {
        b.click();
        vazias = 0;
        await sleep(500);
      } else vazias++;
    }
  }

  // ============================================================
  // ESTADO
  // ============================================================
  const CHAVE_STORAGE = "slcPreop.v2.ultimaExecucao";
  const estado = {
    modo: CONFIG.modos[MODO_INICIAL] ? MODO_INICIAL : "mercearia",
    rodando: null, // "mapear" | "imprimir"
    parar: false,
    grupos: new Map(),
    estrategia: null,
    registros: [], // pedidos impressos nesta execução (vão para o TSV)
    anterior: null, // última execução com pedidos, guardada no navegador
    impressosNaExecucao: new Set(),
    abertos: new Set(),
    progresso: { feito: 0, total: 0, inicio: 0 },
    status: "",
    logs: [],
  };

  const modoNome = () => CONFIG.modos[estado.modo].nome;
  const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  // Só grava quando a execução imprimiu algo, para não apagar a anterior à toa.
  function salvarExecucao() {
    if (!estado.registros.length) return;
    estado.anterior = { modo: estado.modo, quando: new Date().toISOString(), registros: estado.registros };
    try {
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify(estado.anterior));
    } catch (e) {}
  }

  function restaurarExecucao() {
    try {
      const x = JSON.parse(localStorage.getItem(CHAVE_STORAGE) || "null");
      if (x && Array.isArray(x.registros) && x.registros.length && dataBR(new Date(x.quando)) === dataBR(new Date())) estado.anterior = x;
    } catch (e) {}
  }

  function log(msg) {
    estado.logs.push(new Date().toLocaleTimeString("pt-BR") + "  " + msg);
    if (estado.logs.length > 800) estado.logs.shift();
    console.log("[SLC PreOp] " + msg);
    agendarRender();
  }

  function setStatus(msg) {
    estado.status = msg;
    agendarRender();
  }

  const idConsulta = (c) => c.caminhao.value + "|" + (c.leva ? c.leva.value : "*");

  function grupoPara(id, info) {
    let g = estado.grupos.get(id);
    if (!g) {
      const ident = identificar(id, info.nums, info.levas);
      g = {
        id,
        nome: info.nome || ident.nome,
        num: ident.num,
        leva: ident.leva,
        prioridade: prioridade(ident),
        fora: foraDaFila(ident),
        consulta: info.consulta,
        valoresColuna: new Set(),
        pedidos: new Map(),
        resumo: resumir([]),
        erro: null,
        impressosAgora: 0,
        simulados: 0,
        naoConfirmados: [],
      };
      estado.grupos.set(id, g);
    }
    return g;
  }

  const semRow = ({ row, ...p }) => p;

  const logLeitura = (g) => {
    const r = g.resumo;
    log(`${g.nome}: ${r.total} pedido(s) — ${r.naoImpresso} não impresso(s), ${r.reimprimir} 7d+, ${r.impresso} impresso(s), ${r.pendente} pendente(s)` + (r.invalido ? `, ${r.invalido} com data inválida` : ""));
  };

  function atualizarPedidos(g, pedidos) {
    g.pedidos = new Map(pedidos.map((p) => [chave(p.pedido), semRow(p)]));
    g.resumo = resumir(g.pedidos.values());
  }

  // Na impressão, só considera linhas cuja coluna Caminhão bate com o que foi
  // visto na leitura — protege contra a tabela de outro caminhão.
  const doGrupo = (g, pedidos) => (g.valoresColuna.size ? pedidos.filter((p) => g.valoresColuna.has(chave(p.caminhao))) : pedidos);

  function fase(tipo, total) {
    estado.rodando = tipo;
    estado.progresso = { feito: 0, total, inicio: Date.now() };
    agendarRender();
  }

  // ============================================================
  // EXECUÇÃO — clicou no favorito, imprime tudo e copia
  // ============================================================
  async function executar() {
    if (estado.rodando) return;
    estado.parar = false;
    estado.grupos = new Map();
    estado.abertos.clear();
    estado.registros = [];
    estado.impressosNaExecucao = new Set();
    fase("mapear", 0);
    try {
      const E = elementos();
      if (E.faltando.length) throw new Error("Não achei na tela: " + E.faltando.join(", ") + ". Confere se está no Checkout.");
      await lerCaminhoes();
      if (estado.parar) return fim("⏹️ Parado antes de imprimir. Nada foi impresso.");
      await imprimirTudo();
    } catch (e) {
      fim("Erro: " + e.message);
      alert("SLC PreOp: " + e.message);
    }
  }

  function fim(msg) {
    estado.rodando = null;
    estado.parar = false;
    setStatus(msg);
    log(msg);
  }

  // 1ª parte: descobre todos os caminhões e a situação de cada um (só leitura).
  async function lerCaminhoes() {
    setStatus("Ativando " + modoNome() + "…");
    await ativarModo(estado.modo);
    const E = elementos();
    const cams = lerOpcoes(E.caminhao);
    const levas = lerOpcoes(E.leva);
    let estrategia = CONFIG.varredura;
    if (estrategia === "auto") estrategia = levas.todos ? "porCaminhao" : "porCombinacao";
    if (estrategia === "porCaminhao" && !levas.todos) estrategia = "porCombinacao";
    if (estrategia === "tudo" && !(cams.todos && levas.todos)) estrategia = levas.todos ? "porCaminhao" : "porCombinacao";
    estado.estrategia = estrategia;
    const info = { nums: cams.lista.map((o) => o.text), levas: levas.lista.map((o) => o.text) };
    log(`${modoNome()}: ${cams.lista.length} caminhões e ${levas.lista.length} levas no filtro (leitura: ${estrategia}).`);

    // Caminhões fora da fila (3000+) nem são lidos.
    const naFila = cams.lista.filter((c) => !foraDaFila({ num: chave(c.text), leva: "" }));
    if (naFila.length < cams.lista.length) log(`${cams.lista.length - naFila.length} caminhão(ões) fora da fila não lidos.`);

    const consultas = [];
    if (estrategia === "tudo") consultas.push([{ caminhao: cams.todos, leva: levas.todos }]);
    else if (estrategia === "porCaminhao") naFila.forEach((c) => consultas.push([{ caminhao: c, leva: levas.todos }]));
    else {
      const semFaixa = [];
      for (const c of naFila) {
        const r = levasPara(c.text, levas.lista.map((l) => l.text));
        if (!r.porFaixa) semFaixa.push(c.text);
        consultas.push(r.levas.map((t) => ({ caminhao: c, leva: levas.lista.find((l) => l.text === t) })));
      }
      if (semFaixa.length) log(`Sem faixa em levasPorCaminhao (busca todas as levas, mais lento): ${semFaixa.join(", ")}`);
      log(`${consultas.reduce((s, x) => s + x.length, 0)} buscas no total.`);
    }
    estado.progresso.total = consultas.length;

    let ultimaId = null;
    for (const subconsultas of consultas) {
      if (estado.parar) break;
      for (const c of subconsultas) {
        if (estado.parar) break;
        const rotulo = estrategia === "porCombinacao" ? c.caminhao.text + c.leva.text : c.caminhao.text;
        setStatus(`Lendo caminhões: ${rotulo}`);
        let r = await buscar(c);
        const id = idConsulta(c);
        if (r.ok && !r.mudou && r.pedidos.length && ultimaId && ultimaId !== id) {
          log(`${rotulo}: tabela não mudou, buscando de novo.`);
          r = await buscar(c);
        }
        ultimaId = id;
        if (!r.ok) {
          log(`${rotulo}: o KDABRA demorou demais para responder — pulado.`);
          continue;
        }
        if (estrategia === "porCombinacao") {
          if (!r.pedidos.length) continue;
          if (!r.mudou) {
            log(`${rotulo}: tabela não atualizou — pulado para não misturar caminhões.`);
            continue;
          }
          const nome = c.caminhao.text + c.leva.text;
          const g = grupoPara(chave(nome), { ...info, nome, consulta: c });
          r.pedidos.forEach((p) => g.valoresColuna.add(chave(p.caminhao)));
          atualizarPedidos(g, r.pedidos);
          logLeitura(g);
        } else {
          const porNome = new Map();
          for (const p of r.pedidos) {
            const nome = p.caminhao || c.caminhao.text;
            if (!porNome.has(chave(nome))) porNome.set(chave(nome), { nome, lista: [] });
            porNome.get(chave(nome)).lista.push(p);
          }
          for (const [id2, { nome, lista }] of porNome) {
            const ident = identificar(nome, info.nums, info.levas);
            const camOp = cams.lista.find((o) => o.key === ident.num) || c.caminhao;
            const levaOp = levas.lista.find((o) => o.key === ident.leva);
            const g = grupoPara(id2, { ...info, nome, consulta: levaOp ? { caminhao: camOp, leva: levaOp } : c });
            g.valoresColuna.add(id2);
            const juntos = new Map(g.pedidos);
            lista.forEach((p) => juntos.set(chave(p.pedido), semRow(p)));
            g.pedidos = juntos;
            g.resumo = resumir(juntos.values());
            logLeitura(g);
          }
        }
      }
      estado.progresso.feito++;
      agendarRender();
    }
    const lista = [...estado.grupos.values()];
    log(`Leitura concluída: ${lista.length} caminhões com pedidos, ${lista.filter((g) => g.resumo.aImprimir && !g.fora).length} com pedidos a imprimir.`);
  }

  // 2ª parte: imprime, na ordem de prioridade, todo caminhão com pedido a imprimir.
  async function imprimirTudo() {
    const sim = CONFIG.simulacao;
    const alvo = ordenarGrupos([...estado.grupos.values()]).filter((g) => g.resumo.aImprimir > 0 && !g.fora);
    if (!alvo.length) {
      fim("✅ Finalizado. Nenhum pedido para imprimir.");
      alert(`✅ Finalizado. Modo: ${modoNome()}. Nenhum pedido imprimível encontrado.`);
      return;
    }
    fase("imprimir", alvo.length);
    let simulados = 0;
    let naoConfirmados = 0;
    let ultimaId = null;
    for (const g of alvo) {
      if (estado.parar) break;
      setStatus(`${sim ? "Simulando" : "Imprimindo"} ${g.nome} (${g.prioridade.grupo} · ${g.prioridade.tipo})`);
      try {
        const r = await buscar(g.consulta);
        const id = idConsulta(g.consulta);
        if (!r.ok) throw new Error("o KDABRA demorou demais para responder");
        if (!r.mudou && r.pedidos.length && ultimaId && ultimaId !== id)
          throw new Error("a tabela não atualizou depois da busca (pode ser a do caminhão anterior)");
        ultimaId = id;

        const linhas = doGrupo(g, r.pedidos);
        if (r.pedidos.length && !linhas.length) throw new Error("a tabela mostrou pedidos de outro caminhão");
        atualizarPedidos(g, linhas);
        const imprimiveis = linhas.filter((p) => IMPRIMIVEL.includes(p.classe) && !estado.impressosNaExecucao.has(chave(p.pedido)));
        if (!imprimiveis.length) {
          log(`${g.nome}: nada a imprimir.`);
          continue;
        }

        desmarcarTodos();
        const marcados = imprimiveis.filter((p) => marcar(p.row));
        if (marcados.length < imprimiveis.length) log(`${g.nome}: ${imprimiveis.length - marcados.length} pedido(s) sem checkbox — não impressos.`);
        const naTela = contarMarcados();
        if (naTela !== marcados.length) {
          desmarcarTodos();
          throw new Error(`marcação não confere (${naTela} marcados na tela, esperado ${marcados.length}) — nada impresso`);
        }
        if (!marcados.length) throw new Error("nenhum pedido pôde ser marcado");

        if (sim) {
          g.simulados = marcados.length;
          simulados += marcados.length;
          desmarcarTodos();
          log(`${g.nome}: SIMULAÇÃO — seriam impressos: ${marcados.map((p) => p.pedido).join(", ")}`);
          continue;
        }

        const antes = assinatura();
        const obs = observarTabela();
        elementos().finalizar.click();
        await confirmarDialogos();
        await esperarTabela(antes, obs);
        await sleep(T.aposFinalizar);

        const hoje = dataBR(new Date());
        for (const p of marcados) {
          estado.impressosNaExecucao.add(chave(p.pedido));
          estado.registros.push({ caminhao: p.caminhao, rota: p.rota, pedido: p.pedido, entrega: p.entrega, impressao: hoje, reimpressao: p.classe === "REIMPRIMIR" });
        }
        g.impressosAgora += marcados.length;
        salvarExecucao();
        copiar(tsv(estado.registros)).catch(() => {});
        log(`${g.nome}: ${marcados.length} pedido(s) impressos.`);

        if (CONFIG.conferirAposImprimir) {
          setStatus(`Conferindo ${g.nome}`);
          const r2 = await buscar(g.consulta);
          const depois = new Map(doGrupo(g, r2.pedidos).map((p) => [chave(p.pedido), p]));
          g.naoConfirmados = marcados.filter((p) => !depois.has(chave(p.pedido)) || depois.get(chave(p.pedido)).classe !== "IMPRESSO").map((p) => p.pedido);
          if (r2.ok) atualizarPedidos(g, [...depois.values()]);
          if (g.naoConfirmados.length) {
            naoConfirmados += g.naoConfirmados.length;
            log(`${g.nome}: ATENÇÃO — ${g.naoConfirmados.length} pedido(s) não aparecem como impressos: ${g.naoConfirmados.join(", ")}`);
          }
        }
      } catch (e) {
        g.erro = e.message;
        log(`${g.nome}: ERRO — ${e.message}`);
      } finally {
        estado.progresso.feito++;
        agendarRender();
      }
    }

    const parado = estado.parar;
    if (sim) {
      fim(`🧪 Simulação ${parado ? "parada" : "concluída"}: ${simulados} pedidos seriam impressos. Nada foi impresso.`);
      return;
    }
    const n = estado.registros.length;
    const rep = estado.registros.filter((x) => x.reimpressao).length;
    const erros = alvo.filter((g) => g.erro).length;
    const copiou = n ? await copiar(tsv(estado.registros)) : false;
    fim(
      `${parado ? "⏹️ Parado" : "✅ Finalizado"}: ${n} pedidos impressos (${rep} reimpressos 7d+)` +
        (erros ? ` · ${erros} caminhão(ões) com erro` : "") +
        (naoConfirmados ? ` · ${naoConfirmados} não confirmados` : "") +
        (n ? (copiou ? " · copiado, cole na Impressos V2." : " · clique em “Copiar para Impressos V2”.") : ".")
    );
    alert(
      `${parado ? "⏹️ Parado." : "✅ Finalizado."}\n\nModo: ${modoNome()}\n` +
        `Pedidos impressos/copiados para Impressos V2: ${n}\nReimpressos 7+d: ${rep}\n` +
        (erros ? `\n⚠️ Caminhões com erro (não impressos): ${alvo.filter((g) => g.erro).map((g) => g.nome).join(", ")}\n` : "") +
        (naoConfirmados ? `\n⚠️ Pedidos que não apareceram como impressos: ${naoConfirmados} (veja no painel)\n` : "") +
        (n ? (copiou ? "\nAgora abre a planilha e aperta Ctrl+V." : "\nClique em “Copiar para Impressos V2” no painel e cole na planilha.") : "") +
        (n && CONFIG.capa.modos.includes(estado.modo)
          ? CONFIG.capa.automatica
            ? "\n\n🖨️ Em seguida abre a impressão das capas (CHECK CAMINHÃO)."
            : "\n\n🖨️ Clique em “Imprimir capas” no painel."
          : "")
    );
    if (n && CONFIG.capa.automatica && CONFIG.capa.modos.includes(estado.modo)) imprimirCapas();
  }

  // ============================================================
  // RELATÓRIOS E DIAGNÓSTICO
  // ============================================================
  const SITUACOES = {
    NAO_IMPRESSO: { rotulo: "Não impresso", cor: "vermelho" },
    PARCIAL: { rotulo: "Parcial", cor: "amarelo" },
    REIMPRIMIR: { rotulo: "Reimprimir 7d+", cor: "amarelo" },
    IMPRESSO: { rotulo: "Impresso", cor: "verde" },
    SO_PENDENTES: { rotulo: "Só pendentes", cor: "cinza" },
    VERIFICAR: { rotulo: "Data inválida", cor: "laranja" },
    VAZIO: { rotulo: "Vazio", cor: "cinza" },
  };
  const CLASSES = {
    NAO_IMPRESSO: "Não impresso",
    REIMPRIMIR: "Reimprimir 7d+",
    IMPRESSO: "Impresso",
    PENDENTE: "Pendente",
    DATA_INVALIDA: "Data inválida",
  };

  const situacaoTexto = (g) => (g.erro ? "Erro: " + g.erro : g.fora ? "Fora da fila" : SITUACOES[g.resumo.situacao].rotulo);
  // A execução atual, ou a última guardada no navegador (para copiar / imprimir capas depois).
  const execucaoGuardada = () => (estado.registros.length ? { modo: estado.modo, registros: estado.registros } : estado.anterior);
  const registrosParaCopiar = () => (execucaoGuardada() ? execucaoGuardada().registros : []);
  const capasDisponiveis = () => {
    const ex = execucaoGuardada();
    return ex && CONFIG.capa.modos.includes(ex.modo) ? montarCapas(ex.registros) : [];
  };

  // Para quem preferir a própria planilha: cola em A2 da Planilha2 e Ctrl+P na Planilha1.
  async function copiarParaPlanilhaCapa() {
    const ex = execucaoGuardada();
    if (!capasDisponiveis().length) return setStatus("Nada para a planilha da capa (as capas são só do Fresh).");
    const ok = await copiar(tsvPlanilhaCapa(ex.registros));
    setStatus(ok ? `${ex.registros.length} linhas copiadas — cole em A2 da Planilha2 da CHECK CAMINHAO FRESH NOVO e dê Ctrl+P na Planilha1.` : "Não consegui copiar.");
  }

  // Imprime as capas por um iframe escondido: uma janela de impressão para todas.
  function imprimirCapas() {
    const capas = capasDisponiveis();
    if (!capas.length) return setStatus("Nenhuma capa para imprimir (as capas são só do Fresh).");
    const velho = document.getElementById("slc-preop-capas");
    if (velho) velho.remove();
    const fr = document.createElement("iframe");
    fr.id = "slc-preop-capas";
    fr.title = "Capas CHECK CAMINHÃO";
    fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
    fr.onload = () => {
      try {
        fr.contentWindow.focus();
        fr.contentWindow.print();
      } catch (e) {
        log("Não consegui abrir a impressão das capas: " + e.message);
      }
    };
    fr.srcdoc = htmlCapas(capas);
    document.body.appendChild(fr);
    const msg = `Capas de ${capas.length} caminhão(ões) enviadas para impressão: ${capas.map((c) => c.caminhao).join(", ")}.`;
    setStatus(msg);
    log(msg);
  }

  async function copiarRegistros() {
    const regs = registrosParaCopiar();
    if (!regs.length) return setStatus("Nenhum pedido impresso para copiar ainda.");
    const ok = await copiar(tsv(regs));
    setStatus(ok ? `${regs.length} pedidos copiados — cole na Impressos V2 (Ctrl+V).` : "Não consegui copiar. Tente de novo.");
  }

  async function copiarResumo() {
    const lista = ordenarGrupos([...estado.grupos.values()]);
    if (!lista.length) return setStatus("Nenhum caminhão lido ainda.");
    const linhas = [["Caminhão", "Prioridade", "Pedidos", "A imprimir", "Reimprimir 7d+", "Impressos", "Pendentes", "Situação"]];
    lista.forEach((g) => linhas.push([g.nome, g.prioridade.grupo + " · " + g.prioridade.tipo, g.resumo.total, g.resumo.aImprimir, g.resumo.reimprimir, g.resumo.impresso, g.resumo.pendente, situacaoTexto(g)]));
    const ok = await copiar(linhas.map((l) => l.map(limpar).join("\t")).join("\n"));
    setStatus(ok ? "Resumo por caminhão copiado (cole em uma planilha)." : "Não consegui copiar.");
  }

  function baixarRelatorio() {
    const lista = ordenarGrupos([...estado.grupos.values()]);
    if (!lista.length) return setStatus("Nenhum caminhão lido ainda.");
    const linhas = [["Modo", "Caminhão", "Prioridade", "Situação do caminhão", "Rota", "Pedido", "Data Entrega", "Data Impressão", "Situação do pedido"]];
    for (const g of lista)
      for (const p of g.pedidos.values())
        linhas.push([modoNome(), g.nome, g.prioridade.grupo + " · " + g.prioridade.tipo, situacaoTexto(g), p.rota, p.pedido, p.entrega, p.impressao, CLASSES[p.classe]]);
    const blob = new Blob(["﻿" + csv(linhas)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `slc-preop-${estado.modo}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
    setStatus("Relatório CSV baixado.");
  }

  // Estrutura da tela, com todos os números trocados por 9 (sem dados reais).
  async function diagnostico() {
    const m = (s) => String(s || "").replace(/\d/g, "9").replace(/\s+/g, " ").trim();
    const sels = Object.entries(S).filter(([, v]) => typeof v === "string" && /^[#.]/.test(v));
    const E = elementos();
    const opc = (sel) => [...(sel ? sel.options : [])].map((o) => o.value + "=" + o.textContent.trim());
    const r = {
      versao: VERSAO,
      pagina: location.pathname,
      jquery: !!window.jQuery,
      datatable: !!(window.jQuery && window.jQuery.fn.DataTable),
      elementos: Object.fromEntries(sels.map(([k, v]) => [k + " " + v, document.querySelectorAll(v).length])),
      confirmacoes: Object.fromEntries(S.confirmacoes.map((s) => [s, document.querySelectorAll(s).length])),
      modos: [...document.querySelectorAll(S.botoesModo)].map((b) => b.textContent.trim() + (b.classList.contains("active") ? " (ativo)" : "")),
      caminhoes: opc(E.caminhao),
      levas: opc(E.leva),
      impresso: opc(E.impresso),
      cabecalho: cabecalhos().map((t) => t.trim()),
      colunasDetectadas: detectarColunas(cabecalhos()),
      linhasNaTabela: linhasTabela().length,
      paginacao: dataTable() ? { ...dataTable().page.info(), servidor: !!dataTable().settings()[0].oFeatures.bServerSide } : null,
      amostra: linhasTabela().slice(0, 5).map((tr) => [...tr.children].map((td) => (caixaDaLinha(tr) && td.contains(caixaDaLinha(tr)) ? "[checkbox] " : "") + m(td.textContent))),
      leituraUsada: estado.estrategia,
    };
    const txt = JSON.stringify(r, null, 1);
    console.log(txt);
    const ok = await copiar(txt);
    setStatus(ok ? "Diagnóstico copiado (sem dados reais)." : "Diagnóstico no console (F12).");
  }

  // ============================================================
  // PAINEL
  // ============================================================
  const CSS = `
:host{all:initial}
[hidden]{display:none!important}
*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.painel{position:fixed;right:14px;bottom:14px;z-index:2147483000;width:min(460px,calc(100vw - 28px));max-height:calc(100vh - 28px);display:flex;flex-direction:column;background:#15171b;color:#e8eaed;border:1px solid #2c3038;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.55);font-size:13px;overflow:hidden}
.topo{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1d2026;border-bottom:1px solid #2c3038;cursor:move;user-select:none}
.titulo{flex:1;font-size:14px}
.versao{font-size:11px;color:#8b93a1;margin-left:4px}
button{font:inherit;color:inherit;background:#2a2e36;border:1px solid #3a3f49;border-radius:8px;padding:7px 11px;cursor:pointer;white-space:nowrap}
button:hover:not(:disabled){background:#343944}
.janela button{padding:3px 9px}
.corpo{display:flex;flex-direction:column;gap:10px;padding:12px;overflow:auto;min-height:0}
.barra{height:8px;background:#2a2e36;border-radius:4px;overflow:hidden}
.barra i{display:block;height:100%;width:0;background:#3b6ef5;transition:width .3s}
.barra.ok i{background:#1f8f4e}
.status{color:#e8eaed;line-height:1.4}
.etapa{font-size:11px;color:#8b93a1;margin-top:2px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.kpis div{background:#1d2026;border:1px solid #2c3038;border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:2px}
.kpis b{font-size:20px;font-weight:650}
.kpis span{font-size:11px;color:#8b93a1;line-height:1.2}
.kpis .verde b{color:#4cc27f}.kpis .amarelo b{color:#f5c04a}.kpis .vermelho b{color:#ff6b6b}
.acoes{display:flex;gap:8px}
.acoes button{flex:1}
.copiar{background:#1f8f4e;border-color:#1f8f4e;color:#fff;font-weight:600}
.copiar:hover:not(:disabled){background:#1a7a43}
.perigo{background:#c94040;border-color:#c94040;color:#fff}
.capas{width:100%;background:#3b6ef5;border-color:#3b6ef5;color:#fff;font-weight:600}
.capas:hover:not(:disabled){background:#2f5fe0}
details{border-top:1px solid #2c3038;padding-top:8px}
summary{cursor:pointer;color:#aab1bd;user-select:none}
.mais{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.mais .botoes{display:flex;flex-wrap:wrap;gap:6px}
.mais .botoes button{padding:5px 9px;font-size:12px}
.tabela{border:1px solid #2c3038;border-radius:10px;overflow:auto;max-height:34vh}
table{width:100%;border-collapse:collapse}
th{position:sticky;top:0;background:#1d2026;text-align:left;font-weight:600;font-size:11px;color:#8b93a1;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid #2c3038}
td{padding:5px 8px;border-bottom:1px solid #22252b;vertical-align:middle}
tr.cam{cursor:pointer}
tr.cam:hover td{background:#1b1e23}
.n{text-align:right;font-variant-numeric:tabular-nums}
.nome{font-weight:650}
.pri{font-size:11px;color:#8b93a1}
.tag{display:inline-block;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap;margin:1px 0}
.tag.verde{background:rgba(76,194,127,.15);color:#4cc27f}
.tag.vermelho{background:rgba(255,107,107,.15);color:#ff6b6b}
.tag.amarelo{background:rgba(245,192,74,.15);color:#f5c04a}
.tag.laranja{background:rgba(255,150,70,.18);color:#ff9a4d}
.tag.cinza{background:rgba(139,147,161,.18);color:#aab1bd}
.tag.azul{background:rgba(59,110,245,.2);color:#8fb0ff}
.detalhe td{background:#101215;padding:0}
.detalhe table{font-size:12px}
.detalhe th{position:static;background:#101215}
.vazio{padding:16px;text-align:center;color:#8b93a1}
.log{margin:0;max-height:150px;overflow:auto;background:#0f1114;border:1px solid #2c3038;border-radius:8px;padding:8px;font:11px/1.45 ui-monospace,Consolas,monospace;color:#aab1bd;white-space:pre-wrap}
.pilula{position:fixed;right:14px;bottom:14px;z-index:2147483000;background:#3b6ef5;color:#fff;border:0;border-radius:999px;padding:9px 14px;box-shadow:0 6px 24px rgba(0,0,0,.45)}
`;

  const HTML = `
<div class="painel">
  <div class="topo">
    <div class="titulo"><b>SLC PreOp · <span data-campo="modo"></span></b><span class="versao">v${VERSAO}</span></div>
    <div class="janela"><button data-acao="minimizar" title="Minimizar">–</button> <button data-acao="fechar" title="Fechar">×</button></div>
  </div>
  <div class="corpo">
    <div>
      <div class="barra" data-campo="barraBox"><i data-campo="barra"></i></div>
      <div class="status" data-campo="status"></div>
      <div class="etapa" data-campo="etapa"></div>
    </div>
    <div class="kpis">
      <div class="verde"><b data-campo="kImp">0</b><span>pedidos impressos</span></div>
      <div class="amarelo"><b data-campo="kRep">0</b><span>reimpressos 7d+</span></div>
      <div><b data-campo="kPend">0</b><span>pendentes ignorados</span></div>
      <div class="vermelho"><b data-campo="kErro">0</b><span>caminhões com erro</span></div>
    </div>
    <div class="acoes">
      <button class="perigo" data-acao="parar">⏹ Parar</button>
      <button class="copiar" data-acao="copiarTsv">📋 <span data-campo="copiarTxt">Copiar para Impressos V2</span></button>
      <button data-acao="rodar" title="Rodar de novo">↻ Rodar de novo</button>
    </div>
    <button class="capas" data-acao="capas" hidden>🖨️ Imprimir capas (<span data-campo="nCapas">0</span> caminhões)</button>
    <details data-campo="detalhes">
      <summary>Caminhões (<span data-campo="nCam">0</span>) e mais opções</summary>
      <div class="mais">
        <div class="tabela">
          <table>
            <thead><tr><th>Caminhão</th><th class="n">Pedidos</th><th class="n">Impr. agora</th><th>Situação</th></tr></thead>
            <tbody data-campo="linhas"></tbody>
          </table>
          <div class="vazio" data-campo="vazio">Os caminhões aparecem aqui conforme são lidos.</div>
        </div>
        <div class="botoes">
          <button data-acao="copiarCapa" hidden>📋 Copiar para a planilha da capa</button>
          <button data-acao="copiarResumo">📊 Copiar resumo</button>
          <button data-acao="relatorio">⬇️ Relatório CSV</button>
          <button data-acao="diagnostico">🩺 Diagnóstico</button>
          <button data-acao="log">📜 Log</button>
        </div>
        <pre class="log" data-campo="log" hidden></pre>
      </div>
    </details>
  </div>
</div>
<button class="pilula" data-acao="restaurar" hidden>🖨️ SLC PreOp · <span data-campo="pilula"></span></button>`;

  const host = document.createElement("div");
  host.id = "slc-preop-v2";
  const raiz = host.attachShadow({ mode: "open" });
  raiz.innerHTML = `<style>${CSS}</style>${HTML}`;
  document.body.appendChild(host);

  const q = (s) => raiz.querySelector(s);
  const campo = (n) => raiz.querySelector(`[data-campo="${n}"]`);
  const esc = escHtml;

  function tagsGrupo(g) {
    const t = [];
    if (g.erro) t.push(`<span class="tag laranja" title="${esc(g.erro)}">⚠️ Erro: ${esc(g.erro)}</span>`);
    if (g.naoConfirmados.length) t.push(`<span class="tag vermelho" title="${esc(g.naoConfirmados.join(", "))}">${g.naoConfirmados.length} não confirmado(s)</span>`);
    if (g.fora) t.push(`<span class="tag cinza">Fora da fila</span>`);
    else if (!g.erro) {
      const s = SITUACOES[g.resumo.situacao];
      t.push(`<span class="tag ${s.cor}">${s.rotulo}</span>`);
    }
    if (g.simulados) t.push(`<span class="tag azul">${g.simulados} na simulação</span>`);
    return t.join(" ");
  }

  function linhaDetalhe(g) {
    const ped = [...g.pedidos.values()].sort((a, b) => compararNatural(a.pedido, b.pedido));
    const cor = { NAO_IMPRESSO: "vermelho", REIMPRIMIR: "amarelo", IMPRESSO: "verde", PENDENTE: "cinza", DATA_INVALIDA: "laranja" };
    return `<tr class="detalhe"><td colspan="4"><table>
      <thead><tr><th>Pedido</th><th>Data Impressão</th><th>Situação</th></tr></thead>
      <tbody>${ped.map((p) => `<tr><td>${esc(p.pedido)}</td><td>${esc(p.impressao)}</td><td><span class="tag ${cor[p.classe]}">${CLASSES[p.classe]}</span></td></tr>`).join("")}</tbody>
    </table></td></tr>`;
  }

  let renderAgendado = false;
  function agendarRender() {
    if (renderAgendado) return;
    renderAgendado = true;
    (window.requestAnimationFrame || setTimeout)(() => {
      renderAgendado = false;
      render();
    });
  }

  function render() {
    const grupos = ordenarGrupos([...estado.grupos.values()]);
    const rodando = !!estado.rodando;
    campo("modo").textContent = modoNome();

    const pr = estado.progresso;
    const pct = pr.total ? Math.min(100, Math.round((pr.feito / pr.total) * 100)) : rodando ? 0 : 100;
    campo("barra").style.width = pct + "%";
    campo("barraBox").classList.toggle("ok", !rodando);
    campo("status").textContent = estado.status;
    let etapa = "";
    if (rodando) {
      etapa = estado.rodando === "mapear" ? "Etapa 1 de 2 · lendo caminhões" : `Etapa 2 de 2 · ${CONFIG.simulacao ? "simulando" : "imprimindo"}`;
      if (pr.total) etapa += ` · ${pr.feito}/${pr.total}`;
      if (pr.feito > 0 && pr.total > pr.feito) {
        const s = Math.round((((Date.now() - pr.inicio) / pr.feito) * (pr.total - pr.feito)) / 1000);
        etapa += ` · faltam ~${s >= 60 ? Math.round(s / 60) + " min" : s + " s"}`;
      }
    }
    campo("etapa").textContent = etapa;

    campo("kImp").textContent = estado.registros.length;
    campo("kRep").textContent = estado.registros.filter((x) => x.reimpressao).length;
    campo("kPend").textContent = grupos.reduce((s, g) => s + g.resumo.pendente, 0);
    campo("kErro").textContent = grupos.filter((g) => g.erro).length;

    q('[data-acao="parar"]').hidden = !rodando;
    q('[data-acao="rodar"]').hidden = rodando;
    const regs = registrosParaCopiar();
    campo("copiarTxt").textContent =
      !estado.registros.length && estado.anterior
        ? `Copiar última impressão (${hora(estado.anterior.quando)}, ${regs.length})`
        : `Copiar para Impressos V2 (${regs.length})`;
    q('[data-acao="copiarTsv"]').disabled = !regs.length;
    const nCapas = rodando ? 0 : capasDisponiveis().length;
    q('[data-acao="capas"]').hidden = !nCapas;
    campo("nCapas").textContent = nCapas;
    q('[data-acao="copiarCapa"]').hidden = !nCapas;

    campo("nCam").textContent = grupos.length;
    if (campo("detalhes").open) {
      campo("linhas").innerHTML = grupos
        .map((g) => {
          const aberto = estado.abertos.has(g.id);
          return `<tr class="cam" data-id="${esc(g.id)}">
          <td><div class="nome">${aberto ? "▾" : "▸"} ${esc(g.nome)}</div><div class="pri">${esc(g.prioridade.grupo)} · ${esc(g.prioridade.tipo)}</div></td>
          <td class="n">${g.resumo.total}</td><td class="n">${g.impressosAgora || ""}</td><td>${tagsGrupo(g)}</td>
        </tr>${aberto ? linhaDetalhe(g) : ""}`;
        })
        .join("");
      campo("vazio").hidden = grupos.length > 0;
    }
    const logEl = campo("log");
    if (!logEl.hidden) {
      logEl.textContent = estado.logs.join("\n");
      logEl.scrollTop = logEl.scrollHeight;
    }
    campo("pilula").textContent = rodando ? `${pct}%` : modoNome();
  }

  function minimizar(sim) {
    q(".painel").hidden = sim;
    q(".pilula").hidden = !sim;
  }

  function fechar() {
    if (estado.rodando && !confirm("O SLC PreOp está rodando. Fechar mesmo assim? (ele para depois do caminhão atual)")) return;
    estado.parar = true;
    host.remove();
    delete window.__SLC_PREOP__;
  }

  raiz.addEventListener("click", (e) => {
    const acao = e.target.closest("[data-acao]");
    if (acao) {
      const a = acao.dataset.acao;
      if (a === "parar") {
        estado.parar = true;
        setStatus("Parando depois do caminhão atual…");
      } else if (a === "rodar") executar();
      else if (a === "capas") imprimirCapas();
      else if (a === "copiarCapa") copiarParaPlanilhaCapa();
      else if (a === "copiarTsv") copiarRegistros();
      else if (a === "copiarResumo") copiarResumo();
      else if (a === "relatorio") baixarRelatorio();
      else if (a === "diagnostico") diagnostico();
      else if (a === "log") {
        campo("log").hidden = !campo("log").hidden;
        agendarRender();
      } else if (a === "minimizar") minimizar(true);
      else if (a === "restaurar") minimizar(false);
      else if (a === "fechar") fechar();
      return;
    }
    const linha = e.target.closest("tr.cam");
    if (linha) {
      const id = linha.dataset.id;
      estado.abertos.has(id) ? estado.abertos.delete(id) : estado.abertos.add(id);
      agendarRender();
    }
  });
  campo("detalhes").addEventListener("toggle", agendarRender);

  // Arrastar o painel pelo topo.
  q(".topo").addEventListener("mousedown", (e) => {
    if (e.target.closest("button")) return;
    const p = q(".painel");
    const r = p.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    const mover = (ev) => {
      p.style.left = Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - dx)) + "px";
      p.style.top = Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy)) + "px";
      p.style.right = "auto";
      p.style.bottom = "auto";
    };
    const soltar = () => {
      document.removeEventListener("mousemove", mover);
      document.removeEventListener("mouseup", soltar);
    };
    document.addEventListener("mousemove", mover);
    document.addEventListener("mouseup", soltar);
    e.preventDefault();
  });

  // Clicar no favorito de novo: reabre o painel e, se não estiver rodando, roda de novo (como na v1).
  window.__SLC_PREOP__ = {
    versao: VERSAO,
    host,
    estado,
    mostrar(modo) {
      minimizar(false);
      if (estado.rodando) return;
      if (modo && CONFIG.modos[modo]) estado.modo = modo;
      executar();
    },
  };

  restaurarExecucao();
  log(`SLC PreOp v${VERSAO} aberto (${modoNome()}${CONFIG.simulacao ? ", SIMULAÇÃO" : ""}).`);
  render();
  executar();
})();
}
