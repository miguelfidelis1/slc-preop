/*
 * ARQUIVO GERADO — não edite. Edite src/slc-preop.js e rode `npm run build`.
 * SLC PreOp KDABRA — abre já no modo Mercearia.
 */
{
const SLC_PREOP_MODO = "mercearia";
/*
 * SLC PreOp KDABRA — v2
 *
 * Painel para o KDABRA Checkout que:
 *   1. mapeia TODOS os caminhões (lidos direto da tela, sem lista fixa);
 *   2. mostra quais estão impressos, quais faltam e quais têm reimpressão 7d+;
 *   3. imprime os caminhões escolhidos na ordem de prioridade;
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
    // Como descobrir os caminhões:
    //   "auto"          → usa Leva = Todos se existir (1 busca por caminhão),
    //                     senão busca cada combinação caminhão × leva.
    //   "porCaminhao"   → 1 busca por caminhão com Leva = Todos.
    //   "porCombinacao" → 1 busca por combinação caminhão × leva.
    //   "tudo"          → 1 busca só, com Caminhão = Todos e Leva = Todos.
    varredura: "auto",
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
    ["reprintDias", "conferirAposImprimir", "varredura"].forEach((k) => {
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
    { grupo: "MAX", tipo: "100H–124H", se: (c) => c.leva === "H" && entre(c.num, 100, 124) },
    { grupo: "MAX", tipo: "299 demais", se: (c) => c.num === "299" },
    { grupo: "A", tipo: "RA / RH / HA", nomes: ["RA", "RH", "HA"] },
    { grupo: "A", tipo: "150–154 KA", se: (c) => c.leva === "KA" && entre(c.num, 150, 154) },
    { grupo: "A", tipo: "Original A (1–60)", se: (c) => c.leva === "A" && entre(c.num, 1, 60) },
    { grupo: "A", tipo: "200A / 200H", se: (c) => ["A", "H"].includes(c.leva) && entre(c.num, 200, 210) },
    { grupo: "A", tipo: "300A / 300H", se: (c) => ["A", "H"].includes(c.leva) && entre(c.num, 300, 310) },
    { grupo: "A", tipo: "Novo · leva A/H/KA", se: (c) => ["A", "H", "KA"].includes(c.leva) },
    { grupo: "B", tipo: "RB / HB / 150KB", nomes: ["RB", "HB", "150KB"] },
    { grupo: "B", tipo: "Original B (1–60)", se: (c) => c.leva === "B" && entre(c.num, 1, 60) },
    { grupo: "B", tipo: "100B", nomes: ["100B"] },
    { grupo: "B", tipo: "Leva noturna NC", se: (c) => c.leva === "NC" && entre(c.num, 180, 184) },
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

  const csv = (linhas) =>
    linhas.map((l) => l.map((v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(";")).join("\r\n");

  const LOGICA = {
    VERSAO, CONFIG, PRIORIDADES, foraDaFila, norm, chave, parseData, diasDesde, classificarPedido,
    identificar, prioridade, ordenarGrupos, resumir, detectarColunas, tsv, csv, dataBR,
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

  function linhasTabela() {
    try {
      const jq = window.jQuery;
      if (jq && jq.fn.DataTable && jq.fn.DataTable.isDataTable(S.tabela))
        return jq(S.tabela).DataTable().rows({ search: "applied" }).nodes().toArray();
    } catch (e) {}
    return [...document.querySelectorAll(S.linhas)];
  }

  const cabecalhos = () => [...document.querySelectorAll(S.tabela + " thead th")].map((th) => th.textContent || "");

  function lerTabela() {
    const col = detectarColunas(cabecalhos());
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
    selecionar(E.caminhao, consulta.caminhao.value);
    await sleep(T.aposSelecionar);
    if (consulta.leva) {
      // A lista de levas pode recarregar depois de trocar o caminhão.
      await esperarOpcao(E.leva, consulta.leva.value);
      selecionar(E.leva, consulta.leva.value);
      await sleep(T.aposSelecionar);
    }
    const todos = lerOpcoes(E.impresso).todos;
    selecionar(E.impresso, todos ? todos.value : "0");
    desligarItens();
    E.buscar.disabled = false;
    const obs = observarTabela();
    E.buscar.click();
    const r = await esperarTabela(antes, obs);
    await sleep(T.estabilizar);
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
    simulacao: false,
    grupos: new Map(),
    estrategia: null,
    mapeadoEm: null,
    registros: [], // pedidos impressos nesta execução (vão para o TSV)
    execucao: null, // { modo, quando }
    impressosNaExecucao: new Set(),
    filtro: "todos",
    busca: "",
    abertos: new Set(),
    progresso: { feito: 0, total: 0, inicio: 0 },
    status: "Pronto. Clique em “Mapear caminhões”.",
    logs: [],
  };

  function salvarExecucao() {
    try {
      localStorage.setItem(CHAVE_STORAGE, JSON.stringify({ ...estado.execucao, registros: estado.registros }));
    } catch (e) {}
  }

  function restaurarExecucao() {
    try {
      const x = JSON.parse(localStorage.getItem(CHAVE_STORAGE) || "null");
      if (!x || !Array.isArray(x.registros) || !x.registros.length) return;
      if (dataBR(new Date(x.quando)) !== dataBR(new Date())) return;
      estado.registros = x.registros;
      estado.execucao = { modo: x.modo, quando: x.quando };
      const hora = new Date(x.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      estado.status = `Última impressão (${hora}, ${CONFIG.modos[x.modo] ? CONFIG.modos[x.modo].nome : x.modo}) tem ${x.registros.length} pedidos guardados — use “Copiar para Impressos V2”.`;
    } catch (e) {}
  }

  function log(msg) {
    const hora = new Date().toLocaleTimeString("pt-BR");
    estado.logs.push(hora + "  " + msg);
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
        selecionado: false,
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

  function atualizarPedidos(g, pedidos) {
    g.pedidos = new Map(pedidos.map((p) => [chave(p.pedido), semRow(p)]));
    g.resumo = resumir(g.pedidos.values());
  }

  // Na impressão, só considera linhas cuja coluna Caminhão bate com o que foi
  // visto no mapeamento — protege contra a tabela de outro caminhão.
  const doGrupo = (g, pedidos) => (g.valoresColuna.size ? pedidos.filter((p) => g.valoresColuna.has(chave(p.caminhao))) : pedidos);

  function iniciar(tipo, total) {
    estado.rodando = tipo;
    estado.parar = false;
    estado.progresso = { feito: 0, total, inicio: Date.now() };
    agendarRender();
  }

  function terminar(msg) {
    estado.rodando = null;
    estado.parar = false;
    setStatus(msg);
    log(msg);
  }

  // ============================================================
  // MAPEAR — descobre todos os caminhões e a situação de cada um
  // ============================================================
  async function mapear() {
    if (estado.rodando) return;
    iniciar("mapear", 0);
    try {
      setStatus("Ativando " + CONFIG.modos[estado.modo].nome + "…");
      await ativarModo(estado.modo);
      const E = elementos();
      if (E.faltando.length) throw new Error("Não achei na tela: " + E.faltando.join(", ") + ". Confere se está no Checkout (ou use Diagnóstico).");

      const cams = lerOpcoes(E.caminhao);
      const levas = lerOpcoes(E.leva);
      let estrategia = CONFIG.varredura;
      if (estrategia === "auto") estrategia = levas.todos ? "porCaminhao" : "porCombinacao";
      if (estrategia === "porCaminhao" && !levas.todos) estrategia = "porCombinacao";
      if (estrategia === "tudo" && !(cams.todos && levas.todos)) estrategia = levas.todos ? "porCaminhao" : "porCombinacao";

      const info = { nums: cams.lista.map((o) => o.text), levas: levas.lista.map((o) => o.text) };
      estado.grupos = new Map();
      estado.abertos.clear();
      estado.estrategia = estrategia;
      log(`Mapeando ${CONFIG.modos[estado.modo].nome}: ${cams.lista.length} caminhões e ${levas.lista.length} levas no filtro (estratégia: ${estrategia}).`);

      const consultas = [];
      if (estrategia === "tudo") consultas.push({ caminhao: cams.todos, leva: levas.todos });
      else if (estrategia === "porCaminhao") cams.lista.forEach((c) => consultas.push({ caminhao: c, leva: levas.todos }));
      else cams.lista.forEach((c) => consultas.push({ caminhao: c, leva: null })); // levas expandidas abaixo

      estado.progresso.total = consultas.length;
      let ultimaId = null;
      for (const base of consultas) {
        if (estado.parar) break;
        const subconsultas = [];
        if (estrategia === "porCombinacao") {
          // Lê as levas depois de escolher o caminhão (a lista pode ser filtrada pelo sistema).
          selecionar(E.caminhao, base.caminhao.value);
          await sleep(T.aposSelecionar + T.intervalo);
          lerOpcoes(elementos().leva).lista.forEach((l) => subconsultas.push({ caminhao: base.caminhao, leva: l }));
        } else subconsultas.push(base);

        for (const c of subconsultas) {
          if (estado.parar) break;
          const rotulo = estrategia === "porCombinacao" ? c.caminhao.text + c.leva.text : c.caminhao.text;
          setStatus(`Mapeando ${rotulo}…`);
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
            if (!r.mudou && r.pedidos.length) {
              log(`${rotulo}: tabela não atualizou — pulado para não misturar caminhões.`);
              continue;
            }
            if (!r.pedidos.length) continue;
            const g = grupoPara(chave(c.caminhao.text + c.leva.text), { ...info, nome: c.caminhao.text + c.leva.text, consulta: c });
            r.pedidos.forEach((p) => g.valoresColuna.add(chave(p.caminhao)));
            atualizarPedidos(g, r.pedidos);
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
              const consulta = levaOp && camOp ? { caminhao: camOp, leva: levaOp } : c;
              const g = grupoPara(id2, { ...info, nome, consulta });
              g.valoresColuna.add(id2);
              const juntos = new Map(g.pedidos);
              lista.forEach((p) => juntos.set(chave(p.pedido), semRow(p)));
              g.pedidos = juntos;
              g.resumo = resumir(juntos.values());
            }
          }
        }
        estado.progresso.feito++;
        agendarRender();
      }

      for (const g of estado.grupos.values()) g.selecionado = g.resumo.aImprimir > 0 && !g.fora;
      estado.mapeadoEm = new Date();
      const lista = [...estado.grupos.values()];
      const faltam = lista.filter((g) => g.resumo.aImprimir > 0 && !g.fora);
      const pedidos = faltam.reduce((s, g) => s + g.resumo.aImprimir, 0);
      terminar(
        (estado.parar ? "Mapeamento interrompido. " : "Mapeamento concluído. ") +
          `${lista.length} caminhões com pedidos · ${faltam.length} com pedidos a imprimir (${pedidos} pedidos).`
      );
    } catch (e) {
      terminar("Erro no mapeamento: " + e.message);
      alert("SLC PreOp: " + e.message);
    }
  }

  // ============================================================
  // IMPRIMIR — na ordem de prioridade, só os caminhões selecionados
  // ============================================================
  async function imprimir() {
    if (estado.rodando) return;
    const alvo = ordenarGrupos([...estado.grupos.values()]).filter((g) => g.selecionado);
    if (!alvo.length) {
      alert("Nenhum caminhão selecionado. Mapeie e marque os caminhões que quer imprimir.");
      return;
    }
    const sim = estado.simulacao;
    const total = alvo.reduce((s, g) => s + g.resumo.aImprimir, 0);
    const modoNome = CONFIG.modos[estado.modo].nome;
    if (!sim && !confirm(`Imprimir ${modoNome}: ${alvo.length} caminhões, cerca de ${total} pedidos.\n\nContinuar?`)) return;

    iniciar("imprimir", alvo.length);
    for (const g of estado.grupos.values()) {
      g.simulados = 0;
      if (!sim) g.impressosAgora = 0;
    }
    if (!sim) {
      estado.registros = [];
      estado.impressosNaExecucao = new Set();
      estado.execucao = { modo: estado.modo, quando: new Date().toISOString() };
      salvarExecucao();
    }
    let simulados = 0;
    let falhas = 0;
    try {
      await ativarModo(estado.modo);
      let ultimaId = null;
      for (const g of alvo) {
        if (estado.parar) break;
        g.erro = null;
        g.naoConfirmados = [];
        setStatus(`${sim ? "Simulando" : "Imprimindo"} ${g.nome} (${g.prioridade.grupo} · ${g.prioridade.tipo})…`);
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
          const semMarca = imprimiveis.length - marcados.length;
          if (semMarca) log(`${g.nome}: ${semMarca} pedido(s) sem checkbox — não impressos.`);
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
            log(`${g.nome}: SIMULAÇÃO — ${marcados.length} pedido(s) seriam impressos: ${marcados.map((p) => p.pedido).join(", ")}`);
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
            estado.registros.push({ caminhao: p.caminhao, rota: p.rota, pedido: p.pedido, entrega: p.entrega, impressao: hoje, grupo: g.nome, reimpressao: p.classe === "REIMPRIMIR" });
          }
          g.impressosAgora += marcados.length;
          salvarExecucao();
          copiar(tsv(estado.registros)).catch(() => {});
          log(`${g.nome}: ${marcados.length} pedido(s) enviados para impressão.`);

          if (CONFIG.conferirAposImprimir && !estado.parar) {
            setStatus(`Conferindo ${g.nome}…`);
            const r2 = await buscar(g.consulta);
            const depois = new Map(doGrupo(g, r2.pedidos).map((p) => [chave(p.pedido), p]));
            g.naoConfirmados = marcados.filter((p) => {
              const q = depois.get(chave(p.pedido));
              return !q || q.classe !== "IMPRESSO";
            }).map((p) => p.pedido);
            if (r2.ok) atualizarPedidos(g, [...depois.values()]);
            if (g.naoConfirmados.length) {
              falhas += g.naoConfirmados.length;
              log(`${g.nome}: ATENÇÃO — ${g.naoConfirmados.length} pedido(s) não aparecem como impressos: ${g.naoConfirmados.join(", ")}`);
            }
          }
          g.selecionado = g.resumo.aImprimir > 0;
        } catch (e) {
          g.erro = e.message;
          log(`${g.nome}: ERRO — ${e.message}`);
        } finally {
          estado.progresso.feito++;
          agendarRender();
        }
      }
    } catch (e) {
      log("Erro geral: " + e.message);
    }

    if (sim) {
      terminar(`Simulação ${estado.parar ? "interrompida" : "concluída"}: ${simulados} pedidos seriam impressos. Nada foi impresso.`);
      return;
    }
    const n = estado.registros.length;
    const rep = estado.registros.filter((x) => x.reimpressao).length;
    const copiou = n ? await copiar(tsv(estado.registros)) : false;
    const erros = alvo.filter((g) => g.erro).length;
    terminar(
      `${estado.parar ? "Parado" : "Finalizado"}: ${n} pedidos impressos (${rep} reimpressões 7d+)` +
        (erros ? ` · ${erros} caminhão(ões) com erro` : "") +
        (falhas ? ` · ${falhas} não confirmados` : "") +
        (n ? (copiou ? " · copiado, cole na Impressos V2 (Ctrl+V)." : " · clique em “Copiar para Impressos V2”.") : ".")
    );
    alert(
      `${estado.parar ? "⏹️ Parado" : "✅ Finalizado"} — ${modoNome}\n\n` +
        `Pedidos impressos: ${n}\nReimpressões 7d+: ${rep}\n` +
        (erros ? `Caminhões com erro: ${erros} (veja o painel)\n` : "") +
        (falhas ? `Pedidos NÃO confirmados: ${falhas} (veja o painel)\n` : "") +
        (n ? (copiou ? "\nJá está copiado: abra a Impressos V2 e aperte Ctrl+V." : "\nClique em “Copiar para Impressos V2” no painel.") : "")
    );
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

  async function copiarRegistros() {
    if (!estado.registros.length) return setStatus("Nenhum pedido impresso para copiar ainda.");
    const ok = await copiar(tsv(estado.registros));
    setStatus(ok ? `${estado.registros.length} pedidos copiados — cole na Impressos V2 (Ctrl+V).` : "Não consegui copiar. Tente de novo.");
  }

  async function copiarResumo() {
    const lista = ordenarGrupos([...estado.grupos.values()]);
    if (!lista.length) return setStatus("Mapeie os caminhões primeiro.");
    const linhas = [["Caminhão", "Prioridade", "Pedidos", "A imprimir", "Reimprimir 7d+", "Impressos", "Pendentes", "Situação"]];
    lista.forEach((g) => linhas.push([g.nome, g.prioridade.grupo + " · " + g.prioridade.tipo, g.resumo.total, g.resumo.aImprimir, g.resumo.reimprimir, g.resumo.impresso, g.resumo.pendente, situacaoTexto(g)]));
    const ok = await copiar(linhas.map((l) => l.map(limpar).join("\t")).join("\n"));
    setStatus(ok ? "Resumo por caminhão copiado (cole em uma planilha)." : "Não consegui copiar.");
  }

  function baixarRelatorio() {
    const lista = ordenarGrupos([...estado.grupos.values()]);
    if (!lista.length) return setStatus("Mapeie os caminhões primeiro.");
    const linhas = [["Modo", "Caminhão", "Prioridade", "Situação do caminhão", "Rota", "Pedido", "Data Entrega", "Data Impressão", "Situação do pedido"]];
    for (const g of lista)
      for (const p of g.pedidos.values())
        linhas.push([CONFIG.modos[estado.modo].nome, g.nome, g.prioridade.grupo + " · " + g.prioridade.tipo, situacaoTexto(g), p.rota, p.pedido, p.entrega, p.impressao, CLASSES[p.classe]]);
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
      amostra: linhasTabela().slice(0, 5).map((tr) => [...tr.children].map((td) => (caixaDaLinha(tr) && td.contains(caixaDaLinha(tr)) ? "[checkbox] " : "") + m(td.textContent))),
      estrategiaUsada: estado.estrategia,
    };
    const txt = JSON.stringify(r, null, 1);
    console.log(txt);
    const ok = await copiar(txt);
    setStatus(ok ? "Diagnóstico copiado (sem dados reais). Cole para quem está dando suporte." : "Diagnóstico no console (F12).");
  }

  // ============================================================
  // PAINEL
  // ============================================================
  const CSS = `
:host{all:initial}
[hidden]{display:none!important}
*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.painel{position:fixed;right:14px;bottom:14px;z-index:2147483000;width:min(640px,calc(100vw - 28px));max-height:calc(100vh - 28px);display:flex;flex-direction:column;background:#15171b;color:#e8eaed;border:1px solid #2c3038;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.55);font-size:13px;overflow:hidden}
.topo{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#1d2026;border-bottom:1px solid #2c3038;cursor:move;user-select:none}
.titulo{flex:1;display:flex;align-items:baseline;gap:6px;font-size:14px}
.versao{font-size:11px;color:#8b93a1}
button{font:inherit;color:inherit;background:#2a2e36;border:1px solid #3a3f49;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap}
button:hover:not(:disabled){background:#343944}
button:disabled{opacity:.45;cursor:not-allowed}
.modos{display:flex;border:1px solid #3a3f49;border-radius:9px;overflow:hidden}
.modos button{border:0;border-radius:0;padding:5px 12px;background:transparent}
.modos button.ativo{background:#3b6ef5;color:#fff}
.janela button{padding:3px 9px;margin-left:2px}
.corpo{display:flex;flex-direction:column;gap:10px;padding:12px;overflow:auto;min-height:0}
.acoes{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.primario{background:#3b6ef5;border-color:#3b6ef5;color:#fff}
.primario:hover:not(:disabled){background:#2f5fe0}
.imprimir{background:#1f8f4e;border-color:#1f8f4e;color:#fff}
.imprimir:hover:not(:disabled){background:#1a7a43}
.perigo{background:#c94040;border-color:#c94040;color:#fff}
.sim{display:flex;align-items:center;gap:6px;margin-left:auto;color:#c4c9d2;cursor:pointer}
.barra{height:6px;background:#2a2e36;border-radius:4px;overflow:hidden}
.barra i{display:block;height:100%;width:0;background:#3b6ef5;transition:width .3s}
.status{margin-top:6px;color:#c4c9d2;line-height:1.4}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.kpis div{background:#1d2026;border:1px solid #2c3038;border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:2px}
.kpis b{font-size:20px;font-weight:650}
.kpis span{font-size:11px;color:#8b93a1}
.kpis .verde b{color:#4cc27f}.kpis .vermelho b{color:#ff6b6b}.kpis .amarelo b{color:#f5c04a}
.filtros{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.chip{padding:4px 10px;border-radius:999px;font-size:12px}
.chip.ativo{background:#e8eaed;color:#15171b;border-color:#e8eaed}
input[type=search]{flex:1;min-width:120px;background:#0f1114;color:inherit;border:1px solid #3a3f49;border-radius:8px;padding:6px 9px;font:inherit}
.tabela{border:1px solid #2c3038;border-radius:10px;overflow:auto;max-height:42vh;min-height:90px}
table{width:100%;border-collapse:collapse}
th{position:sticky;top:0;background:#1d2026;text-align:left;font-weight:600;font-size:11px;color:#8b93a1;text-transform:uppercase;letter-spacing:.03em;padding:7px 8px;border-bottom:1px solid #2c3038}
td{padding:6px 8px;border-bottom:1px solid #22252b;vertical-align:middle}
tr.cam{cursor:pointer}
tr.cam:hover td{background:#1b1e23}
tr.cam.fora td{opacity:.6}
.n{text-align:right;font-variant-numeric:tabular-nums}
.nome{font-weight:650}
.pri{font-size:11px;color:#8b93a1}
.tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap}
.tag.verde{background:rgba(76,194,127,.15);color:#4cc27f}
.tag.vermelho{background:rgba(255,107,107,.15);color:#ff6b6b}
.tag.amarelo{background:rgba(245,192,74,.15);color:#f5c04a}
.tag.laranja{background:rgba(255,150,70,.18);color:#ff9a4d}
.tag.cinza{background:rgba(139,147,161,.18);color:#aab1bd}
.tag.azul{background:rgba(59,110,245,.2);color:#8fb0ff}
.detalhe td{background:#101215;padding:0}
.detalhe table{font-size:12px}
.detalhe td td,.detalhe th{padding:4px 8px}
.detalhe th{position:static;background:#101215}
.vazio{padding:22px;text-align:center;color:#8b93a1}
.rodape{display:flex;flex-wrap:wrap;gap:6px}
.log{margin:0;max-height:160px;overflow:auto;background:#0f1114;border:1px solid #2c3038;border-radius:8px;padding:8px;font:11px/1.45 ui-monospace,Consolas,monospace;color:#aab1bd;white-space:pre-wrap}
.pilula{position:fixed;right:14px;bottom:14px;z-index:2147483000;background:#3b6ef5;color:#fff;border:0;border-radius:999px;padding:9px 14px;box-shadow:0 6px 24px rgba(0,0,0,.45)}
@media (max-width:560px){.kpis{grid-template-columns:repeat(3,1fr)}.sim{margin-left:0}}
`;

  const HTML = `
<div class="painel" part="painel">
  <div class="topo">
    <div class="titulo"><b>SLC PreOp</b><span class="versao">v${VERSAO}</span></div>
    <div class="modos">${Object.entries(CONFIG.modos).map(([k, m]) => `<button data-modo="${k}">${m.nome}</button>`).join("")}</div>
    <div class="janela"><button data-acao="minimizar" title="Minimizar">–</button><button data-acao="fechar" title="Fechar">×</button></div>
  </div>
  <div class="corpo">
    <div class="acoes">
      <button class="primario" data-acao="mapear">🔍 Mapear caminhões</button>
      <button class="imprimir" data-acao="imprimir">🖨️ Imprimir selecionados (<span data-campo="nSel">0</span>)</button>
      <button class="perigo" data-acao="parar" hidden>⏹ Parar</button>
      <label class="sim" title="Marca os pedidos e confere, mas não clica em Finalizar"><input type="checkbox" data-campo="simulacao"> Simulação</label>
    </div>
    <div>
      <div class="barra"><i data-campo="barra"></i></div>
      <div class="status" data-campo="status"></div>
    </div>
    <div class="kpis">
      <div><b data-campo="kCam">–</b><span>caminhões</span></div>
      <div class="verde"><b data-campo="kOk">–</b><span>tudo impresso</span></div>
      <div class="vermelho"><b data-campo="kFalta">–</b><span>faltam imprimir</span></div>
      <div class="amarelo"><b data-campo="kPed">–</b><span data-campo="kPedSub">pedidos a imprimir</span></div>
      <div><b data-campo="kPend">–</b><span>pendentes</span></div>
    </div>
    <div class="filtros">
      <button class="chip" data-filtro="todos">Todos</button>
      <button class="chip" data-filtro="falta">Faltam imprimir</button>
      <button class="chip" data-filtro="ok">Impressos</button>
      <button class="chip" data-filtro="pend">Só pendentes</button>
      <button class="chip" data-filtro="fora">Fora da fila</button>
      <button class="chip" data-filtro="erro">Erros</button>
      <input type="search" placeholder="Buscar caminhão…" data-campo="busca">
    </div>
    <div class="tabela">
      <table>
        <thead><tr>
          <th><input type="checkbox" data-acao="selTodos" title="Selecionar os visíveis com pedidos a imprimir"></th>
          <th>Caminhão</th><th class="n">Pedidos</th><th class="n">A imprimir</th><th class="n">Impressos</th><th class="n">Pend.</th><th>Situação</th>
        </tr></thead>
        <tbody data-campo="linhas"></tbody>
      </table>
      <div class="vazio" data-campo="vazio">Nenhum caminhão mapeado ainda.</div>
    </div>
    <div class="rodape">
      <button data-acao="copiarTsv">📋 Copiar para Impressos V2 (<span data-campo="nReg">0</span>)</button>
      <button data-acao="copiarResumo">📊 Copiar resumo</button>
      <button data-acao="relatorio">⬇️ Relatório CSV</button>
      <button data-acao="diagnostico">🩺 Diagnóstico</button>
      <button data-acao="log">📜 Log</button>
    </div>
    <pre class="log" data-campo="log" hidden></pre>
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
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const FILTROS = {
    todos: () => true,
    falta: (g) => g.resumo.aImprimir > 0 && !g.fora,
    ok: (g) => g.resumo.situacao === "IMPRESSO",
    pend: (g) => g.resumo.situacao === "SO_PENDENTES",
    fora: (g) => g.fora,
    erro: (g) => g.erro || g.naoConfirmados.length,
  };

  const visiveis = () =>
    ordenarGrupos([...estado.grupos.values()]).filter(
      (g) => FILTROS[estado.filtro](g) && (!estado.busca || chave(g.nome).includes(chave(estado.busca)))
    );

  function tagsGrupo(g) {
    const t = [];
    if (g.erro) t.push(`<span class="tag laranja" title="${esc(g.erro)}">⚠️ Erro</span>`);
    if (g.naoConfirmados.length) t.push(`<span class="tag vermelho" title="${esc(g.naoConfirmados.join(", "))}">${g.naoConfirmados.length} não confirmado(s)</span>`);
    if (g.fora) t.push(`<span class="tag cinza">Fora da fila</span>`);
    else {
      const s = SITUACOES[g.resumo.situacao];
      t.push(`<span class="tag ${s.cor}">${s.rotulo}</span>`);
    }
    if (g.impressosAgora) t.push(`<span class="tag azul">+${g.impressosAgora} agora</span>`);
    if (g.simulados) t.push(`<span class="tag azul">${g.simulados} na simulação</span>`);
    return t.join(" ");
  }

  function linhaDetalhe(g) {
    const ped = [...g.pedidos.values()].sort((a, b) => IMPRIMIVEL.includes(b.classe) - IMPRIMIVEL.includes(a.classe) || compararNatural(a.pedido, b.pedido));
    const cor = { NAO_IMPRESSO: "vermelho", REIMPRIMIR: "amarelo", IMPRESSO: "verde", PENDENTE: "cinza", DATA_INVALIDA: "laranja" };
    return `<tr class="detalhe"><td colspan="7"><table>
      <thead><tr><th>Pedido</th><th>Rota</th><th>Data Entrega</th><th>Data Impressão</th><th>Situação</th></tr></thead>
      <tbody>${ped.map((p) => `<tr><td>${esc(p.pedido)}</td><td>${esc(p.rota)}</td><td>${esc(p.entrega)}</td><td>${esc(p.impressao)}</td><td><span class="tag ${cor[p.classe]}">${CLASSES[p.classe]}</span></td></tr>`).join("")}</tbody>
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
    const grupos = [...estado.grupos.values()];
    const ativos = grupos.filter((g) => !g.fora);
    const rodando = !!estado.rodando;

    raiz.querySelectorAll("[data-modo]").forEach((b) => {
      b.classList.toggle("ativo", b.dataset.modo === estado.modo);
      b.disabled = rodando;
    });
    raiz.querySelectorAll("[data-filtro]").forEach((b) => b.classList.toggle("ativo", b.dataset.filtro === estado.filtro));
    q('[data-acao="mapear"]').disabled = rodando;
    const sel = grupos.filter((g) => g.selecionado);
    q('[data-acao="imprimir"]').disabled = rodando || !sel.length;
    q('[data-acao="imprimir"]').firstChild.textContent = estado.simulacao ? "🧪 Simular selecionados (" : "🖨️ Imprimir selecionados (";
    q('[data-acao="parar"]').hidden = !rodando;
    campo("simulacao").checked = estado.simulacao;
    campo("simulacao").disabled = rodando;
    campo("nSel").textContent = sel.length;
    campo("nReg").textContent = estado.registros.length;

    const pr = estado.progresso;
    const pct = pr.total ? Math.min(100, Math.round((pr.feito / pr.total) * 100)) : rodando ? 0 : grupos.length ? 100 : 0;
    campo("barra").style.width = pct + "%";
    let eta = "";
    if (rodando && pr.feito > 0 && pr.total > pr.feito) {
      const s = Math.round((((Date.now() - pr.inicio) / pr.feito) * (pr.total - pr.feito)) / 1000);
      eta = ` · ${pr.feito}/${pr.total} · faltam ~${s >= 60 ? Math.round(s / 60) + " min" : s + " s"}`;
    } else if (rodando && pr.total) eta = ` · ${pr.feito}/${pr.total}`;
    campo("status").textContent = estado.status + eta;

    const soma = (k) => ativos.reduce((s, g) => s + g.resumo[k], 0);
    const m = grupos.length > 0;
    campo("kCam").textContent = m ? grupos.length : "–";
    campo("kOk").textContent = m ? ativos.filter((g) => g.resumo.situacao === "IMPRESSO").length : "–";
    campo("kFalta").textContent = m ? ativos.filter((g) => g.resumo.aImprimir > 0).length : "–";
    campo("kPed").textContent = m ? soma("aImprimir") : "–";
    campo("kPedSub").textContent = m && soma("reimprimir") ? `a imprimir (${soma("reimprimir")} reimpr.)` : "pedidos a imprimir";
    campo("kPend").textContent = m ? soma("pendente") : "–";

    const lista = visiveis();
    campo("linhas").innerHTML = lista
      .map((g) => {
        const r = g.resumo;
        const aberto = estado.abertos.has(g.id);
        return `<tr class="cam${g.fora ? " fora" : ""}" data-id="${esc(g.id)}">
          <td><input type="checkbox" data-sel="${esc(g.id)}" ${g.selecionado ? "checked" : ""} ${r.aImprimir && !rodando ? "" : "disabled"}></td>
          <td><div class="nome">${aberto ? "▾" : "▸"} ${esc(g.nome)}</div><div class="pri">${esc(g.prioridade.grupo)} · ${esc(g.prioridade.tipo)}</div></td>
          <td class="n">${r.total}</td><td class="n">${r.aImprimir ? `<b>${r.aImprimir}</b>` : 0}${r.reimprimir ? ` <span class="pri">(${r.reimprimir} 7d+)</span>` : ""}</td>
          <td class="n">${r.impresso}</td><td class="n">${r.pendente}</td><td>${tagsGrupo(g)}</td>
        </tr>${aberto ? linhaDetalhe(g) : ""}`;
      })
      .join("");
    campo("vazio").hidden = lista.length > 0;
    campo("vazio").textContent = grupos.length ? "Nenhum caminhão neste filtro." : "Nenhum caminhão mapeado ainda. Clique em “Mapear caminhões”.";
    const elegiveis = lista.filter((g) => g.resumo.aImprimir > 0);
    const selTodos = q('[data-acao="selTodos"]');
    selTodos.checked = elegiveis.length > 0 && elegiveis.every((g) => g.selecionado);
    selTodos.disabled = rodando || !elegiveis.length;

    const logEl = campo("log");
    if (!logEl.hidden) {
      logEl.textContent = estado.logs.join("\n");
      logEl.scrollTop = logEl.scrollHeight;
    }
    campo("pilula").textContent = rodando ? `${estado.rodando === "mapear" ? "mapeando" : "imprimindo"} ${pct}%` : CONFIG.modos[estado.modo].nome;
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
    const alvo = e.target;
    const modo = alvo.closest("[data-modo]");
    if (modo && !estado.rodando && modo.dataset.modo !== estado.modo) {
      estado.modo = modo.dataset.modo;
      estado.grupos = new Map();
      setStatus(`Modo ${CONFIG.modos[estado.modo].nome}. Clique em “Mapear caminhões”.`);
      return;
    }
    const filtro = alvo.closest("[data-filtro]");
    if (filtro) {
      estado.filtro = filtro.dataset.filtro;
      return agendarRender();
    }
    if (alvo.matches("[data-sel]")) {
      const g = estado.grupos.get(alvo.dataset.sel);
      if (g) g.selecionado = alvo.checked;
      return agendarRender();
    }
    const acao = alvo.closest("[data-acao]");
    if (acao) {
      const a = acao.dataset.acao;
      if (a === "mapear") mapear();
      else if (a === "imprimir") imprimir();
      else if (a === "parar") {
        estado.parar = true;
        setStatus("Parando depois do caminhão atual…");
      } else if (a === "copiarTsv") copiarRegistros();
      else if (a === "copiarResumo") copiarResumo();
      else if (a === "relatorio") baixarRelatorio();
      else if (a === "diagnostico") diagnostico();
      else if (a === "log") {
        campo("log").hidden = !campo("log").hidden;
        agendarRender();
      } else if (a === "minimizar") minimizar(true);
      else if (a === "restaurar") minimizar(false);
      else if (a === "fechar") fechar();
      else if (a === "selTodos") {
        visiveis().filter((g) => g.resumo.aImprimir > 0).forEach((g) => (g.selecionado = alvo.checked));
        agendarRender();
      }
      return;
    }
    const linha = alvo.closest("tr.cam");
    if (linha) {
      const id = linha.dataset.id;
      estado.abertos.has(id) ? estado.abertos.delete(id) : estado.abertos.add(id);
      agendarRender();
    }
  });

  raiz.addEventListener("change", (e) => {
    if (e.target === campo("simulacao")) {
      estado.simulacao = e.target.checked;
      agendarRender();
    }
  });
  campo("busca").addEventListener("input", (e) => {
    estado.busca = e.target.value;
    agendarRender();
  });

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

  window.__SLC_PREOP__ = {
    versao: VERSAO,
    host,
    estado,
    mostrar(modo) {
      minimizar(false);
      if (modo && CONFIG.modos[modo] && !estado.rodando && modo !== estado.modo) {
        estado.modo = modo;
        estado.grupos = new Map();
        setStatus(`Modo ${CONFIG.modos[modo].nome}. Clique em “Mapear caminhões”.`);
      }
    },
  };

  restaurarExecucao();
  const faltando = elementos().faltando;
  if (faltando.length) {
    estado.status = "Não achei os filtros do KDABRA nesta tela (" + faltando.join(", ") + "). Abra o Checkout ou use 🩺 Diagnóstico.";
  }
  log(`SLC PreOp v${VERSAO} aberto (${CONFIG.modos[estado.modo].nome}).`);
  render();
})();
}
