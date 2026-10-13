// Gera src/mercearia.js e src/fresh.js a partir de src/slc-preop.js.
// Assim os favoritos antigos continuam funcionando, e o código fica num lugar só.
//   npm run build          → gera os arquivos
//   npm run build -- --check → só confere se estão atualizados (usado nos testes)
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const fonte = fs.readFileSync(path.join(raiz, "src", "slc-preop.js"), "utf8");
const MODOS = { mercearia: "Mercearia", fresh: "Fresh" };
const soConferir = process.argv.includes("--check");

const gerar = (modo, nome) =>
  `/*
 * ARQUIVO GERADO — não edite. Edite src/slc-preop.js e rode \`npm run build\`.
 * SLC PreOp KDABRA — abre já no modo ${nome}.
 */
{
const SLC_PREOP_MODO = "${modo}";
${fonte.trimEnd()}
}
`;

let desatualizados = [];
for (const [modo, nome] of Object.entries(MODOS)) {
  const destino = path.join(raiz, "src", `${modo}.js`);
  const conteudo = gerar(modo, nome);
  const atual = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : "";
  if (atual === conteudo) continue;
  if (soConferir) desatualizados.push(path.relative(raiz, destino));
  else {
    fs.writeFileSync(destino, conteudo);
    console.log("gerado:", path.relative(raiz, destino));
  }
}
if (desatualizados.length) {
  console.error("Arquivos desatualizados (rode `npm run build`): " + desatualizados.join(", "));
  process.exit(1);
}
