/**
 * Permite arrastar com o rato (clicar e deslocar, como o Trello) qualquer
 * contentor com scroll horizontal da app — tabelas largas, barras de
 * separadores/filtros, etc. — em vez de obrigar a ir sempre até à régua de
 * scroll lá em baixo. Pedido explícito do administrador: aplicar a TODOS os
 * menus/ecrãs onde isso faça sentido.
 *
 * Em vez de reescrever cada um dos ~30 componentes que já usam
 * "overflow-x-auto"/"overflow-x-scroll", liga-se isto UMA VEZ à raiz da app
 * (ver src/main.tsx) com delegação de eventos a partir do document — passa a
 * funcionar em qualquer contentor rolável existente E em qualquer um que
 * venha a ser criado no futuro, sem precisar de alterar mais nenhum ecrã.
 */
export function ativarArrastarParaRolar(): () => void {
  let contentor: HTMLElement | null = null;
  let startX = 0;
  let scrollLeftInicial = 0;
  let houveArrasto = false;
  const LIMIAR_PX = 5;

  const encontrarContentorRolavel = (origem: HTMLElement | null): HTMLElement | null => {
    let el: HTMLElement | null = origem;
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth + 1) {
        const estilo = window.getComputedStyle(el);
        if (estilo.overflowX === "auto" || estilo.overflowX === "scroll") return el;
      }
      el = el.parentElement;
    }
    return null;
  };

  const aoPressionar = (e: MouseEvent) => {
    if (e.button !== 0) return; // só o botão esquerdo
    const contentorEncontrado = encontrarContentorRolavel(e.target as HTMLElement);
    if (!contentorEncontrado) return;
    contentor = contentorEncontrado;
    startX = e.pageX;
    scrollLeftInicial = contentor.scrollLeft;
    houveArrasto = false;
  };

  const aoMover = (e: MouseEvent) => {
    if (!contentor) return;
    const dx = e.pageX - startX;
    if (!houveArrasto && Math.abs(dx) < LIMIAR_PX) return;
    houveArrasto = true;
    contentor.scrollLeft = scrollLeftInicial - dx;
    contentor.classList.add("a-arrastar-horizontal");
    // Evita selecionar texto por engano enquanto se arrasta a régua.
    e.preventDefault();
  };

  const aoLargar = () => {
    if (contentor) contentor.classList.remove("a-arrastar-horizontal");
    contentor = null;
  };

  // Se houve mesmo arrasto (passou o limiar), suprime o click que o browser
  // dispara a seguir ao mouseup — sem isto, arrastar uma linha de tabela
  // também "clicava" nela e abria a ficha/modal por engano.
  const aoClicarCaptura = (e: MouseEvent) => {
    if (houveArrasto) {
      e.stopPropagation();
      e.preventDefault();
      houveArrasto = false;
    }
  };

  document.addEventListener("mousedown", aoPressionar);
  document.addEventListener("mousemove", aoMover);
  document.addEventListener("mouseup", aoLargar);
  document.addEventListener("mouseleave", aoLargar);
  document.addEventListener("click", aoClicarCaptura, true);

  return () => {
    document.removeEventListener("mousedown", aoPressionar);
    document.removeEventListener("mousemove", aoMover);
    document.removeEventListener("mouseup", aoLargar);
    document.removeEventListener("mouseleave", aoLargar);
    document.removeEventListener("click", aoClicarCaptura, true);
  };
}
