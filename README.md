# SLC PreOp KDABRA

Automação em JavaScript para auxiliar a pré-operação do KDABRA Checkout.

O projeto está separado em dois modos:

- **Mercearia**
- **Fresh**

A ideia é usar um **bookmarklet pequeno** no navegador. Esse bookmarklet busca o código completo neste repositório do GitHub.

---

## O que o sistema faz

1. Abre o modo escolhido: Mercearia ou Fresh.
2. Monta a fila de caminhões/leves por prioridade.
3. Usa o filtro **Impresso = Todos**.
4. Ignora pedidos pendentes.
5. Imprime pedidos que estão:
   - como **Não foi impresso**; ou
   - com **Data Impressão de 7 dias ou mais**.
6. Ignora pedidos impressos recentemente.
7. Copia os registros em formato TSV para colar na planilha **Impressos V2**.

---

## Regras atuais

### Filtro

```txt
Mercearia = Impresso: Todos
Fresh = Impresso: Todos
```

### Pode imprimir

```txt
Data Entrega NÃO contém Pedido pendente
```

E:

```txt
Data Impressão = Não foi impresso
```

ou:

```txt
Data Impressão é uma data com 7 dias ou mais
```

### Ordem de prioridade

```txt
1. 299A
2. 299H
3. 100H até 124H
4. Demais 299, sem repetir A/H
5. Prioridade A
6. Prioridade B
7. Prioridade C
```

### Removido da fila

```txt
3000Z em diante
```

---

## Estrutura

```txt
slc-preop-kdabra/
├── README.md
├── CHANGELOG.md
├── src/
│   ├── mercearia.js
│   └── fresh.js
├── bookmarklets/
│   ├── README.md
│   ├── mercearia-loader.txt
│   └── fresh-loader.txt
└── docs/
    ├── regras-operacionais.md
    ├── seguranca.md
    └── ia-futuro.md
```

---

## Como subir no GitHub

1. Crie um repositório chamado, por exemplo:

```txt
slc-preop-kdabra
```

2. Suba todos os arquivos desta pasta para o repositório.

3. Confirme que os arquivos ficaram assim:

```txt
src/mercearia.js
src/fresh.js
```

4. Abra os arquivos em `bookmarklets/` e troque:

```txt
SEU_USUARIO
SEU_REPOSITORIO
```

por seus dados reais.

Exemplo:

```txt
miguelfidelis530
slc-preop-kdabra
```

---

## Como criar os favoritos

### Favorito da Mercearia

Nome:

```txt
KDABRA - Mercearia
```

URL:

copie o conteúdo de:

```txt
bookmarklets/mercearia-loader.txt
```

### Favorito do Fresh

Nome:

```txt
KDABRA - Fresh
```

URL:

copie o conteúdo de:

```txt
bookmarklets/fresh-loader.txt
```

---

## Como usar

1. Abra o KDABRA Checkout.
2. Clique em **KDABRA - Mercearia** ou **KDABRA - Fresh**.
3. Aguarde o painel aparecer.
4. O script consulta, seleciona, imprime e copia.
5. No final, cole na planilha **Impressos V2** com `Ctrl + V`.

---

## Importante sobre GitHub público/privado

O método de `fetch` funciona melhor com repositório público.

Se o repositório for privado, o navegador pode não conseguir carregar o arquivo `raw.githubusercontent.com`.

Não coloque no repositório:

```txt
chaves de API
tokens
senhas
dados de cliente
CPF
telefone
endereço
dados sensíveis da operação
```

Este projeto deve guardar apenas o código da automação.

---

## Atualizar regras

Quando mudar uma regra:

1. Edite `src/mercearia.js` ou `src/fresh.js`.
2. Faça commit no GitHub.
3. Rode o favorito novamente.

O loader usa `?v=Date.now()`, então ele tenta buscar sempre a versão mais recente.

---

## Versão atual

```txt
v1.0.0 - Reprint 7D
```
