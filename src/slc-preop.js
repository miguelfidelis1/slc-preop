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
    ["reprintDias", "conferirAposImprimir", "varredura", "simulacao", "levasPorCaminhao"].forEach((k) => {
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
    { grupo: "MAX", tipo: "100HA–124HA", se: (c) => ["H", "HA"].includes(c.leva) && entre(c.num, 100, 124) },
    { grupo: "MAX", tipo: "299 demais (B…Z, depois AA…AI)", se: (c) => c.num === "299" },
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

  const csv = (linhas) =>
    linhas.map((l) => l.map((v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(";")).join("\r\n");

  const LOGICA = {
    VERSAO, CONFIG, PRIORIDADES, foraDaFila, norm, chave, parseData, diasDesde, classificarPedido,
    identificar, levasPara, prioridade, ordenarGrupos, resumir, detectarColunas, tsv, csv, dataBR,
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
        (n ? (copiou ? "\nAgora abre a planilha e aperta Ctrl+V." : "\nClique em “Copiar para Impressos V2” no painel e cole na planilha.") : "")
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
  const registrosParaCopiar = () => (estado.registros.length ? estado.registros : estado.anterior ? estado.anterior.registros : []);

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
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

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
