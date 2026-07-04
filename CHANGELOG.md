# Changelog

## v1.0.0 - Reprint 7D

- Separação dos modos Mercearia e Fresh.
- Ambos usam `Impresso = Todos`.
- Reimpressão permitida para pedidos com `Data Impressão` de 7 dias ou mais.
- Ignora `Pedido pendente`.
- Prioridade máxima:
  - 299A
  - 299H
  - 100H até 124H
  - demais 299
- Removido 3000Z+ da fila.
- Painel com contadores.
- Cópia final em TSV para Impressos V2.
