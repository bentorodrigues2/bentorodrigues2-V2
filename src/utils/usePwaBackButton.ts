import { useEffect, useRef } from "react";

/**
 * Liga qualquer ecrã/modal aberto (isOpen) ao botão físico de "voltar"
 * do telemóvel — sem isto, o browser não tem nenhum registo de navegação
 * interna e o botão físico sai diretamente da app em vez de fechar o
 * modal/sub-ecrã atual. Regista uma entrada no histórico ao abrir e, se o
 * utilizador carregar em "voltar" enquanto está aberto, chama onClose em
 * vez de deixar o browser sair da PWA.
 *
 * Uso: usePwaBackButton(selectedDoc !== null, () => setSelectedDoc(null));
 * Pode aplicar-se a quantos modais/sub-ecrãs existirem — cada instância
 * empilha o seu próprio nível de histórico de forma independente.
 */
export function usePwaBackButton(isOpen: boolean, onClose: () => void) {
  const estavaAbertoRef = useRef(false);

  useEffect(() => {
    if (isOpen && !estavaAbertoRef.current) {
      window.history.pushState({ pwaModalAberto: true }, "");
    }
    estavaAbertoRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePopState = () => onClose();
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isOpen, onClose]);
}
