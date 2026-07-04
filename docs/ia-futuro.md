# Ideia futura: SLC PreOp com IA

A IA não deve decidir sozinha o que imprimir.

A regra de impressão deve continuar fixa no código:

```txt
Pedido pendente = não imprime
Não foi impresso = imprime
Impresso há 7+ dias = reimprime
```

A IA pode ser usada para:

- resumir a execução;
- explicar por que um pedido foi ignorado;
- detectar anomalias;
- listar reimpressos antigos;
- gerar mensagem para liderança;
- sugerir revisão de regra operacional.

## Arquitetura recomendada

```txt
KDABRA
↓
Bookmarklet
↓
Coleta dados mínimos
↓
Backend SLC PreOp
↓
API de IA
↓
Resumo/alertas no painel
```

## Nunca fazer

```js
const API_KEY = "minha-chave";
```

Chave de IA sempre no backend.
