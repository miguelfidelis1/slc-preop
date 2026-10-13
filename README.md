# SLC PreOp KDABRA — v2

Painel em JavaScript para a pré-operação do **KDABRA Checkout**, aberto por um favorito (bookmarklet) no navegador.

![Painel do SLC PreOp no simulador](docs/img/painel.png)

## O que ele faz

1. **Mapeia todos os caminhões** do modo escolhido (Mercearia ou Fresh), lendo os filtros da própria tela. Caminhão novo aparece sozinho, sem precisar mexer no código.
2. **Mostra a situação de cada caminhão**: impresso, parcial, não impresso, reimprimir 7d+, só pendentes ou fora da fila. Clicando no caminhão aparece a lista de pedidos.
3. **Imprime os caminhões selecionados** na ordem de prioridade, com as mesmas regras da v1.
4. **Confere depois de imprimir**: busca o caminhão de novo e avisa se algum pedido não ficou como impresso.
5. **Copia os pedidos impressos em TSV** para colar na planilha **Impressos V2**, no mesmo formato da v1. A cópia fica guardada no navegador, então dá para copiar de novo mesmo depois de recarregar a página.

Extras: modo **Simulação** (marca e confere sem clicar em Finalizar), **Copiar resumo** por caminhão, **Relatório CSV** com todos os pedidos, **Diagnóstico** da tela (sem dados reais) e **Log**.

## Como usar

1. Crie os favoritos com o código de [`bookmarklets/`](bookmarklets/README.md). São os mesmos da v1, então quem já tem não precisa trocar.
2. Abra o KDABRA Checkout e clique no favorito **Mercearia** ou **Fresh**. Dá para trocar o modo no próprio painel.
3. Clique em **🔍 Mapear caminhões**. O painel percorre todos os caminhões e mostra a situação de cada um.
4. Confira a lista. Os caminhões com pedidos a imprimir já vêm marcados (exceto os que estão fora da fila).
5. *(Opcional)* Ligue **Simulação** e clique em **Simular selecionados** para testar sem imprimir.
6. Clique em **🖨️ Imprimir selecionados** e confirme.
7. No fim, abra a **Impressos V2** e aperte **Ctrl+V**. Se não colar nada, clique em **📋 Copiar para Impressos V2** e cole de novo.

**⏹ Parar** interrompe depois do caminhão atual. O painel nunca para no meio de um caminhão.

## Regras

Detalhes em [`docs/regras-operacionais.md`](docs/regras-operacionais.md).

| | |
|---|---|
| Filtro | `Impresso = Todos` |
| Imprime | `Não foi impresso`, ou `Data Impressão` com **7 dias ou mais** |
| Ignora | `Pedido pendente`, impresso há menos de 7 dias, data inválida |
| Ordem | 299A → 299H → 100H–124H → demais 299 → A → B → C |
| Caminhões novos | entram no fim do grupo da leva deles (A/H/KA → A, B/KB/NC → B, C → C) |
| Fora da fila | caminhões **3000 em diante** (aparecem no painel, mas não vêm marcados) |

## Proteções

- **Tabela presa:** se a tabela não atualizar depois da busca (por exemplo, ainda mostrando o caminhão anterior), o caminhão fica com erro e **nada é impresso**.
- **Pedidos de outro caminhão:** só são marcadas linhas cuja coluna *Caminhão* bate com o que foi mapeado.
- **Marcação conferida:** antes de Finalizar, confere se a quantidade marcada na tela é exatamente a esperada.
- **Sem repetição:** um pedido impresso numa execução não é marcado de novo na mesma execução.
- **Uma instância só:** clicar no favorito de novo reabre o painel em vez de criar outro.

## Estrutura

```txt
src/slc-preop.js              ← código-fonte (o único arquivo que se edita)
src/mercearia.js, src/fresh.js ← gerados pelo build (os favoritos carregam estes)
scripts/build.js              ← gera os dois arquivos acima
test/logica.test.js           ← testes das regras
test/e2e.test.js              ← teste completo no navegador, usando o simulador
test/simulador/kdabra-falso.html ← imitação do KDABRA com dados falsos
bookmarklets/                 ← código dos favoritos
docs/                         ← regras, segurança, ideias futuras
```

## Desenvolvimento

```bash
npm install          # só na primeira vez
npm run build        # depois de editar src/slc-preop.js
npm test             # regras + confere se o build está atualizado
npm run test:e2e     # teste completo no Chromium, usando o simulador
```

Para testar à mão, abra `test/simulador/kdabra-falso.html` no navegador e clique em **▶ Abrir SLC PreOp**.

### Quando o KDABRA mudar

Quase tudo fica no bloco `CONFIG` no topo de `src/slc-preop.js`:

- `seletores`: IDs dos filtros, da tabela e dos botões;
- `colunas`: nomes dos cabeçalhos da tabela (as colunas são achadas pelo nome, não pela posição);
- `PRIORIDADES` e `foraDaFila`: ordem de impressão;
- `tempos`: esperas.

Se algo não for encontrado, o botão **🩺 Diagnóstico** copia a estrutura da tela, com todos os números trocados por 9, para ajudar a ajustar.

> ⚠️ Os favoritos carregam o código da branch `main`. Tudo que entra na `main` vale na hora para todo mundo que usa. Teste no simulador antes de fazer o merge.
