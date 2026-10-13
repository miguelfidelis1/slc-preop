# Changelog

## v2.0.0 - Todos os caminhões, mesmo jeito de usar

- Mesmo uso da v1: clicou no favorito, ele imprime tudo sozinho e copia para a Impressos V2. Os favoritos são os mesmos.
- **Lê todos os caminhões** do filtro da tela, sem lista fixa, buscando só as levas da faixa de cada caminhão (`levasPorCaminhao`): cerca de 170 buscas em vez de 2.688. Caminhões novos são impressos no fim do grupo da leva deles (A/B/C).
- Prioridades atualizadas para os nomes atuais (100HA–124HA, 299AA…299Z, 150–179 KA/KB).
- Só troca os filtros que mudaram entre uma busca e outra (menos recargas da tabela).
- **Conferência pós-impressão**: busca o caminhão de novo e avisa pedidos que não ficaram como impressos.
- Proteção contra tabela presa no caminhão anterior, contra linhas de outro caminhão e contra marcação que não confere. O caminhão com problema é pulado e listado no aviso final.
- Colunas da tabela achadas pelo nome do cabeçalho, não mais pela posição.
- Última impressão guardada no navegador para copiar de novo. Clicar no favorito outra vez não abre um segundo painel.
- Painel com contadores, lista de caminhões com a situação de cada um, Copiar resumo, Relatório CSV, Diagnóstico (sem dados reais) e Log.
- Modo simulação por configuração (`window.SLC_PREOP_CONFIG = { simulacao: true }`).
- Código reescrito num arquivo-fonte único (`src/slc-preop.js`). `mercearia.js` e `fresh.js` são gerados por `npm run build`.
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
