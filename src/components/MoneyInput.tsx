import React, { useState, useEffect } from "react";
import { parseValorMonetario } from "../utils";

interface MoneyInputProps {
  value: number;
  onChange: (valor: number) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

// Campo de valor monetário que aceita "," ou "." como separador decimal
// enquanto se escreve. Um <input> normal ligado diretamente a um valor
// numérico (value={numero}, onChange={e => setNumero(parseValorMonetario(
// e.target.value))}) reescreve o campo a cada tecla com o número já
// interpretado — o separador decimal desaparece assim que é digitado,
// tornando impossível escrever casas decimais. Este componente mantém o
// texto exatamente como o utilizador o escreve, e só reporta o número
// interpretado ao componente-pai via onChange.
export function MoneyInput({ value, onChange, className, placeholder, id, disabled, autoFocus }: MoneyInputProps) {
  const [texto, setTexto] = useState<string>(value ? String(value).replace(".", ",") : "");

  // Só resincroniza o texto exibido quando o valor externo mudou por uma
  // razão que não foi o próprio utilizador a escrever aqui (ex: reset do
  // formulário, preenchimento automático a partir de outra escolha) — nunca
  // simplesmente porque o componente voltou a renderizar.
  useEffect(() => {
    if (parseValorMonetario(texto) !== value) {
      setTexto(value ? String(value).replace(".", ",") : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      id={id}
      disabled={disabled}
      autoFocus={autoFocus}
      value={texto}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        setTexto(e.target.value);
        onChange(parseValorMonetario(e.target.value));
      }}
    />
  );
}
