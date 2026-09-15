import React, { useState, useEffect } from "react";

interface SendingReactionModalProps {
  isOpen?: boolean;
  type?: "email" | "mensagem";
  onComplete?: () => void;
  title?: string;
}

/**
 * Dispara a animação de envio.
 * - Sem "action": comportamento antigo, puramente decorativo (usado só para
 *   confirmar downloads locais de PDF, onde não há nada a "enviar" a sério).
 * - Com "action": a animação fica ligada ao resultado real dessa promise —
 *   mostra "a enviar" enquanto ela está pendente, e só mostra "sucesso" se
 *   ela resolver sem lançar erro. Se falhar, fecha a animação e relança o
 *   erro para quem chamou tratar (alert, etc.) — nunca finge sucesso.
 */
export function triggerSendReaction(
  type: "email" | "mensagem",
  title?: string,
  action?: () => Promise<unknown> | unknown
) {
  window.dispatchEvent(
    new CustomEvent("TRIGGER_SEND_REACTION", {
      detail: { type, title, action }
    })
  );
}

export const SendingReactionModal: React.FC<SendingReactionModalProps> = ({
  isOpen: propsIsOpen = false,
  type: propsType = "email",
  onComplete: propsOnComplete,
  title: propsTitle
}) => {
  const [globalState, setGlobalState] = useState<{
    isOpen: boolean;
    type: "email" | "mensagem";
    title?: string;
    action?: () => Promise<unknown> | unknown;
  }>({
    isOpen: false,
    type: "email"
  });

  const [phase, setPhase] = useState<"sending" | "success">("sending");

  // Listen for global custom events
  useEffect(() => {
    const handleGlobalTrigger = (e: Event) => {
      const customEvent = e as CustomEvent<{
        type: "email" | "mensagem";
        title?: string;
        action?: () => Promise<unknown> | unknown;
      }>;
      if (customEvent.detail) {
        setGlobalState({
          isOpen: true,
          type: customEvent.detail.type || "email",
          title: customEvent.detail.title,
          action: customEvent.detail.action
        });
      }
    };

    window.addEventListener("TRIGGER_SEND_REACTION", handleGlobalTrigger);
    return () => {
      window.removeEventListener("TRIGGER_SEND_REACTION", handleGlobalTrigger);
    };
  }, []);

  const activeIsOpen = propsIsOpen || globalState.isOpen;
  const activeType = propsIsOpen ? propsType : globalState.type;
  const activeTitle = propsIsOpen ? propsTitle : globalState.title;

  // Modo decorativo (sem action): mantém o comportamento antigo, com
  // temporizadores fixos — só usado onde não há nada a enviar a sério.
  useEffect(() => {
    if (activeIsOpen && !globalState.action) {
      setPhase("sending");
      const timer1 = setTimeout(() => {
        setPhase("success");
      }, 1500);

      const timer2 = setTimeout(() => {
        if (propsIsOpen && propsOnComplete) {
          propsOnComplete();
        }
        setGlobalState(prev => ({ ...prev, isOpen: false }));
      }, 3300);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [activeIsOpen, propsIsOpen, propsOnComplete, globalState.isOpen, globalState.action]);

  // Modo real (com action): a animação segue o resultado verdadeiro da
  // promise — nunca mostra "sucesso" sem a ação ter mesmo terminado bem.
  useEffect(() => {
    if (globalState.isOpen && globalState.action) {
      setPhase("sending");
      let cancelado = false;

      Promise.resolve()
        .then(() => globalState.action!())
        .then(() => {
          if (cancelado) return;
          setPhase("success");
          setTimeout(() => {
            if (!cancelado) setGlobalState(prev => ({ ...prev, isOpen: false }));
          }, 1800);
        })
        .catch((err) => {
          if (cancelado) return;
          // Fecha a animação sem fingir sucesso — quem chamou trata o erro
          // (normalmente com um alert()), a animação não decide por eles.
          setGlobalState(prev => ({ ...prev, isOpen: false }));
          console.error("[SendingReactionModal] Ação real falhou:", err);
        });

      return () => {
        cancelado = true;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalState.isOpen, globalState.action]);

  if (!activeIsOpen) return null;

  const htmlSrc = phase === "sending"
    ? "/a-enviar.html"
    : activeType === "email"
    ? "/email-enviado-sucesso.html"
    : "/mensagem-enviada-sucesso.html";

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm flex flex-col items-center p-6 text-center text-white">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-4">
          {activeTitle || (phase === "sending" ? "A Processar Envio..." : activeType === "email" ? "E-mail Enviado" : "Mensagem Enviada")}
        </h4>

        <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 mb-4 relative">
          <iframe
            src={htmlSrc}
            className="w-full h-full border-0"
            title="Reação Envio"
          />
        </div>

        <p className="text-xs text-slate-400 font-medium">
          {phase === "sending"
            ? "A comunicar com os servidores e canais de notificação..."
            : activeType === "email"
            ? "E-mail entregue com sucesso aos destinatários."
            : "Mensagem entregue no canal interno do condómino."
          }
        </p>
      </div>
    </div>
  );
};
