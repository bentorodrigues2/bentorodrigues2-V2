import { next } from "@vercel/edge";

// A Search Console reportou que o Google escolheu
// "https://bentorodrigues2.condomanagerai.com/" como URL CANÓNICO do
// domínio todo, em vez de "https://www.condomanagerai.com/" — apesar de
// o HTML já declarar o canonical certo (ver index.html). Isso acontece
// porque essa declaração é feita via JavaScript DEPOIS da página
// carregar, e o Google pode decidir ignorar um "hint" de canonical/
// robots que não vê logo nos cabeçalhos HTTP ou no HTML inicial,
// sobretudo quando várias dezenas de subdomínios de clientes servem
// HTML praticamente idêntico (o mesmo ecrã de login).
//
// Este middleware corre no Edge, ANTES de qualquer HTML ser devolvido,
// e acrescenta o sinal certo diretamente nos cabeçalhos HTTP — a forma
// mais forte e fiável de o Google perceber, sem depender de executar
// JavaScript nenhum:
// - Domínio principal (site público, por fazer): cabeçalho Link com
//   rel="canonical" a apontar sempre para si mesmo.
// - Qualquer subdomínio de cliente (aplicação privada de um
//   condomínio, sem nenhum valor para SEO) e qualquer outro domínio
//   (ex: pré-visualizações do Vercel): X-Robots-Tag: noindex, nofollow
//   — nunca pode ser escolhido como canónico nem aparecer no Google.
const DOMINIO_PRINCIPAL = new Set(["www.condomanagerai.com", "condomanagerai.com"]);

export const config = {
  // Só nos caminhos que servem HTML da aplicação (tudo o resto já
  // devolve ficheiros estáticos ou respostas de API, onde isto não
  // interessa) — evita adicionar latência a pedidos que não precisam.
  matcher: [
    "/((?!api/|assets/|marca/|favicon|manifest\\.json|robots\\.txt|sitemap\\.xml|icon-|skyline\\.webp|intro\\.mp4).*)"
  ]
};

export default function middleware(request: Request) {
  const host = new URL(request.url).hostname;
  const response = next();

  if (DOMINIO_PRINCIPAL.has(host)) {
    response.headers.set("Link", '<https://www.condomanagerai.com/>; rel="canonical"');
  } else {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}
