# Segurança

Este projeto usa bookmarklets para executar JavaScript dentro da página do KDABRA.

## Cuidados

- Não coloque API key no código.
- Não coloque token, senha ou credencial.
- Não envie dados sensíveis para serviços externos.
- Evite publicar qualquer informação real de pedido, cliente ou operação.
- Mantenha o repositório apenas com código genérico.

## Sobre IA

Se futuramente entrar IA:

```txt
KDABRA → script → sua API/backend → API de IA
```

A chave de IA deve ficar no backend, nunca no arquivo JS do GitHub.

## Sobre a v2

- O painel só lê a tela do KDABRA e clica nos mesmos botões que o operador clicaria. Ele não envia nada para fora do navegador.
- O botão **Diagnóstico** troca todos os números por `9` antes de copiar. Mesmo assim, confira o texto antes de compartilhar.
- Os pedidos impressos ficam guardados só no navegador de quem usou (`localStorage`), para poder copiar de novo.
- Os favoritos carregam o código da `main`. Qualquer merge vale na hora para toda a operação. Prefira testar no simulador (`test/simulador/`) antes e, se quiser mais controle, use a versão fixa por tag (veja `bookmarklets/README.md`).
- O simulador usa apenas dados inventados. Não coloque HTML real do KDABRA no repositório.
