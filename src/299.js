/*
 * SLC PreOp KDABRA - Só 299 / 299 Forçado
 *
 * Uso: carregado por favorito via GitHub.
 * Regra: roda somente caminhão 299 no modo atual do KDABRA (Mercearia ou Fresh).
 * Imprime tudo que aparecer no 299, mesmo se já foi impresso antes.
 * Ignora apenas Data Entrega com "Pedido pendente".
 */
(async()=>{
    const $=s=>document.querySelector(s);
    const sl=m=>new Promise(r=>setTimeout(r,m));
    const n=x=>String(x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
    const k=x=>n(x).toUpperCase();
    const lim=x=>String(x||"").replace(/\t/g," ").replace(/\r?\n/g," ").trim();
    const hoje=()=>new Date().toLocaleDateString("pt-BR");
    const vis=e=>{if(!e)return 0;let r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"};
    const cp=async t=>{try{await navigator.clipboard.writeText(t);return 1}catch(e){let a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();let ok=document.execCommand("copy");a.remove();return ok}};
  
    const T=$("#truckInput"),L=$("#waveInput"),P=$("#printedInput"),B=$("#filtrar_busca"),FB=$("#finalizar_button");
    if(!T||!L||!P||!B||!FB){alert("Abra o KDABRA Checkout primeiro.");return}
  
    let reg=[],stop=0,st={i:0,total:0,sel:0,pend:0,fora:0,last:"-"};
    const tsv=a=>a.map(x=>[x.caminhao,x.rota,x.pedido,x.entrega,x.impressao].map(lim).join("\t")).join("\n");
  
    let box=document.createElement("div");
    box.style="position:fixed;right:14px;bottom:14px;z-index:999999;background:#111;color:#fff;border-radius:12px;font:13px Arial;width:330px;box-shadow:0 6px 25px #0008;overflow:hidden";
    box.innerHTML="<div style='background:#222;padding:10px;font-weight:bold'>KDABRA 299 Forçado</div><div style='padding:12px;line-height:1.5'><b>Status:</b> <span id=s>Iniciando</span><br><b>Atual:</b> <span id=a>-</span><br><b>Progresso:</b> <span id=p>0/0</span><hr><b>Selecionados:</b> <span id=se>0</span><br><b>Pendentes ignorados:</b> <span id=pe>0</span><br><b>Mistura bloqueada:</b> <span id=fo>0</span><hr><b>Último:</b><br><span id=la>-</span><br><br><button id=parar style='padding:7px;border:0;border-radius:7px;background:#d9534f;color:#fff'>Parar</button> <button id=copiar style='padding:7px;border:0;border-radius:7px'>Copiar</button></div>";
    document.body.appendChild(box);
  
    const up=()=>{
      box.querySelector("#s").textContent=st.s||"Rodando";
      box.querySelector("#a").textContent=st.at||"-";
      box.querySelector("#p").textContent=st.i+"/"+st.total;
      box.querySelector("#se").textContent=st.sel;
      box.querySelector("#pe").textContent=st.pend;
      box.querySelector("#fo").textContent=st.fora;
      box.querySelector("#la").textContent=st.last;
    };
    box.querySelector("#parar").onclick=()=>{stop=1;st.s="Parando...";up()};
    box.querySelector("#copiar").onclick=async()=>{await cp(tsv(reg));st.s="Copiado";up()};
  
    const ops=s=>[...s.options].map(o=>({v:o.value,t:(o.innerText||o.textContent||o.value||"").trim(),key:k(o.innerText||o.textContent||o.value)}));
    const set=(s,v)=>{s.disabled=false;s.value=v;if(window.jQuery){try{jQuery(s).val(v).trigger("change")}catch(e){}}s.dispatchEvent(new Event("input",{bubbles:true}));s.dispatchEvent(new Event("change",{bubbles:true}))};
    const mapa=s=>{let m=new Map;ops(s).forEach(o=>{if(o.v&&o.t&&!["TODOS","TODO","SELECIONE","","SIM","NAO","NÃO"].includes(o.key)&&!m.has(o.key))m.set(o.key,o)});return m};
  
    const wait=async()=>{await sl(300);for(let i=0;i<40;i++){let l=$(".loadBlocker");if(!l||!vis(l)){await sl(1000);return}await sl(250)}await sl(1000)};
    const linhas=()=>{try{if(window.jQuery&&jQuery.fn.DataTable&&jQuery.fn.DataTable.isDataTable("#toPrint_list"))return jQuery("#toPrint_list").DataTable().rows({search:"applied"}).nodes().toArray()}catch(e){}return [...document.querySelectorAll("#table_body tr,#toPrint_list tbody tr")]};
    const sig=()=>linhas().map(r=>r.innerText.replace(/\s+/g," ").trim()).join("|").slice(0,6000);
    const estavel=async()=>{let a="",q=0;for(let i=0;i<25;i++){let b=sig();if(b&&b===a){q++;if(q>=3)return}else{q=0;a=b}await sl(250)}};
    const limpa=()=>linhas().forEach(r=>{let cb=[...r.querySelectorAll("input[type='checkbox']")].find(x=>x.id!=="check_all");if(cb&&cb.checked){try{cb.click();cb.checked=false;cb.dispatchEvent(new Event("change",{bubbles:true}));if(window.jQuery)jQuery(cb).prop("checked",false).trigger("change")}catch(e){}}});
    const pend=x=>n(x.entrega).includes("pendente");
    const marca=r=>{let cb=[...r.querySelectorAll("input[type='checkbox']")].find(x=>x.id!=="check_all");if(cb){try{cb.scrollIntoView({block:"center"});if(!cb.checked){cb.click();if(!cb.checked)cb.checked=true;cb.dispatchEvent(new Event("change",{bubbles:true}));if(window.jQuery)jQuery(cb).prop("checked",true).trigger("change")}}catch(e){}return 1}let td=r.children&&r.children[0];if(td){try{td.click();return 1}catch(e){}}return 0};
    const conf=async()=>{await sl(450);for(let id of["#acaoBotaoFinalizar_sim","#boxes_barcodes_yes","#alert_action"]){let b=$(id);if(b&&vis(b)){b.click();await sl(700)}}};
  
    const valido=nome=>{let arr=[],pe=0,fo=0;linhas().forEach(row=>{let td=[...row.querySelectorAll("td")];if(td.length<6)return;let x={row,caminhao:td[1].innerText.trim(),rota:td[2].innerText.trim(),pedido:td[3].innerText.trim(),entrega:td[4].innerText.trim(),impressao:td[5].innerText.trim()};if(!x.pedido)return;if(k(x.caminhao)!==k(nome)){fo++;return}if(pend(x)){pe++;return}if(!marca(row))return;arr.push(x)});return{arr,pe,fo}};
  
    const preparar=async()=>{let cs=mapa(T),c=cs.get("299");if(!c)return;set(T,c.v);await sl(400);await wait();for(let i=0;i<10;i++){let ls=mapa(L);if([...ls.keys()].filter(x=>/^[A-Z]$/.test(x)).length>=3)return;await sl(300)}};
  
    await preparar();
  
    const f=(()=>{let cs=mapa(T),ls=mapa(L),c=cs.get("299"),f=[],u=new Set;if(!c)return f;const add=lv=>{let l=ls.get(k(lv));if(!l)return;let id="299|"+k(lv);if(u.has(id))return;u.add(id);f.push({c,l,nome:c.t+l.t})};["A","H"].forEach(add);[...ls.keys()].filter(x=>/^[A-Z]$/.test(x)&&!["A","H"].includes(x)).sort().forEach(add);return f})();
    st.total=f.length;up();
    if(!f.length){alert("Não achei 299/leves no filtro.");return}
  
    set(P,"0");
    let itg=$("#printOrdersToogle");
    if(itg){try{if(window.jQuery&&jQuery.fn.bootstrapToggle)jQuery(itg).bootstrapToggle("off")}catch(e){}itg.checked=false;itg.dispatchEvent(new Event("change",{bubbles:true}))}
  
    const vistos=new Set;
    for(let it of f){
      if(stop)break;
      st.i++;st.at=it.nome;st.s="Consultando";up();
      set(T,it.c.v);await sl(150);
      set(L,it.l.v);await sl(150);
      set(P,"0");
      B.disabled=false;B.click();
      await wait();await estavel();limpa();
      let lote=valido(it.nome);
      if(lote.fo>0){st.fora+=lote.fo;st.s="Tabela misturada, bloqueado";up();continue}
      st.pend+=lote.pe;up();
      if(lote.arr.length){
        st.sel+=lote.arr.length;st.s="Imprimindo";up();
        lote.arr.forEach(x=>{let id=lim(x.pedido);if(!vistos.has(id)){vistos.add(id);reg.push({caminhao:x.caminhao,rota:x.rota,pedido:x.pedido,entrega:x.entrega,impressao:hoje()})}st.last=x.caminhao+" | "+x.pedido});
        await cp(tsv(reg));up();
        FB.click();await conf();await sl(900);
      }
    }
  
    if(reg.length){await cp(tsv(reg));st.s="Finalizado e copiado";up();alert("✅ 299 forçado finalizado.\nPedidos copiados: "+reg.length+"\nPendentes ignorados: "+st.pend+"\nMisturas bloqueadas: "+st.fora+"\n\nCole na Impressos V2 com Ctrl+V.")}
    else{st.s="Finalizado sem pedidos";up();alert("✅ 299 finalizado. Nenhum pedido encontrado para imprimir.")}
  })();
  