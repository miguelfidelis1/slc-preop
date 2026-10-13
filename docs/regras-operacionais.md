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
     3. 100HA até 124HA
     4. Demais 299: primeiro as levas de uma letra (299B … 299Z), depois as de duas (299AA … 299AI)
A:   RA, RH, HA → 150–179 KA → 1–99 A → 200–298 A/H → 300–399 A/H → caminhões novos de leva A/H/HA/KA
B:   RB, HB, 150KB → 150–179 KB → 1–99 B → 100B → 180–199 NC → caminhões novos de leva B/KB/NC
C:   RC, DC, 200C, KC, 100C → caminhões novos de leva C
Outros: o que não casar com nenhuma regra
```

Dentro de cada regra, a ordem é numérica (1A, 2A, …, 60A).

## Fora da fila

```txt
Caminhões 3000 em diante (ex.: 3000Z)
```

Não são lidos nem impressos.
