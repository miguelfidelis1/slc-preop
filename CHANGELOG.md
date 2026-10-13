# Changelog

## v2.0.0 - Painel completo

- Código reescrito do zero, num arquivo-fonte único (`src/slc-preop.js`). `mercearia.js` e `fresh.js` agora são gerados por `npm run build`, e os favoritos continuam os mesmos.
- **Mapeamento de todos os caminhões** lidos dos filtros da tela, sem lista fixa. Caminhões novos aparecem sozinhos.
- Painel com a situação de cada caminhão (impresso, parcial, não impresso, reimprimir 7d+, só pendentes, fora da fila), filtros, busca e lista de pedidos por caminhão.
- Seleção de quais caminhões imprimir. Caminhões novos entram no fim do grupo da leva (A/B/C).
- Modo **Simulação**: marca e confere sem clicar em Finalizar.
- **Conferência pós-impressão**: busca o caminhão de novo e aponta pedidos que não ficaram como impressos.
- Proteção contra tabela presa no caminhão anterior, contra linhas de outro caminhão e contra marcação que não confere.
- Colunas da tabela achadas pelo nome do cabeçalho, não mais pela posição.
- Pedidos impressos ficam guardados no navegador para copiar de novo depois.
- Novos botões: Copiar resumo, Relatório CSV, Diagnóstico (sem dados reais) e Log.
- Testes automáticos das regras e teste completo no navegador com um simulador do KDABRA.

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
