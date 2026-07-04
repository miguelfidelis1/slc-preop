# Bookmarklets

Troque `SEU_USUARIO` e `SEU_REPOSITORIO` antes de criar os favoritos.

## Mercearia

```js
javascript:(()=>{fetch("https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPOSITORIO/main/src/mercearia.js?v="+Date.now()).then(r=>r.text()).then(t=>Function(t)()).catch(e=>alert("Erro ao carregar Mercearia: "+e))})()
```

## Fresh

```js
javascript:(()=>{fetch("https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPOSITORIO/main/src/fresh.js?v="+Date.now()).then(r=>r.text()).then(t=>Function(t)()).catch(e=>alert("Erro ao carregar Fresh: "+e))})()
```

## Alternativa com jsDelivr

Se o `raw.githubusercontent.com` for bloqueado ou ficar lento:

### Mercearia

```js
javascript:(()=>{fetch("https://cdn.jsdelivr.net/gh/SEU_USUARIO/SEU_REPOSITORIO@main/src/mercearia.js?v="+Date.now()).then(r=>r.text()).then(t=>Function(t)()).catch(e=>alert("Erro ao carregar Mercearia: "+e))})()
```

### Fresh

```js
javascript:(()=>{fetch("https://cdn.jsdelivr.net/gh/SEU_USUARIO/SEU_REPOSITORIO@main/src/fresh.js?v="+Date.now()).then(r=>r.text()).then(t=>Function(t)()).catch(e=>alert("Erro ao carregar Fresh: "+e))})()
```
