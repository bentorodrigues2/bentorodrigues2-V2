import React, { useState, useEffect } from "react";
import AuthModal from "./AuthModal";
import "./LayoutTop.css";

interface LayoutTopProps {
  onLoginSuccess?: (email: string) => void;
}

export default function LayoutTop({ onLoginSuccess }: LayoutTopProps) {
  const [showAuth, setShowAuth] = useState(false);

  // O vídeo decorativo (2MB) nunca é o elemento mais importante do ecrã
  // (LCP é sempre o logótipo, acima dele em z-index e com fetchPriority
  // "high") — mas com <video preload="auto"> (o valor por omissão) o
  // browser começa já a descarregá-lo assim que a página arranca, a
  // competir por rede com o logótipo, o CSS e a fonte, que SÃO críticos
  // para o primeiro ecrã. Só monta o elemento <video> (e portanto só pede
  // o ficheiro) depois do resto já ter tido a oportunidade de carregar —
  // o loop continua a dar a sensação de "sempre lá", só começa com um
  // atraso impercetível em vez de concorrer pela rede com o essencial.
  const [mostrarVideo, setMostrarVideo] = useState(false);
  useEffect(() => {
    const idCallback = (window as any).requestIdleCallback
      ? (window as any).requestIdleCallback(() => setMostrarVideo(true), { timeout: 1500 })
      : setTimeout(() => setMostrarVideo(true), 400);
    return () => {
      if ((window as any).cancelIdleCallback) (window as any).cancelIdleCallback(idCallback);
      else clearTimeout(idCallback as any);
    };
  }, []);

  return (
    <main className="layout-top-container">

      <div className="top-bar">
        <span className="condo-address">
          Rua Bento Rodrigues 2 - Paio Pires
        </span>

        <button
          className="area-pessoal-btn"
          onClick={() => setShowAuth(true)}
        >
          Área Pessoal
        </button>
      </div>

      <img src="/skyline.webp" alt="Skyline" className="skyline-img" width={1536} height={1024} />

      <img src="/marca/02-versao-horizontal.webp" alt="Logo CondoManager" className="logo-img" width={840} height={335} fetchPriority="high" />

      <div className="video-frame">
        {mostrarVideo && (
          <video
            src="/intro.mp4"
            preload="none"
            autoPlay
            muted
            loop
            playsInline
            className="video-element"
          />
        )}
      </div>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onLoginSuccess={onLoginSuccess}
        />
      )}
    </main>
  );
}
