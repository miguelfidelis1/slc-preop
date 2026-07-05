require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const {
  GEMINI_API_KEY,
  GEMINI_MODEL = "gemini-2.5-flash",
  SLC_PUBLIC_TOKEN,
  PORT = 3000,
} = process.env;

function validarToken(req, res, next) {
  const token = req.headers["x-slc-token"];

  if (!SLC_PUBLIC_TOKEN) {
    return res.status(500).json({
      ok: false,
      erro: "SLC_PUBLIC_TOKEN não configurado no backend.",
    });
  }

  if (token !== SLC_PUBLIC_TOKEN) {
    return res.status(401).json({
      ok: false,
      erro: "Token inválido.",
    });
  }

  next();
}

function montarPrompt(execucao) {
  return `
Você é um analista operacional do SLC PreOp KDABRA.

Sua função:
- Gerar um resumo curto, claro e direto.
- Apontar pontos de atenção operacional.
- Explicar reimpressões 7D como pedidos com Data Impressão de 7 dias ou mais antes de hoje.
- Nunca diga que reimpressões 7D são pedidos impressos "nos últimos 7 dias".
- Não decidir impressão.
- Não alterar regras.
- Não inventar dados.
- Não citar informações que não estejam nos dados enviados.
- Responder em português do Brasil.

Regras operacionais:
- Pedido pendente sempre é ignorado.
- Pedido "Não foi impresso" pode ser impresso.
- Pedido com Data Impressão de 7 dias ou mais pode ser reimpresso.
- Pedido impresso recentemente é ignorado.
- A IA apenas resume e alerta; a decisão de impressão é feita por regra fixa no código.

Dados da execução:
${JSON.stringify(execucao, null, 2)}

Responda exatamente neste formato:

Resumo:
...

Atenções:
- ...

Reimpressões 7D:
- ...

Pendências:
- ...

Próxima ação sugerida:
...
`.trim();
}

function extrairTextoGemini(data) {
  const texto = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    ?.filter(Boolean)
    ?.join("\n")
    ?.trim();

  if (texto) return texto;

  return JSON.stringify(data, null, 2);
}

async function chamarGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` +
    `?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const resposta = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1500,
      },
    }),
  });

  const data = await resposta.json();

  if (!resposta.ok) {
    throw new Error(JSON.stringify(data, null, 2));
  }

  return extrairTextoGemini(data);
}

app.get("/", (req, res) => {
  res.json({
    nome: "SLC PreOp IA",
    status: "online",
    versao: "0.2.0-gemini-generate-content",
    modelo: GEMINI_MODEL,
  });
});

app.post("/api/ia/resumo", validarToken, async (req, res) => {
  try {
    const execucao = req.body;

    if (!execucao || typeof execucao !== "object") {
      return res.status(400).json({
        ok: false,
        erro: "Body inválido. Envie um JSON com os dados da execução.",
      });
    }

    const prompt = montarPrompt(execucao);
    const relatorio = await chamarGemini(prompt);

    res.json({
      ok: true,
      relatorio,
    });
  } catch (error) {
    console.error("Erro na IA:", error);

    res.status(500).json({
      ok: false,
      erro: String(error.message || error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`SLC PreOp IA rodando em http://localhost:${PORT}`);
  console.log(`Versão: 0.2.0-gemini-generate-content`);
  console.log(`Modelo Gemini: ${GEMINI_MODEL}`);
});