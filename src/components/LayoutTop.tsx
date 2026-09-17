import React, { useState } from "react";
import AuthModal from "./AuthModal";
import "./LayoutTop.css";

interface LayoutTopProps {
  onLoginSuccess?: (email: string) => void;
}

export default function LayoutTop({ onLoginSuccess }: LayoutTopProps) {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="layout-top-container">

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

      <img src="/skyline.webp" alt="Skyline" className="skyline-img" />

      <img src="/marca/02-versao-horizontal.webp" alt="Logo CondoManager" className="logo-img" fetchPriority="high" />

      <div className="video-frame">
        <video
          src="/intro.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="video-element"
        />
      </div>

      {showAuth && (
        <AuthModal 
          onClose={() => setShowAuth(false)} 
          onLoginSuccess={onLoginSuccess}
        />
      )}
    </div>
  );
}
