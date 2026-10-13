# Regras operacionais

As regras ficam em `src/slc-preop.js`, no bloco `CONFIG` e nas listas `PRIORIDADES` / `foraDaFila`, e são cobertas por `test/logica.test.js`.

## Filtro

```txt
Impresso = Todos
```

## Levas de cada caminhão

O filtro Leva do KDABRA tem 32 opções fixas e não tem "Todos". Para não testar todas em cada caminhão, o script só busca as levas da faixa do caminhão (`levasPorCaminhao`, tirado da planilha Impressos V2):

| Caminhões | Levas buscadas |
|---|---|
| 1–99 | A, B |
| 100–149 | HA |
| 150–179 | KA, KB |
| 180–199 | NC |
| 200–298 | A, H |
| 299 | A–Z (as letras que existirem no filtro) e AA–AI |
| 300–399 | H, A |
| Outros | todas as levas (mais lento, avisa no Log) |

Com os 84 caminhões de hoje são cerca de 175 buscas, contra 2.688 testando todas as combinações.

## Situação de cada pedido

| Situação | Quando | Imprime? |
|---|---|---|
| Pendente | `Data Entrega` contém "pendente" | Não |
| Não impresso | `Data Impressão` = "Não foi impresso" | **Sim** |
| Reimprimir 7d+ | `Data Impressão` com 7 dias ou mais | **Sim** |
| Impresso | `Data Impressão` com menos de 7 dias | Não |
| Data inválida | `Data Impressão` sem data reconhecível | Não |

## Situação de cada caminhão

| Situação | Quando |
|---|---|
| Impresso | nada a imprimir e pelo menos um pedido impresso |
| Parcial | tem pedido não impresso e pedido já impresso |
| Não impresso | todos os pedidos imprimíveis nunca foram impressos |
| Reimprimir 7d+ | só tem reimpressões de 7 dias ou mais |
| Só pendentes | só tem pedidos pendentes |
| Fora da fila | caminhão 3000 em diante |

## Prioridade

```txt
MAX: 1. 299A
     2. 299H
     3. Demais 299: primeiro as levas de uma letra (299B … 299Z), depois as de duas (299AA … 299AI)
     4. 100HA até 124HA
A:   RA, RH, HA → 150–179 KA → 1–99 A → 200–298 A/H → 300–399 A/H → caminhões novos de leva A/H/HA/KA
B:   RB, HB, 150KB → 150–179 KB → 1–99 B → 100B → 180–199 NC → caminhões novos de leva B/KB/NC
C:   RC, DC, 200C, KC, 100C → caminhões novos de leva C
Outros: o que não casar com nenhuma regra
```

Dentro de cada regra, a ordem é numérica (1A, 2A, …, 60A).

## Capa CHECK CAMINHÃO (só Fresh)

No fim de cada execução do Fresh, o painel imprime uma capa por caminhão que teve pedido impresso naquela execução, mesmo que o caminhão já tivesse pedidos impressos antes. A capa lista os pedidos que acabaram de ser impressos, na ordem de impressão:

| Coluna | Conteúdo |
|---|---|
| CAMINHÃO | ex.: 7A |
| ROTA | "Rota fórmula" da planilha: 1º caractere + o que vem depois do traço (`6.0001.001-0645` → `60645`) |
| NÚMERO PEDIDO | número do pedido |
| CHECK / MAPEADO? | em branco, para marcar à mão |

O layout é o da Planilha1 da CHECK CAMINHAO FRESH NOVO, célula por célula: logo, "CHECK CAMINHÃO X" com o caminhão repetido ao lado, cabeçalho preto, tabela de 27 linhas (cresce se o caminhão tiver mais pedidos), linha para assinatura do fiscal, horário fim e a moldura em volta da folha, centralizada no A4.

Para usar a própria planilha em vez da capa automática: botão **Copiar para a planilha da capa** → colar em A2 da Planilha2 → Ctrl+P na Planilha1.

## Fora da fila

```txt
Caminhões 3000 em diante (ex.: 3000Z)
```

Não são lidos nem impressos.
