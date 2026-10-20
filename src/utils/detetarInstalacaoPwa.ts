import { useEffect } from "react";
import { registarInstalacaoPwa } from "../lib/supabaseService";

function detetarPlataforma(): string {
  if (typeof navigator === "undefined") return "outro";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "outro";
}

function estaEmModoStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneCss = typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
  // (navigator as any).standalone — só existe no Safari/iOS, é a única forma
  // de saber que a app já está instalada nesse sistema (ver nota em
  // supabaseService.ts: a Apple nunca deu nenhum evento com a data exata
  // de instalação, só este sinal "já está instalada agora").
  const standaloneIos = typeof navigator !== "undefined" && (navigator as any).standalone === true;
  return Boolean(standaloneCss || standaloneIos);
}

/**
 * Deteta e regista a instalação da PWA pelo condómino — dois sinais nunca
 * misturados (ver InstalacaoPwa em supabaseService.ts):
 * - Android/Chrome/Edge: evento "appinstalled" real, com o momento exato.
 * - iOS/Safari: sem evento nenhum disponível; só conseguimos detetar, na
 *   próxima vez que a app abre, que já está instalada (display-mode:
 *   standalone / navigator.standalone), sem saber quando isso aconteceu.
 */
export function useDetetarInstalacaoPwa(params: {
  idPredio?: string;
  idFracao?: string;
  email?: string;
  nome?: string;
}) {
  const { idPredio, idFracao, email, nome } = params;

  useEffect(() => {
    if (!idPredio || !idFracao || typeof window === "undefined") return;

    if (estaEmModoStandalone()) {
      registarInstalacaoPwa({
        idPredio,
        idFracao,
        email,
        nome,
        plataforma: detetarPlataforma(),
        metodo: "modo_standalone_detetado"
      });
    }

    const handleAppInstalled = () => {
      registarInstalacaoPwa({
        idPredio,
        idFracao,
        email,
        nome,
        plataforma: detetarPlataforma(),
        metodo: "evento_appinstalled"
      });
    };
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => window.removeEventListener("appinstalled", handleAppInstalled);
  }, [idPredio, idFracao, email, nome]);
}
