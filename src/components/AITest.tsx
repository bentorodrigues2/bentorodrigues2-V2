import { useState } from "react";
import { askAI } from "../ai/ai";

export default function AITest() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  async function runAI() {
    const resposta = await askAI(input);
    setOutput(resposta);
  }

  return (
    <div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={runAI}>Perguntar à IA</button>
      <p>{output}</p>
    </div>
  );
}
