# Regras operacionais

As regras ficam em `src/slc-preop.js`, no bloco `CONFIG` e nas listas `PRIORIDADES` / `foraDaFila`, e são cobertas por `test/logica.test.js`.

## Filtro

```txt
Impresso = Todos
```

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
     3. 100H até 124H
     4. Demais 299
A:   RA, RH, HA → 150–154 KA → 1–60 A → 200–210 A/H → 300–310 A/H → caminhões novos de leva A/H/KA
B:   RB, HB, 150KB → 1–60 B → 100B → 180–184 NC → caminhões novos de leva B/KB/NC
C:   RC, DC, 200C, KC, 100C → caminhões novos de leva C
Outros: o que não casar com nenhuma regra
```

Dentro de cada regra, a ordem é numérica (1A, 2A, …, 60A).

## Fora da fila

```txt
Caminhões 3000 em diante (ex.: 3000Z)
```

Aparecem na lista do painel para conferência, mas não são impressos.
