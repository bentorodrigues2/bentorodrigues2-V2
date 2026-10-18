import { useEffect, useRef } from "react";

/**
 * Comportamento standard de acessibilidade para um modal: fecha com a
 * tecla Esc e prende o foco (Tab/Shift+Tab) dentro do próprio modal
 * enquanto estiver aberto, em vez de deixar o foco "escapar" para o
 * conteúdo por trás (invisível, mas continua focável por teclado) — os
 * dois comportamentos standard que faltavam em praticamente todos os
 * modais da app (cada um é uma <div> fixa ad-hoc, sem nenhum padrão
 * partilhado). Devolve uma ref a colocar no elemento raiz do modal.
 *
 * Uso: const modalRef = useModalAcessivel(isOpen, onClose);
 *      <div ref={modalRef} ...>...</div>
 */
export function useModalAcessivel<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose: () => void
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Foca o modal assim que abre, para o Tab começar já dentro dele.
    const elementoFocadoAntes = document.activeElement as HTMLElement | null;
    ref.current?.focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;

      const focaveis = ref.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      // Devolve o foco a quem o tinha antes de abrir o modal (ex.: o botão
      // que o abriu) — sem isto, depois de fechar, o foco do teclado fica
      // "perdido" no topo da página.
      elementoFocadoAntes?.focus?.();
    };
  }, [isOpen, onClose]);

  return ref;
}
