# Bookmarklets

Crie um favorito no navegador e cole o código abaixo no campo **URL**. São os mesmos da v1: quem já tem os favoritos não precisa trocar nada.

Os dois abrem o mesmo painel. A única diferença é o modo inicial, e dá para trocar no próprio painel. Os arquivos [`mercearia-loader.txt`](mercearia-loader.txt) e [`fresh-loader.txt`](fresh-loader.txt) têm o mesmo código.

## Mercearia

```js
javascript:(()=>{fetch("https://raw.githubusercontent.com/miguelfidelis1/slc-preop/main/src/mercearia.js?v="+Date.now()).then(r=>r.text()).then(t=>Function(t)()).catch(e=>alert("Erro ao carregar Mercearia: "+e))})()
```

## Fresh

```js
javascript:(()=>{fetch("https://raw.githubusercontent.com/miguelfidelis1/slc-preop/main/src/fresh.js?v="+Date.now()).then(r=>r.text()).then(t=>Function(t)()).catch(e=>alert("Erro ao carregar Fresh: "+e))})()
```

## Alternativa com jsDelivr

Se o `raw.githubusercontent.com` for bloqueado ou ficar lento:

```js
javascript:(()=>{fetch("https://cdn.jsdelivr.net/gh/miguelfidelis1/slc-preop@main/src/mercearia.js?v="+Date.now()).then(r=>r.text()).then(t=>Function(t)()).catch(e=>alert("Erro ao carregar Mercearia: "+e))})()
```

## Versão fixa (mais seguro)

Os favoritos acima pegam sempre o que está na `main`. Para a operação só mudar quando você decidir, crie uma tag no GitHub (ex.: `v2.0.0`) e troque `@main` por `@v2.0.0` no link do jsDelivr:

```js
javascript:(()=>{fetch("https://cdn.jsdelivr.net/gh/miguelfidelis1/slc-preop@v2.0.0/src/mercearia.js").then(r=>r.text()).then(t=>Function(t)()).catch(e=>alert("Erro ao carregar Mercearia: "+e))})()
```
