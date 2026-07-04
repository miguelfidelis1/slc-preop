/*
 * SLC PreOp KDABRA - Fresh Reprint 7D
 * Uso via bookmarklet carregador pelo GitHub.
 * Não coloque API key, token, senha ou dado sensível neste arquivo.
 */
(async()=>{
  const CONFIG={modo:"Fresh",titulo:"KDABRA Fresh Reprint 7D",botao:"fresh",espera:900,a200:200,b200:210,a300:300,b300:310,reprintDias:7};
  const $=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const norm=x=>String(x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
  const key=x=>norm(x).toUpperCase();
  const clean=x=>String(x||"").replace(/\t/g," ").replace(/\r?\n/g," ").trim();
  const hoje=()=>new Date().toLocaleDateString("pt-BR");
  const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"};
  const copy=async txt=>{try{await navigator.clipboard.writeText(txt);return true}catch(e){const ta=document.createElement("textarea");ta.value=txt;ta.style.position="fixed";ta.style.left="-9999px";document.body.appendChild(ta);ta.focus();ta.select();const ok=document.execCommand("copy");ta.remove();return ok}};
  const waitKD=async()=>{await sleep(250);for(let i=0;i<30;i++){const l=$(".loadBlocker");if(!l||!vis(l)){await sleep(CONFIG.espera);return}await sleep(250)}await sleep(CONFIG.espera)};
  const ativarModo=async()=>{const b=[...document.querySelectorAll(".itens_type_btn")].find(x=>norm(x.innerText).includes(CONFIG.botao));if(b&&!b.classList.contains("active")){b.click();await sleep(1200);await waitKD()}};
  await ativarModo();
  const E={T:$("#truckInput"),L:$("#waveInput"),P:$("#printedInput"),B:$("#filtrar_busca"),TB:$("#toPrint_list"),FB:$("#finalizar_button")};
  if(!E.T||!E.L||!E.P||!E.B||!E.TB||!E.FB){alert("Não achei os elementos principais do KDABRA. Confere se está na tela certa do Checkout.");return}
  let reg=[],parar=false,painel=null,mini=false;
  const st={status:"Iniciando",modo:CONFIG.modo,atual:"-",i:0,total:0,sel:0,imp:0,pend:0,ja:0,sem:0,rep:0,last:"-"};
  const tsv=arr=>arr.map(x=>[x.caminhao,x.rota,x.pedido,x.entrega,x.impressao].map(clean).join("\t")).join("\n");
  const upd=()=>{if(!painel)return;const set=(id,v)=>{const e=painel.querySelector(id);if(e)e.textContent=v};set("#kd_status",st.status);set("#kd_modo",st.modo);set("#kd_atual",st.atual);set("#kd_prog",st.i+" / "+st.total);set("#kd_sel",st.sel);set("#kd_imp",st.imp);set("#kd_pend",st.pend);set("#kd_ja",st.ja);set("#kd_sem",st.sem);set("#kd_rep",st.rep);set("#kd_last",st.last);const bar=painel.querySelector("#kd_bar");if(bar){const pct=st.total?Math.min(100,Math.round(st.i/st.total*100)):0;bar.style.width=pct+"%";bar.textContent=pct+"%"}};
  const criarPainel=()=>{painel=document.createElement("div");painel.style="position:fixed;right:14px;bottom:14px;z-index:999999;background:#111;color:#fff;border-radius:14px;font:13px Arial,sans-serif;width:390px;box-shadow:0 6px 28px rgba(0,0,0,.45);overflow:hidden";painel.innerHTML=`<div style='background:#222;padding:10px 12px;font-weight:bold;display:flex;justify-content:space-between;align-items:center'><span>${CONFIG.titulo}</span><button id='kd_min' style='border:0;border-radius:7px;padding:4px 8px;cursor:pointer'>_</button></div><div id='kd_body' style='padding:12px;line-height:1.45'><div style='background:#333;border-radius:8px;overflow:hidden;margin-bottom:8px'><div id='kd_bar' style='background:#555;width:0%;text-align:center;font-size:11px;padding:2px 0'>0%</div></div><b>Modo:</b> <span id='kd_modo'>-</span><br><b>Status:</b> <span id='kd_status'>-</span><br><b>Atual:</b> <span id='kd_atual'>-</span><br><b>Progresso:</b> <span id='kd_prog'>0 / 0</span><hr style='border-color:#333'><b>Selecionados:</b> <span id='kd_sel'>0</span><br><b>Impressos/copiar:</b> <span id='kd_imp'>0</span><br><b>Reimpressos 7+d:</b> <span id='kd_rep'>0</span><br><b>Pendentes ignorados:</b> <span id='kd_pend'>0</span><br><b>Impressos recentes ignorados:</b> <span id='kd_ja'>0</span><br><b>Sem checkbox:</b> <span id='kd_sem'>0</span><hr style='border-color:#333'><b>Último:</b><br><span id='kd_last'>-</span><br><br><button id='kd_stop' style='padding:8px 10px;border:0;border-radius:8px;cursor:pointer;background:#d9534f;color:#fff'>Parar agora</button> <button id='kd_copy' style='padding:8px 10px;border:0;border-radius:8px;cursor:pointer'>Copiar acumulado</button></div>`;document.body.appendChild(painel);painel.querySelector("#kd_stop").onclick=()=>{parar=true;st.status="Parando após a consulta atual";upd()};painel.querySelector("#kd_copy").onclick=async()=>{await copy(tsv(reg));st.status=reg.length?"Acumulado copiado":"Nada acumulado ainda";upd()};painel.querySelector("#kd_min").onclick=()=>{mini=!mini;const b=painel.querySelector("#kd_body");b.style.display=mini?"none":"block";painel.querySelector("#kd_min").textContent=mini?"+":"_"}};
  const ops=s=>[...s.options].map(o=>({value:o.value,text:(o.innerText||o.textContent||o.value||"").trim(),key:key(o.innerText||o.textContent||o.value)}));
  const sel=(s,val)=>{s.disabled=false;s.value=val;if(window.jQuery){try{jQuery(s).val(val).trigger("change")}catch(e){}}s.dispatchEvent(new Event("input",{bubbles:true}));s.dispatchEvent(new Event("change",{bubbles:true}))};
  const filtroTodos=()=>sel(E.P,"0");
  const itensNao=()=>{const x=$("#printOrdersToogle");if(!x)return;if(window.jQuery&&jQuery.fn.bootstrapToggle){try{jQuery(x).bootstrapToggle("off")}catch(e){}}x.checked=false;x.dispatchEvent(new Event("change",{bubbles:true}))};
  const mapa=s=>{const ig=["TODOS","TODO","SELECIONE","","SIM","NAO","NÃO"],m=new Map;ops(s).forEach(o=>{if(o.value&&o.text&&!ig.includes(o.key)&&!m.has(o.key))m.set(o.key,o)});return m};
  const montar=()=>{const cs=mapa(E.T),ls=mapa(E.L),fila=[],us=new Set;const add=(num,lv,pri,tipo)=>{const c=cs.get(key(num)),l=ls.get(key(lv));if(!c||!l)return;const id=key(num)+"|"+key(lv);if(us.has(id))return;us.add(id);fila.push({c,l,nome:c.text+l.text,pri,tipo})};
    ["A","H"].forEach(x=>add("299",x,"MAX","299 Prioridade Máxima"));
    for(let i=100;i<=124;i++)add(String(i),"H","MAX","100H-124H Prioridade Máxima");
    [...ls.keys()].filter(x=>/^[A-Z]$/.test(x)&&!["A","H"].includes(x)).sort().forEach(x=>add("299",x,"MAX","299 Prioridade Máxima"));
    add("R","A","A","RA");add("R","H","A","RH");add("100","H","A","100H");add("H","A","A","HA");
    for(let i=150;i<=154;i++)add(String(i),"KA","A","KA");
    for(let i=1;i<=60;i++)add(String(i),"A","A","Original A");
    for(let i=CONFIG.a200;i<=CONFIG.b200;i++){add(String(i),"A","A","200A");add(String(i),"H","A","200H")}
    for(let i=CONFIG.a300;i<=CONFIG.b300;i++){add(String(i),"A","A","300A");add(String(i),"H","A","300H")}
    add("R","B","B","RB");add("H","B","B","HB");add("150","KB","B","150KB");
    for(let i=1;i<=60;i++)add(String(i),"B","B","Original B");
    add("100","B","B","100 Pontual B");
    for(let i=180;i<=184;i++)add(String(i),"NC","B","Leva Noturna NC");
    add("R","C","C","RC");add("D","C","C","DC");add("200","C","C","200C");add("K","C","C","KC");add("100","C","C","100C");
    return fila};
  const linhas=()=>{try{if(window.jQuery&&jQuery.fn.DataTable&&jQuery.fn.DataTable.isDataTable("#toPrint_list"))return jQuery("#toPrint_list").DataTable().rows({search:"applied"}).nodes().toArray()}catch(e){}return [...document.querySelectorAll("#table_body tr,#toPrint_list tbody tr")]};
  const pend=x=>{const e=norm(x.entrega);return e.includes("pedido pendente")||e.includes("pendente")};
  const parseD=s=>{const m=String(s||"").match(/(\d{2})\/(\d{2})\/(\d{4})/);if(!m)return null;return new Date(+m[3],+m[2]-1,+m[1])};
  const dias=s=>{const d=parseD(s);if(!d)return null;const h=new Date();h.setHours(0,0,0,0);d.setHours(0,0,0,0);return Math.floor((h-d)/86400000)};
  const statusImp=x=>{const im=norm(x.impressao);if(im.includes("nao foi impresso")||im.includes("nao impresso")||im.includes("não foi impresso")||im.includes("não impresso"))return"NAO_IMPRESSO";const di=dias(x.impressao);if(di!==null&&di>=CONFIG.reprintDias)return"REPRINT_7D";return"RECENTE_OU_INVALIDO"};
  const marca=row=>{const cb=[...row.querySelectorAll("input[type='checkbox']")].find(x=>x.id!=="check_all");if(cb){try{cb.scrollIntoView({block:"center"});if(!cb.checked){cb.click();if(!cb.checked)cb.checked=true;cb.dispatchEvent(new Event("input",{bubbles:true}));cb.dispatchEvent(new Event("change",{bubbles:true}));if(window.jQuery)jQuery(cb).prop("checked",true).trigger("change")}}catch(e){}return true}const td=row.children&&row.children[0];if(td){try{td.scrollIntoView({block:"center"});td.click();return true}catch(e){}}return false};
  const validos=()=>{let arr=[],pendentes=0,recentes=0,sem=0,rep=0;linhas().forEach(row=>{const td=[...row.querySelectorAll("td")];if(td.length<6)return;const x={row,caminhao:td[1].innerText.trim(),rota:td[2].innerText.trim(),pedido:td[3].innerText.trim(),entrega:td[4].innerText.trim(),impressao:td[5].innerText.trim()};if(!x.pedido)return;if(pend(x)){pendentes++;return}const stt=statusImp(x);if(stt==="RECENTE_OU_INVALIDO"){recentes++;return}if(!marca(row)){sem++;return}if(stt==="REPRINT_7D")rep++;arr.push({...x,status:stt})});return{arr,pendentes,recentes,sem,rep}};
  const confirma=async()=>{await sleep(400);let b=$("#acaoBotaoFinalizar_sim");if(b&&vis(b)){b.click();await sleep(700)}b=$("#boxes_barcodes_yes");if(b&&vis(b)){b.click();await sleep(700)}b=$("#alert_action");if(b&&vis(b)){b.click();await sleep(300)}};
  const fila=montar();st.total=fila.length;criarPainel();upd();
  if(!fila.length){st.status="Nenhuma combinação válida";upd();alert("Não achei caminhões/leves válidos no filtro do "+CONFIG.modo+".");return}
  console.clear();console.table(fila.map((x,i)=>({ordem:i+1,modo:CONFIG.modo,caminhao:x.nome,prioridade:x.pri,tipo:x.tipo})));
  const vistos=new Set;
  for(const it of fila){if(parar)break;st.i++;st.atual=it.nome+" | "+it.pri+" | "+it.tipo;st.status="Consultando "+CONFIG.modo+" com Impresso = Todos";upd();sel(E.T,it.c.value);await sleep(100);sel(E.L,it.l.value);await sleep(100);filtroTodos();itensNao();E.B.disabled=false;console.log("Buscando "+it.nome+" | "+CONFIG.modo+" | "+it.pri+" | "+it.tipo+" | Impresso=Todos");E.B.click();await waitKD();if(parar)break;st.status="Analisando tabela";upd();const lote=validos();st.pend+=lote.pendentes;st.ja+=lote.recentes;st.sem+=lote.sem;st.rep+=lote.rep;upd();if(lote.arr.length>0){st.sel+=lote.arr.length;st.status="Imprimindo";upd();lote.arr.forEach(x=>{const id=clean(x.pedido);if(!vistos.has(id)){vistos.add(id);reg.push({caminhao:x.caminhao,rota:x.rota,pedido:x.pedido,entrega:x.entrega,impressao:hoje()})}st.last=x.caminhao+" | "+x.pedido+(x.status==="REPRINT_7D"?" | Reprint 7D":"")});st.imp=reg.length;await copy(tsv(reg));upd();E.FB.click();await confirma();await sleep(800);st.status="Copiado para área de transferência";upd()}}
  if(reg.length){await copy(tsv(reg));st.status=parar?"Parado — acumulado copiado":"Finalizado — tudo copiado";st.imp=reg.length;upd();console.table(reg);alert((parar?"⏹️ Parado.\n\n":"✅ Finalizado.\n\n")+"Modo: "+CONFIG.modo+"\nPedidos impressos/copiadinhos para Impressos V2: "+reg.length+"\nReimpressos 7+d: "+st.rep+"\n\nAgora abre a planilha e aperta Ctrl+V.")}else{st.status=parar?"Parado sem registros":"Finalizado sem pedidos";upd();alert((parar?"⏹️ Parado.":"✅ Finalizado.")+" Modo: "+CONFIG.modo+". Nenhum pedido imprimível encontrado.")}
})();
