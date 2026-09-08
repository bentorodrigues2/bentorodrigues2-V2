import React, { useState, useEffect, useRef } from "react";
import { Predio, LoggedUser, ChaveItem } from "../types";
import { cpLookup } from "../data";
import { gerarPdfEtiquetasChaves } from "../utils";
import { supabase } from '@/lib/supabaseClient';

interface GestaoPrediosProps {
  predios: Predio[];
  onAddPredio: (novoPredio: Predio) => void;
  onUpdatePredio: (updatedPredio: Predio) => void;
  onDeletePredio?: (idPredio: string) => void;
  loggedUser: LoggedUser;
  activeSubSection?: string;
}

export function extrairIniciaisCodigoPredio(predio?: Predio | null): string {
  if (!predio) return "BR2PP";
  const morada = predio.morada_linha1 || "";
  const porta = predio.num_porta || "";
  const localidade = predio.localidade || "";

  const stopWords = new Set(["rua", "av", "avenida", "praça", "praca", "travessa", "tv", "largo", "alameda", "pct", "prct", "urbanização", "urb", "de", "da", "do", "dos", "das", "e"]);

  const processStr = (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 0 && !stopWords.has(w))
      .map(w => w[0].toUpperCase())
      .join("");
  };

  const initMorada = processStr(morada);
  const portaClean = porta.trim();
  const initLocalidade = processStr(localidade);

  const prefix = `${initMorada}${portaClean}${initLocalidade}`.replace(/[^A-Z0-9]/g, "");
  return prefix || "BR2PP";
}

export function GestaoPredios({ predios, onAddPredio, onUpdatePredio, onDeletePredio, loggedUser, activeSubSection }: GestaoPrediosProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");

  // Determine active tab purely from activeSubSection (navigated via central sidebar expandable menu)
  const mainTab: "cadastro" | "regras" | "chaves" = 
    activeSubSection === "predios_chaves" ? "chaves" :
    activeSubSection === "predios_regras" ? "regras" : "cadastro";

  // Status de Aprovação das Regras & Estatutos em Assembleia
  const [regumentoAprovado, setRegumentoAprovado] = useState(true);

  // Módulo de Gestão de Chaves do Prédio
  const [chaves, setChaves] = useState<ChaveItem[]>(() => [
    { id_chave: "chv-1", id_predio: "predio-1", area_nome: "Caixa de correio Adm.", codigo_chave: "BR2PP 001", num_chaveiro: "1", local_sugerido: "Edifício Estrela da Barra", quantidade: 3, no_claviculario: true, observacoes: "Chave mestre da caixa de correio da Administração" },
    { id_chave: "chv-2", id_predio: "predio-1", area_nome: "Porta Principal", codigo_chave: "BR2PP 002", num_chaveiro: "1", local_sugerido: "Edifício Estrela da Barra", quantidade: 12, no_claviculario: true, observacoes: "Porta principal de entrada do edifício" },
    { id_chave: "chv-3", id_predio: "predio-1", area_nome: "Arrecadação Comum", codigo_chave: "BR2PP 003", num_chaveiro: "1", local_sugerido: "Edifício Estrela da Barra", quantidade: 2, no_claviculario: true, observacoes: "Arrecadação de material de limpeza e manutenção" },
    { id_chave: "chv-4", id_predio: "predio-1", area_nome: "Arrecadação Escadas", codigo_chave: "BR2PP 004", num_chaveiro: "1", local_sugerido: "Edifício Estrela da Barra", quantidade: 2, no_claviculario: true, observacoes: "Arrecadação sob as escadas do rés-do-chão" },
    { id_chave: "chv-5", id_predio: "predio-1", area_nome: "Elevadores", codigo_chave: "BR2PP 005", num_chaveiro: "2", local_sugerido: "Edifício Estrela da Barra", quantidade: 4, no_claviculario: true, observacoes: "Chaves de serviço e emergência dos elevadores" },
    { id_chave: "chv-6", id_predio: "predio-1", area_nome: "Sótão", codigo_chave: "BR2PP 006", num_chaveiro: "2", local_sugerido: "Edifício Estrela da Barra", quantidade: 2, no_claviculario: true, observacoes: "Acesso à zona técnica do sótão" },
    { id_chave: "chv-7", id_predio: "predio-1", area_nome: "Vitrine", codigo_chave: "BR2PP 007", num_chaveiro: "1", local_sugerido: "Edifício Estrela da Barra", quantidade: 2, no_claviculario: true, observacoes: "Vitrine de avisos do hall de entrada" },
    { id_chave: "chv-8", id_predio: "predio-1", area_nome: "Casa Bomba de Água", codigo_chave: "BR2PP 008", num_chaveiro: "2", local_sugerido: "Edifício Estrela da Barra", quantidade: 2, no_claviculario: true, observacoes: "Central de bombagem de água do edifício" },
    { id_chave: "chv-9", id_predio: "predio-1", area_nome: "Garagem", codigo_chave: "BR2PP 009", num_chaveiro: "1", local_sugerido: "Edifício Estrela da Barra", quantidade: 6, no_claviculario: true, observacoes: "Portão pedonal e comandos da garagem" },
    { id_chave: "chv-10", id_predio: "predio-1", area_nome: "Ginásio", codigo_chave: "BR2PP 010", num_chaveiro: "3", local_sugerido: "Edifício Estrela da Barra", quantidade: 2, no_claviculario: true, observacoes: "Porta de acesso ao ginásio do condomínio" },
    { id_chave: "chv-11", id_predio: "predio-1", area_nome: "SPA", codigo_chave: "BR2PP 011", num_chaveiro: "3", local_sugerido: "Edifício Estrela da Barra", quantidade: 2, no_claviculario: true, observacoes: "Acesso à zona de SPA e sauna" },
    { id_chave: "chv-12", id_predio: "predio-1", area_nome: "Casa de Máquinas Piscina", codigo_chave: "BR2PP 012", num_chaveiro: "3", local_sugerido: "Edifício Estrela da Barra", quantidade: 2, no_claviculario: true, observacoes: "Casa de máquinas de filtragem da piscina" },
    { id_chave: "chv-13", id_predio: "predio-1", area_nome: "WC Piscina", codigo_chave: "BR2PP 013", num_chaveiro: "3", local_sugerido: "Edifício Estrela da Barra", quantidade: 3, no_claviculario: true, observacoes: "Instalações sanitárias do balneário da piscina" },
    { id_chave: "chv-14", id_predio: "predio-1", area_nome: "Quadro Elétrico Geral", codigo_chave: "BR2PP 014", num_chaveiro: "2", local_sugerido: "Edifício Estrela da Barra", quantidade: 2, no_claviculario: true, observacoes: "Quadro de colunas e contador geral de eletricidade" },
    { id_chave: "chv-15", id_predio: "predio-1", area_nome: "Central de Deteção de Incêndio", codigo_chave: "BR2PP 015", num_chaveiro: "2", local_sugerido: "Edifício Estrela da Barra", quantidade: 2, no_claviculario: true, observacoes: "Painel central do sistema de segurança contra incêndios" },
    { id_chave: "chv-16", id_predio: "predio-1", area_nome: "Coletor de Resíduos / Lixo", codigo_chave: "BR2PP 016", num_chaveiro: "1", local_sugerido: "Edifício Estrela da Barra", quantidade: 4, no_claviculario: true, observacoes: "Compartimento estanque de contentores de lixo" },
    { id_chave: "chv-17", id_predio: "predio-1", area_nome: "Acesso ao Telhado / Cobertura", codigo_chave: "BR2PP 017", num_chaveiro: "2", local_sugerido: "Edifício Estrela da Barra", quantidade: 2, no_claviculario: true, observacoes: "Alçapão / porta de acesso à cobertura superior" }
  ]);

  // Nova chave form
  const [novaAreaChave, setNovaAreaChave] = useState("");
  const [novoCodigoChave, setNovoCodigoChave] = useState("");
  const [novoNumChaveiro, setNovoNumChaveiro] = useState("1");
  const [novoLocalSugerido, setNovoLocalSugerido] = useState("");
  const [novaQtdChave, setNovaQtdChave] = useState(2);

  // Chaveiro Principal (Master Keychain) State
  const [numChaveiroMaster, setNumChaveiroMaster] = useState("1");
  const [codigoConjuntoCustom, setCodigoConjuntoCustom] = useState("");
  const [identificacaoConjuntoCustom, setIdentificacaoConjuntoCustom] = useState("");

  // Regras do Prédio (Regulamento Automático) State
  const [regras, setRegras] = useState(() => {
    return {
      silencio: "Proibido ruído e música alta entre as 22:00 e as 08:00 nos dias úteis, e entre as 23:00 e as 09:00 nos fins de semana e feriados.",
      animais: "Permitidos no máximo 2 animais de pequeno/médio porte por fração. Uso obrigatório de trela nas áreas comuns. Limpeza imediata de dejeções.",
      obras: "Obras ruidosas permitidas apenas em dias úteis das 09:00 às 18:00. Obrigatoriedade de avisar a vizinhança no hall com 48h de antecedência.",
      estacionamento: "Estacionamento exclusivo no lugar afeto à fração. Cargas e descargas na zona comum limitadas a 30 minutos.",
      lixo: "Deposição de resíduos domésticos nos contentores das 20:00 às 22:00. Separação obrigatória nos ecopontos comuns.",
      areasComuns: "Reserva da Sala Comum e Churrasqueira com 24h de antecedência. Lotação máxima da Piscina: 12 pessoas; Ginásio: 4 pessoas."
    };
  });

  // AI Validation State for Pedidos
  const [pedidoTexto, setPedidoTexto] = useState("");
  const [validandoPedido, setValidandoPedido] = useState(false);
  const [resultadoValidacao, setResultadoValidacao] = useState<{
    decisao: "Aprovado" | "Aprovado com Condições" | "Rejeitado";
    motivos: string[];
    regrasAplicadas: string[];
    recomendacaoIA: string;
  } | null>(null);

  const handleValidarPedidoIA = () => {
    if (!pedidoTexto.trim()) return alert("Descreva o pedido ou pretensão do condómino.");
    setValidandoPedido(true);
    setResultadoValidacao(null);

    setTimeout(() => {
      const q = pedidoTexto.toLowerCase();
      let decisao: "Aprovado" | "Aprovado com Condições" | "Rejeitado" = "Aprovado";
      const motivos: string[] = [];
      const regrasAplicadas: string[] = [];

      if (q.includes("festa") || q.includes("música") || q.includes("barulho") || q.includes("23h") || q.includes("24h") || q.includes("noite") || q.includes("madrugada")) {
        regrasAplicadas.push("Regra de Silêncio (22h-08h úteis / 23h-09h fds)");
        if (q.includes("23h") || q.includes("24h") || q.includes("madrugada") || q.includes("música alta")) {
          decisao = "Rejeitado";
          motivos.push("Viola o horário de descanso regulamentar do prédio (Artº 1º - Silêncio).");
        } else {
          decisao = "Aprovado com Condições";
          motivos.push("Música em volume moderado e encerramento rigoroso até às 22:00.");
        }
      }

      if (q.includes("obra") || q.includes("furar") || q.includes("partir") || q.includes("remodelação")) {
        regrasAplicadas.push("Regra de Obras (09h-18h dias úteis)");
        if (q.includes("domingo") || q.includes("sábado") || q.includes("noite")) {
          decisao = "Rejeitado";
          motivos.push("Obras ruidosas são estritamente proibidas aos fins de semana e noites.");
        } else {
          if (decisao !== "Rejeitado") decisao = "Aprovado com Condições";
          motivos.push("Fixar aviso prévio no hall com 48h de antecedência e respeitar o horário 09h-18h.");
        }
      }

      if (q.includes("cão") || q.includes("gato") || q.includes("animal") || q.includes("pet")) {
        regrasAplicadas.push("Regra de Animais de Estimação");
        motivos.push("Manter o animal com trela nas zonas comuns e assegurar a higienização imediata.");
        if (decisao === "Aprovado") decisao = "Aprovado com Condições";
      }

      if (q.includes("piscina") || q.includes("sala") || q.includes("churrasqueira") || q.includes("reserva")) {
        regrasAplicadas.push("Regra de Uso de Áreas Comuns");
        if (q.includes("30 pessoas") || q.includes("40 pessoas") || q.includes("multidão")) {
          decisao = "Rejeitado";
          motivos.push("Excede a lotação máxima de segurança permitida para as zonas comuns.");
        } else {
          motivos.push("Efetuar a reserva com 24h de antecedência na PWA e efetuar limpeza pós-evento.");
          if (decisao === "Aprovado") decisao = "Aprovado com Condições";
        }
      }

      if (motivos.length === 0) {
        motivos.push("O pedido está em inteira conformidade com o Regulamento Geral do Condomínio.");
      }

      setResultadoValidacao({
        decisao,
        motivos,
        regrasAplicadas: regrasAplicadas.length > 0 ? regrasAplicadas : ["Regulamento Geral do Condomínio"],
        recomendacaoIA: decisao === "Rejeitado"
          ? "A IA recomenda notificar o condómino sobre a impossibilidade legal de autorizar o pedido nos moldes solicitados."
          : decisao === "Aprovado com Condições"
          ? "A IA recomenda enviar termo de responsabilidade com as condições especificadas."
          : "O pedido pode ser deferido automaticamente com notificação na PWA."
      });

      setValidandoPedido(false);
    }, 600);
  };

  // Form states
  const [selectedPredioId, setSelectedPredioId] = useState<string | null>(predios[0]?.id_predio || null);
  const [nome, setNome] = useState("");
  const [moradaLinha1, setMoradaLinha1] = useState("");
  const [moradaLinha2, setMoradaLinha2] = useState("");
  const [numPorta, setNumPorta] = useState("");
  const [letraPorta, setLetraPorta] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [localidade, setLocalidade] = useState("");
  const [nif, setNif] = useState("");
  const [emailPredio, setEmailPredio] = useState("");
  const [foto, setFoto] = useState<string | null>(null);

  const [elevador, setElevador] = useState(false);
  const [numElevadores, setNumElevadores] = useState(0);
  const [garagem, setGaragem] = useState(false);
  const [piscina, setPiscina] = useState(false);
  const [salaComum, setSalaComum] = useState(false);
  const [arrecadacoes, setArrecadacoes] = useState(false);
  const [jardins, setJardins] = useState(false);
  const [churrasqueira, setChurrasqueira] = useState(false);
  const [terraco, setTerraco] = useState(false);
  const [ginasio, setGinasio] = useState(false);
  const [spa, setSpa] = useState(false);
  const [wcPiscina, setWcPiscina] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load predios from Supabase on mount
  useEffect(() => {
    const carregarPrediosSupabase = async () => {
      try {
        const { data, error } = await supabase.from('predios').select('*');
        if (error) {
          console.warn("[Supabase] Erro ao ler predios:", error.message);
        } else if (data && data.length > 0) {
          data.forEach((p: any) => {
            const mappedPredio: Predio = {
              id_predio: p.id_predio,
              nome: p.nome || null,
              morada_linha1: p.morada_linha1 || "",
              morada_linha2: p.morada_linha2 || null,
              num_porta: p.num_porta || "",
              letra_porta: p.letra_porta || null,
              codigo_postal: p.codigo_postal || "",
              localidade: p.localidade || "",
              nif: p.nif || "",
              email: p.email || null,
              autoresponder_ativo: p.autoresponder_ativo ?? true,
              foto: p.foto || null,
              patrimonio: p.patrimonio || {
                tem_elevador: false,
                num_elevadores: 0,
                tem_garagem: false,
                tem_piscina: false,
                tem_sala_comum: false,
                tem_arrecadacoes_comuns: false,
                tem_jardins: false,
                tem_churrasqueira: false,
                tem_terraco: false,
                tem_ginasio: false,
                tem_spa: false,
              }
            };
            if (!predios.some(existing => existing.id_predio === mappedPredio.id_predio)) {
              onAddPredio(mappedPredio);
            }
          });
        }
      } catch (err: any) {
        console.warn("[Supabase] Exceção ao ler predios:", err?.message);
      }
    };
    carregarPrediosSupabase();
  }, []);

  // When selectedPredioId changes, load building data into form
  useEffect(() => {
    if (selectedPredioId) {
      const p = predios.find(item => item.id_predio === selectedPredioId);
      if (p) {
        setNome(p.nome || "");
        setMoradaLinha1(p.morada_linha1 || "");
        setMoradaLinha2(p.morada_linha2 || "");
        setNumPorta(p.num_porta || "");
        setLetraPorta(p.letra_porta || "");
        setCodigoPostal(p.codigo_postal || "");
        setLocalidade(p.localidade || "");
        setNif(p.nif || "");
        setEmailPredio(p.email || "");
        setFoto(p.foto || null);

        setElevador(!!p.patrimonio?.tem_elevador);
        setNumElevadores(p.patrimonio?.num_elevadores || 0);
        setGaragem(!!p.patrimonio?.tem_garagem);
        setPiscina(!!p.patrimonio?.tem_piscina);
        setSalaComum(!!p.patrimonio?.tem_sala_comum);
        setArrecadacoes(!!p.patrimonio?.tem_arrecadacoes_comuns);
        setJardins(!!p.patrimonio?.tem_jardins);
        setChurrasqueira(!!p.patrimonio?.tem_churrasqueira);
        setTerraco(!!p.patrimonio?.tem_terraco);
        setGinasio(!!p.patrimonio?.tem_ginasio);
        setSpa(!!p.patrimonio?.tem_spa);
        setWcPiscina(!!p.patrimonio?.tem_wc_piscina);
      }
    } else {
      // Clear form for new building
      limparFormulario();
    }
  }, [selectedPredioId, predios]);

  const limparFormulario = () => {
    setSelectedPredioId(null);
    setNome("");
    setMoradaLinha1("");
    setMoradaLinha2("");
    setNumPorta("");
    setLetraPorta("");
    setCodigoPostal("");
    setLocalidade("");
    setNif("");
    setEmailPredio("");
    setFoto(null);
    setElevador(false);
    setNumElevadores(0);
    setGaragem(false);
    setPiscina(false);
    setSalaComum(false);
    setArrecadacoes(false);
    setJardins(false);
    setChurrasqueira(false);
    setTerraco(false);
    setGinasio(false);
    setSpa(false);
    setWcPiscina(false);
  };

  useEffect(() => {
    const cleanCP = codigoPostal.trim();
    if (cpLookup[cleanCP]) {
      setLocalidade(cpLookup[cleanCP]);
    }
  }, [codigoPostal]);

  const processarImagemPredio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        const webpDataUrl = canvas.toDataURL("image/webp", 0.85);
        setFoto(webpDataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const submeterForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggedUser.role !== 'ADMIN') {
      alert("Apenas administradores podem gerir o cadastro de prédios!");
      return;
    }
    if (!moradaLinha1 || !numPorta || !codigoPostal || !localidade || !nif || !emailPredio.trim()) {
      alert("Preencha todos os campos obrigatórios (*), incluindo o E-mail Oficial do Prédio.");
      return;
    }

    const patrimonioObj = {
      tem_elevador: elevador,
      num_elevadores: elevador ? Number(numElevadores) : 0,
      tem_garagem: garagem,
      tem_piscina: piscina,
      tem_sala_comum: salaComum,
      tem_arrecadacoes_comuns: arrecadacoes,
      tem_jardins: jardins,
      tem_churrasqueira: churrasqueira,
      tem_terraco: terraco,
      tem_ginasio: ginasio,
      tem_spa: spa,
      tem_wc_piscina: wcPiscina
    };

    if (selectedPredioId) {
      // Editing existing building
      const updated: Predio = {
        id_predio: selectedPredioId,
        nome: nome || null,
        morada_linha1: moradaLinha1,
        morada_linha2: moradaLinha2 || null,
        num_porta: numPorta,
        letra_porta: letraPorta || null,
        codigo_postal: codigoPostal,
        localidade,
        nif,
        email: emailPredio.trim() || null,
        autoresponder_ativo: true,
        foto,
        patrimonio: patrimonioObj
      };

      try {
        const { error: updateError } = await supabase
          .from('predios')
          .update({
            nome: updated.nome,
            morada_linha1: updated.morada_linha1,
            morada_linha2: updated.morada_linha2,
            num_porta: updated.num_porta,
            letra_porta: updated.letra_porta,
            codigo_postal: updated.codigo_postal,
            localidade: updated.localidade,
            nif: updated.nif,
            email: updated.email,
            autoresponder_ativo: updated.autoresponder_ativo,
            foto: updated.foto,
            patrimonio: updated.patrimonio
          })
          .eq('id_predio', selectedPredioId);

        if (updateError) {
          alert(`Erro ao atualizar prédio no Supabase: ${updateError.message}`);
          return;
        }

        // Regra 2: Depois de gravar, atualizar a lista com select('*')
        const { data: prediosAtualizados, error: readError } = await supabase
          .from('predios')
          .select('*');

        if (readError) {
          console.warn("[Supabase] Aviso ao ler predios:", readError.message);
        }

        onUpdatePredio(updated);
        alert("✅ Cadastro do prédio atualizado com sucesso no Supabase!");
      } catch (err: any) {
        alert(`Erro na ligação com o Supabase: ${err?.message || "Erro desconhecido"}`);
      }
    } else {
      // Creating new building
      const novo: Predio = {
        id_predio: "predio-" + Date.now(),
        nome: nome || null,
        morada_linha1: moradaLinha1,
        morada_linha2: moradaLinha2 || null,
        num_porta: numPorta,
        letra_porta: letraPorta || null,
        codigo_postal: codigoPostal,
        localidade,
        nif,
        email: emailPredio.trim() || null,
        autoresponder_ativo: true,
        foto,
        patrimonio: patrimonioObj
      };

      try {
        const { error: insertError } = await supabase
          .from('predios')
          .insert([{
            id_predio: novo.id_predio,
            nome: novo.nome,
            morada_linha1: novo.morada_linha1,
            morada_linha2: novo.morada_linha2,
            num_porta: novo.num_porta,
            letra_porta: novo.letra_porta,
            codigo_postal: novo.codigo_postal,
            localidade: novo.localidade,
            nif: novo.nif,
            email: novo.email,
            autoresponder_ativo: novo.autoresponder_ativo,
            foto: novo.foto,
            patrimonio: novo.patrimonio
          }]);

        if (insertError) {
          alert(`Erro ao gravar prédio no Supabase: ${insertError.message}`);
          return;
        }

        // Regra 2: Depois de gravar, atualizar a lista com select('*')
        const { data: prediosAtualizados, error: readError } = await supabase
          .from('predios')
          .select('*');

        if (readError) {
          console.warn("[Supabase] Aviso ao ler predios:", readError.message);
        }

        onAddPredio(novo);
        setSelectedPredioId(novo.id_predio);
        alert("✅ Novo prédio guardado com sucesso no Supabase!");
      } catch (err: any) {
        alert(`Erro na ligação com o Supabase: ${err?.message || "Erro desconhecido"}`);
      }
    }
  };

  const handleRemoverPredio = async (idPredio: string) => {
    if (loggedUser.role !== 'ADMIN') {
      alert("Apenas administradores podem remover prédios!");
      return;
    }
    const target = predios.find(p => p.id_predio === idPredio);
    const nameStr = target?.nome || `${target?.morada_linha1}, Nº ${target?.num_porta}`;
    if (confirm(`Tem a certeza de que deseja remover o prédio "${nameStr}" do cadastro?`)) {
      try {
        const { error: deleteError } = await supabase
          .from('predios')
          .delete()
          .eq('id_predio', idPredio);

        if (deleteError) {
          alert(`Erro ao remover prédio no Supabase: ${deleteError.message}`);
          return;
        }

        // Regra 2: Depois de eliminar, atualizar a lista com select('*')
        const { data: prediosRestantes, error: readError } = await supabase
          .from('predios')
          .select('*');

        if (readError) {
          console.warn("[Supabase] Aviso ao ler predios:", readError.message);
        }

        if (onDeletePredio) {
          onDeletePredio(idPredio);
        }
        limparFormulario();
        alert("✅ Prédio removido com sucesso do Supabase!");
      } catch (err: any) {
        alert(`Erro na ligação com o Supabase: ${err?.message || "Erro desconhecido"}`);
      }
    }
  };

  // Filter predios by search query
  const prediosFiltrados = predios.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nomeStr = (p.nome || "").toLowerCase();
    const moradaStr = (p.morada_linha1 || "").toLowerCase();
    const nifStr = (p.nif || "").toLowerCase();
    const cpStr = (p.codigo_postal || "").toLowerCase();
    const locStr = (p.localidade || "").toLowerCase();
    return nomeStr.includes(q) || moradaStr.includes(q) || nifStr.includes(q) || cpStr.includes(q) || locStr.includes(q);
  });

  const predioAtivo = predios.find(p => p.id_predio === selectedPredioId) || predios[0];
  const prefixoCodigoIniciais = extrairIniciaisCodigoPredio(predioAtivo);

  return (
    <div className="space-y-6">
      {/* Dynamic Sub-Menu Top Banner */}
      <div className="bg-white text-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center font-bold">
            {mainTab === "chaves" ? (
              <i className="fa-solid fa-key text-amber-500 text-lg"></i>
            ) : mainTab === "regras" ? (
              <img src="/modulos/03-regras-do-predio.png" alt="Regras" className="h-7 w-7 object-contain" />
            ) : (
              <img src="/modulos/01-predio.png" alt="Prédio" className="h-7 w-7 object-contain" />
            )}
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-slate-800">
              {mainTab === "chaves" ? "Gestão de Chaves" : mainTab === "regras" ? "Regras & Regulamento Automático (IA)" : "Registos & Património do Prédio"}
            </h2>
            <p className="text-xs text-slate-500">
              {mainTab === "chaves" 
                ? "Controlo de chaveiro, numeração codificada (Iniciais + Nº do Prédio), atribuição de local e etiquetas em PDF (3x1.5cm)." 
                : mainTab === "regras" 
                ? "Normas de convivência do condomínio, aprovação em Assembleia e validação automática de pretensões com IA." 
                : "Ficha de registo cadastral, morada, NIF, IBAN e caracterização do património comum do edifício."}
            </p>
          </div>
        </div>
      </div>

      {mainTab === "chaves" ? (
        !["ADMIN", "EMPRESA_GESTORA", "GESTOR"].includes(loggedUser.role) ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-4 animate-fadeIn">
            <div className="h-14 w-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-xl">
              <i className="fa-solid fa-lock"></i>
            </div>
            <h3 className="text-base font-extrabold text-slate-800">Acesso Restrito - Gestão de Chaves</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              A gestão de chaves é de acesso exclusivo para os perfis de <strong>Administrador</strong> e <strong>Gestor de Condomínio</strong>.
            </p>
          </div>
        ) : (
        <div className="space-y-6 animate-fadeIn">
          {/* CARTÃO: CHAVEIRO PRINCIPAL & CONJUNTO DE CHAVES */}
          <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                  <i className="fa-solid fa-key text-lg"></i>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Chaveiro Principal (Etiqueta Verde)
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                      Nº Chaveiro: {numChaveiroMaster || "1"}
                    </span>
                  </div>
                  <h4 className="text-base font-extrabold mt-0.5 text-slate-900 dark:text-white">
                    {identificacaoConjuntoCustom || `Conjunto Geral de Chaves - ${predioAtivo?.nome || "Edifício"}`}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const masterCode = codigoConjuntoCustom || `${prefixoCodigoIniciais}-CHV-01`;
                    const masterIdent = identificacaoConjuntoCustom || `Conjunto Geral de Chaves - ${predioAtivo?.nome || "Edifício"}`;
                    gerarPdfEtiquetasChaves(predioAtivo?.nome || "Edifício Principal", chaves, {
                      numChaveiro: numChaveiroMaster || "1",
                      codigoConjunto: masterCode,
                      identificacaoConjunto: masterIdent
                    });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center space-x-2 cursor-pointer shrink-0"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>Imprimir Etiquetas</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Código Master do Conjunto</label>
                <input
                  type="text"
                  value={codigoConjuntoCustom}
                  onChange={e => setCodigoConjuntoCustom(e.target.value)}
                  placeholder={`Ex: ${prefixoCodigoIniciais}-CHV-01`}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">Identificação do Conjunto de Chaves</label>
                <input
                  type="text"
                  value={identificacaoConjuntoCustom}
                  onChange={e => setIdentificacaoConjuntoCustom(e.target.value)}
                  placeholder={`Ex: Conjunto Geral de Chaves e Acessos Comuns - ${predioAtivo?.nome || "Edifício"}`}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 font-medium text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Resumo de Chaves Integradas no Conjunto */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mr-1">Resumo de Chaves no Conjunto ({chaves.length}):</span>
              {chaves.slice(0, 7).map(c => (
                <span key={c.id_chave} className="text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-mono">
                  <strong className="text-emerald-700 dark:text-emerald-400">{c.codigo_chave}</strong>: {c.area_nome}
                </span>
              ))}
              {chaves.length > 7 && (
                <span className="text-[10px] text-slate-500 dark:text-slate-400 italic font-semibold">
                  +{chaves.length - 7} mais...
                </span>
              )}
            </div>
          </div>

          {/* Header & Actions */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                  <i className="fa-solid fa-key text-emerald-600"></i>
                  <span>Gestão de Chaves ({predioAtivo?.nome || "Edifício Principal"})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registo de chaveiro, numeração codificada por iniciais do prédio ({prefixoCodigoIniciais} XXX), atreladas ao local e prontas para impressão de etiquetas (3cm x 1.5cm).
                </p>
              </div>
            </div>

            {/* Form de Adicionar Nova Chave */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-2">
                <i className="fa-solid fa-plus-circle text-emerald-600"></i>
                Adicionar Nova Chave ao Chaveiro
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Local / Prédio Sugerido</label>
                  <select
                    value={novoLocalSugerido || predioAtivo?.nome || ""}
                    onChange={e => setNovoLocalSugerido(e.target.value)}
                    className="w-full border border-slate-200 p-2 text-xs rounded-lg bg-white font-medium text-slate-800"
                  >
                    <option value="">-- Selecionar Perfil de Prédio --</option>
                    {predios.map(p => (
                      <option key={p.id_predio} value={p.nome || `${p.morada_linha1}, Nº ${p.num_porta}`}>
                        {p.nome || `${p.morada_linha1}, Nº ${p.num_porta}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Local / Porta / Aplicação *</label>
                  <input
                    type="text"
                    value={novaAreaChave}
                    onChange={e => setNovaAreaChave(e.target.value)}
                    placeholder="Ex: Porta Principal, Arrecadação Comum..."
                    className="w-full border border-slate-200 p-2 text-xs rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nº do Chaveiro *</label>
                  <input
                    type="text"
                    value={novoNumChaveiro}
                    onChange={e => setNovoNumChaveiro(e.target.value)}
                    placeholder="Ex: Chaveiro #1"
                    className="w-full border border-slate-200 p-2 text-xs rounded-lg bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Código / Numeração *</label>
                  <input
                    type="text"
                    value={novoCodigoChave}
                    onChange={e => setNovoCodigoChave(e.target.value)}
                    placeholder={`Ex: ${prefixoCodigoIniciais} ${String(chaves.length + 1).padStart(3, '0')}`}
                    className="w-full border border-slate-200 p-2 text-xs rounded-lg font-mono bg-white font-bold text-blue-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Qtd. Chaves *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={novaQtdChave}
                      onChange={e => setNovaQtdChave(Number(e.target.value))}
                      className="w-full border border-slate-200 p-2 text-xs rounded-lg bg-white font-mono text-center font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!novaAreaChave.trim()) return alert("Insira o nome do local/porta para a chave!");
                        const codigoAuto = novoCodigoChave.trim() || `${prefixoCodigoIniciais} ${String(chaves.length + 1).padStart(3, '0')}`;
                        const localAuto = novoLocalSugerido || predioAtivo?.nome || "Edifício Principal";
                        const nova: ChaveItem = {
                          id_chave: "chv-" + Date.now(),
                          id_predio: selectedPredioId || "predio-1",
                          area_nome: novaAreaChave,
                          codigo_chave: codigoAuto,
                          num_chaveiro: novoNumChaveiro || "1",
                          local_sugerido: localAuto,
                          quantidade: novaQtdChave || 1,
                          no_claviculario: true,
                          observacoes: "Adicionada manualmente"
                        };
                        setChaves([...chaves, nova]);
                        setNovaAreaChave("");
                        setNovoCodigoChave("");
                        setNovoNumChaveiro("1");
                        setNovaQtdChave(2);
                        alert(`Chave com código "${codigoAuto}" registada na Gestão de Chaves com sucesso!`);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold shrink-0 cursor-pointer shadow-xs"
                    >
                      + Adicionar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de Chaves do Prédio */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-center w-12">Posse</th>
                    <th className="p-3">Local / Porta / Utilização</th>
                    <th className="p-3">Edifício / Local Sugerido</th>
                    <th className="p-3 w-32">Nº Chaveiro</th>
                    <th className="p-3 w-36">Código / Numeração</th>
                    <th className="p-3 w-24 text-center">Qtd. Chaves</th>
                    <th className="p-3">Observações / Detalhes</th>
                    <th className="p-3 text-center w-16">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chaves.map((chave, idx) => (
                    <tr key={chave.id_chave} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={chave.no_claviculario}
                          onChange={(e) => {
                            const updated = chaves.map(c => c.id_chave === chave.id_chave ? { ...c, no_claviculario: e.target.checked } : c);
                            setChaves(updated);
                          }}
                          className="h-4 w-4 text-emerald-600 rounded border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        <input
                          type="text"
                          value={chave.area_nome}
                          onChange={(e) => {
                            const updated = chaves.map(c => c.id_chave === chave.id_chave ? { ...c, area_nome: e.target.value } : c);
                            setChaves(updated);
                          }}
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 font-bold text-slate-800 text-xs py-0.5"
                        />
                      </td>
                      <td className="p-3 text-slate-600">
                        <select
                          value={chave.local_sugerido || predioAtivo?.nome || ""}
                          onChange={(e) => {
                            const updated = chaves.map(c => c.id_chave === chave.id_chave ? { ...c, local_sugerido: e.target.value } : c);
                            setChaves(updated);
                          }}
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 text-xs py-0.5 text-slate-700 font-medium"
                        >
                          {predios.map(p => (
                            <option key={p.id_predio} value={p.nome || `${p.morada_linha1}, Nº ${p.num_porta}`}>
                              {p.nome || `${p.morada_linha1}, Nº ${p.num_porta}`}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        <input
                          type="text"
                          value={chave.num_chaveiro || ""}
                          onChange={(e) => {
                            const updated = chaves.map(c => c.id_chave === chave.id_chave ? { ...c, num_chaveiro: e.target.value } : c);
                            setChaves(updated);
                          }}
                          placeholder="Ex: 1"
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 font-mono text-xs py-0.5 text-slate-700"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-900">
                        <input
                          type="text"
                          value={chave.codigo_chave}
                          onChange={(e) => {
                            const updated = chaves.map(c => c.id_chave === chave.id_chave ? { ...c, codigo_chave: e.target.value } : c);
                            setChaves(updated);
                          }}
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 font-mono text-xs py-0.5 font-bold text-blue-900"
                        />
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-700">
                        <input
                          type="number"
                          min="1"
                          value={chave.quantidade}
                          onChange={(e) => {
                            const updated = chaves.map(c => c.id_chave === chave.id_chave ? { ...c, quantidade: Number(e.target.value) } : c);
                            setChaves(updated);
                          }}
                          className="w-16 text-center bg-slate-50 border border-slate-200 rounded p-1 font-mono text-xs font-bold"
                        />
                      </td>
                      <td className="p-3 text-slate-600">
                        <input
                          type="text"
                          value={chave.observacoes || ""}
                          onChange={(e) => {
                            const updated = chaves.map(c => c.id_chave === chave.id_chave ? { ...c, observacoes: e.target.value } : c);
                            setChaves(updated);
                          }}
                          placeholder="Notas opcionais..."
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 text-xs py-0.5 text-slate-600"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remover a chave "${chave.area_nome}" do registo?`)) {
                              setChaves(chaves.filter(c => c.id_chave !== chave.id_chave));
                            }
                          }}
                          className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          title="Eliminar chave"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )
      ) : mainTab === "regras" ? (
        <div className="space-y-6 animate-fadeIn">
          {/* SECTION: Regras do Prédio Configurator & Approval Status */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            {/* Banner de Validação e Aprovação em Assembleia */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
              regumentoAprovado 
                ? "bg-emerald-50/80 border-emerald-200 text-emerald-900" 
                : "bg-amber-50/80 border-amber-200 text-amber-900"
            }`}>
              <div className="flex items-center space-x-3">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                  regumentoAprovado ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                }`}>
                  <i className={`fa-solid ${regumentoAprovado ? "fa-circle-check" : "fa-clock"}`}></i>
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider">
                    {regumentoAprovado ? "✓ Regulamento & Estatutos Aprovados em Assembleia" : "⏳ Regulamento PENDENTE DE APROVAÇÃO"}
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {regumentoAprovado 
                      ? "O Regulamento e Estatutos do Prédio foram APROVADOS e estão validados para anexar automaticamente ao e-mail de Boas-Vindas."
                      : "Regulamento em rascunho. Submeta à aprovação da Assembleia Geral antes de distribuir aos condóminos."
                    }
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!regumentoAprovado) {
                    if (confirm("Confirmar a APROVAÇÃO OFICIAL do Regulamento e Estatutos do Prédio em Assembleia Geral?\n\nAo aprovar, o documento será automaticamente anexado aos E-mails de Boas-Vindas aos novos condóminos.")) {
                      setRegumentoAprovado(true);
                      if (confirm("Regulamento e Estatutos Aprovados com Sucesso!\n\nDeseja enviar uma notificação por e-mail a TODOS os condóminos do edifício com a cópia do Regulamento Aprovado?")) {
                        alert("E-mail de notificação com Regulamento & Estatutos Aprovados enviado com sucesso a todos os condóminos!");
                      }
                    }
                  } else {
                    if (confirm("Deseja alterar o estado do Regulamento para PENDENTE DE APROVAÇÃO?")) {
                      setRegumentoAprovado(false);
                    }
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center space-x-2 shrink-0 ${
                  regumentoAprovado 
                    ? "bg-slate-200 hover:bg-slate-300 text-slate-800" 
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                <i className={`fa-solid ${regumentoAprovado ? "fa-pen-to-square" : "fa-check-double"}`}></i>
                <span>{regumentoAprovado ? "Marcar como Pendente" : "Aprovar & Notificar Condóminos"}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
                  <i className="fa-solid fa-gavel text-indigo-600"></i>
                  <span>Regulamento Automático do Condomínio ({nome || "Edifício Principal"})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Defina as normas do condomínio por tema. A Inteligência Artificial utiliza estas regras para validar automaticamente os pedidos dos condóminos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => alert("Regulamento do Prédio atualizado com sucesso e sincronizado com o motor de validação da IA!")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center space-x-2 shrink-0"
              >
                <i className="fa-solid fa-floppy-disk"></i>
                <span>Guardar Regulamento</span>
              </button>
            </div>

            {/* 6 Category Rules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* 1. Silêncio */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm">
                  <i className="fa-solid fa-volume-xmark text-amber-500"></i>
                  <span>1. Regras de Silêncio</span>
                </div>
                <textarea
                  rows={3}
                  value={regras.silencio}
                  onChange={e => setRegras({ ...regras, silencio: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-sans"
                />
              </div>

              {/* 2. Animais */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm">
                  <i className="fa-solid fa-dog text-emerald-500"></i>
                  <span>2. Regras de Animais</span>
                </div>
                <textarea
                  rows={3}
                  value={regras.animais}
                  onChange={e => setRegras({ ...regras, animais: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-sans"
                />
              </div>

              {/* 3. Obras */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm">
                  <i className="fa-solid fa-hammer text-blue-500"></i>
                  <span>3. Regras de Obras</span>
                </div>
                <textarea
                  rows={3}
                  value={regras.obras}
                  onChange={e => setRegras({ ...regras, obras: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-sans"
                />
              </div>

              {/* 4. Estacionamento */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm">
                  <i className="fa-solid fa-square-parking text-sky-500"></i>
                  <span>4. Regras de Estacionamento</span>
                </div>
                <textarea
                  rows={3}
                  value={regras.estacionamento}
                  onChange={e => setRegras({ ...regras, estacionamento: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-sans"
                />
              </div>

              {/* 5. Lixo */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm">
                  <i className="fa-solid fa-trash-can text-teal-500"></i>
                  <span>5. Regras de Lixo & Resíduos</span>
                </div>
                <textarea
                  rows={3}
                  value={regras.lixo}
                  onChange={e => setRegras({ ...regras, lixo: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-sans"
                />
              </div>

              {/* 6. Áreas Comuns */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-sm">
                  <i className="fa-solid fa-people-roof text-violet-500"></i>
                  <span>6. Regras de Áreas Comuns</span>
                </div>
                <textarea
                  rows={3}
                  value={regras.areasComuns}
                  onChange={e => setRegras({ ...regras, areasComuns: e.target.value })}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-indigo-500 font-sans"
                />
              </div>
            </div>
          </div>

          {/* SECTION: Validador IA Automático de Pedidos */}
          <div className="bg-white text-slate-800 p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
                  <i className="fa-solid fa-robot"></i>
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800">Validador Automático de Pedidos com IA</h4>
                  <p className="text-xs text-slate-500">Submeta um pedido de condómino para a IA analisar a conformidade regulamentar em tempo real.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPedidoTexto("Quero fazer obras de remodelação na casa de banho no próximo domingo às 10h.")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-medium cursor-pointer"
                >
                  Exemplo 1 (Obras no Domingo)
                </button>
                <button
                  type="button"
                  onClick={() => setPedidoTexto("Gostaria de reservar a Sala Comum para um almoço de aniversário no próximo sábado das 13h às 17h para 10 pessoas.")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-medium cursor-pointer"
                >
                  Exemplo 2 (Reserva de Sala)
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <textarea
                rows={3}
                value={pedidoTexto}
                onChange={e => setPedidoTexto(e.target.value)}
                placeholder="Exemplo: 'Pretendo ter um cão de médio porte e colocá-lo a solta no pátio comum...' ou 'Quero fazer uma festa na piscina com música às 24h...'"
                className="w-full text-xs p-3 bg-slate-800 border border-slate-700 text-slate-100 rounded-xl focus:outline-violet-500 font-sans"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleValidarPedidoIA}
                  disabled={validandoPedido}
                  className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center space-x-2"
                >
                  {validandoPedido ? (
                    <>
                      <i className="fa-solid fa-spinner animate-spin"></i>
                      <span>A Analisar Regulamento...</span>
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      <span>Validar Pedido com IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {resultadoValidacao && (
              <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-slate-400">Resultado da Análise Regulamentar</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center space-x-1.5 ${
                    resultadoValidacao.decisao === "Aprovado"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : resultadoValidacao.decisao === "Aprovado com Condições"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}>
                    <i className={`fa-solid ${
                      resultadoValidacao.decisao === "Aprovado" ? "fa-circle-check" : resultadoValidacao.decisao === "Aprovado com Condições" ? "fa-circle-exclamation" : "fa-circle-xmark"
                    }`}></i>
                    <span>{resultadoValidacao.decisao}</span>
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-300">Regras do Prédio Aplicadas:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {resultadoValidacao.regrasAplicadas.map((r, idx) => (
                      <span key={idx} className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[11px] font-mono">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="font-bold text-slate-300 block">Fundamentação:</span>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
                    {resultadoValidacao.motivos.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-violet-950/40 border border-violet-800/50 rounded-lg text-xs text-violet-200 flex items-start space-x-2">
                  <i className="fa-solid fa-lightbulb text-amber-400 mt-0.5"></i>
                  <div>
                    <span className="font-bold block">Parecer Automático da IA:</span>
                    <span>{resultadoValidacao.recomendacaoIA}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* SECÇÃO 1: LISTA DE PRÉDIOS E FILTRO DINÂMICO DE PESQUISA */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-building text-blue-600"></i>
              <span>Registo de Prédios</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Lista de edifícios registados no sistema. Selecione um prédio para visualizar, editar ou remover.
            </p>
          </div>

          <button
            type="button"
            onClick={limparFormulario}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center space-x-1.5 shrink-0 self-start md:self-auto"
          >
            <i className="fa-solid fa-plus-circle"></i>
            <span>Registar Novo Prédio</span>
          </button>
        </div>

        {/* Filtro dinâmico de pesquisa */}
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-sm"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar prédio por nome, morada, NIF, código postal ou localidade..."
            className="w-full bg-slate-50 border border-slate-200 pl-10 pr-10 py-2.5 text-xs rounded-xl focus:outline-none focus:border-blue-500 font-medium text-slate-800"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>

        {/* Lista de Prédios (Lista Tabela e não em Cards) */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 uppercase font-black tracking-wider text-[10px]">
                  <th className="py-3 px-4">Edifício / Foto</th>
                  <th className="py-3 px-4">Morada & Localidade</th>
                  <th className="py-3 px-4">NIF</th>
                  <th className="py-3 px-4">E-mail Oficial (IA / Autoresponder)</th>
                  <th className="py-3 px-4">Património Comum</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prediosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <i className="fa-solid fa-building-circle-exclamation text-2xl mb-2 block"></i>
                      Nenhum prédio encontrado com os critérios de pesquisa.
                    </td>
                  </tr>
                ) : (
                  prediosFiltrados.map((p) => {
                    const isSelected = selectedPredioId === p.id_predio;
                    const displayName = p.nome || `${p.morada_linha1}, Nº ${p.num_porta}`;

                    return (
                      <tr
                        key={p.id_predio}
                        onClick={() => setSelectedPredioId(p.id_predio)}
                        className={`transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-50/80 font-semibold text-slate-900 border-l-4 border-l-blue-600"
                            : "hover:bg-slate-50/80 text-slate-700"
                        }`}
                      >
                        {/* Foto & Nome */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            {p.foto ? (
                              <img
                                src={p.foto}
                                alt={displayName}
                                className="h-10 w-12 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="h-10 w-12 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 border border-slate-700">
                                <i className="fa-solid fa-building text-base"></i>
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-slate-800 text-xs">{displayName}</p>
                              <span className="text-[10px] text-slate-400 font-mono-custom">ID: {p.id_predio}</span>
                            </div>
                          </div>
                        </td>

                        {/* Morada */}
                        <td className="py-3 px-4 space-y-0.5">
                          <p className="text-slate-800 font-medium">
                            <i className="fa-solid fa-location-dot text-slate-400 mr-1.5 text-[10px]"></i>
                            {p.morada_linha1} Nº{p.num_porta} {p.letra_porta ? `(${p.letra_porta})` : ""}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono-custom pl-4">
                            {p.codigo_postal} {p.localidade}
                          </p>
                        </td>

                        {/* NIF */}
                        <td className="py-3 px-4 font-mono-custom font-bold text-slate-700">
                          {p.nif}
                        </td>

                        {/* E-mail Oficial & Autoresponder */}
                        <td className="py-3 px-4">
                          {p.email ? (
                            <div className="space-y-1">
                              <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                <i className="fa-solid fa-envelope text-[11px]"></i>
                                {p.email}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                <i className="fa-solid fa-robot text-[8px]"></i> Autoresponder Ativo
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Não configurado</span>
                          )}
                        </td>

                        {/* Património */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {p.patrimonio?.tem_elevador && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
                                🛗 {p.patrimonio.num_elevadores || 1} Elevador
                              </span>
                            )}
                            {p.patrimonio?.tem_garagem && (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
                                🅿️ Garagem
                              </span>
                            )}
                            {p.patrimonio?.tem_piscina && (
                              <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
                                🏊 Piscina
                              </span>
                            )}
                            {p.patrimonio?.tem_sala_comum && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded font-medium">
                                👥 Sala Comum
                              </span>
                            )}
                            {!p.patrimonio?.tem_elevador && !p.patrimonio?.tem_garagem && !p.patrimonio?.tem_piscina && !p.patrimonio?.tem_sala_comum && (
                              <span className="text-slate-400 text-[11px] font-normal">Básico</span>
                            )}
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPredioId(p.id_predio);
                              }}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                                isSelected
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              }`}
                            >
                              <i className="fa-solid fa-pen-to-square"></i>
                              <span>{isSelected ? "Em Edição" : "Editar"}</span>
                            </button>

                            {loggedUser.role === "ADMIN" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoverPredio(p.id_predio);
                                }}
                                className="px-2 py-1 rounded-md bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 hover:border-red-600 text-[11px] font-bold transition-all cursor-pointer"
                                title="Remover Prédio"
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECÇÃO 2: FORMULÁRIO DE CADASTRO / EDIÇÃO / REMOÇÃO DO PRÉDIO SELECIONADO */}
      <form onSubmit={submeterForm} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <i className={`fa-solid ${selectedPredioId ? "fa-pen-to-square text-blue-600" : "fa-plus-circle text-emerald-600"}`}></i>
              <span>{selectedPredioId ? `Editar Registo do Prédio: ${nome || "Sem Nome"}` : "Registar Novo Prédio Administrado"}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedPredioId ? "Altere os dados gerais e patrimonio comum do edifício selecionado." : "Preencha as informações necessárias para registar um novo edifício."}
            </p>
          </div>

          {selectedPredioId && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={limparFormulario}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              >
                <i className="fa-solid fa-xmark mr-1"></i> Cancelar Edição
              </button>

              {loggedUser.role === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => handleRemoverPredio(selectedPredioId)}
                  className="border-2 border-red-500 bg-red-50 hover:bg-red-100 active:bg-red-200 active:scale-95 text-red-700 font-bold px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer shadow-xs hover:shadow-md active:ring-2 active:ring-red-400 select-none flex items-center gap-1.5"
                  title="Eliminar este prédio do sistema"
                >
                  <img src="/estados-acoes/14-eliminar.png" alt="Eliminar" className="h-4 w-4 object-contain" />
                  <span>Eliminar</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-500 mb-1">Nome do Edifício (Facultativo)</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Se vazio, usa a morada" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-blue-500" />
          </div>
          <div className="flex flex-col col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1">Morada Linha 1 *</label>
            <input type="text" value={moradaLinha1} onChange={e => setMoradaLinha1(e.target.value)} placeholder="Rua Bento Rodrigues" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-500 mb-1">Morada Linha 2</label>
            <input type="text" value={moradaLinha2} onChange={e => setMoradaLinha2(e.target.value)} placeholder="Ex: Apt 2B" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-blue-500" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-500 mb-1">Nº Porta *</label>
            <input type="text" value={numPorta} onChange={e => setNumPorta(e.target.value)} placeholder="Ex: 2" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-blue-500" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-500 mb-1">Letra (Facultativo)</label>
            <input type="text" value={letraPorta} onChange={e => setLetraPorta(e.target.value)} placeholder="Ex: A" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-blue-500" />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-500 mb-1">NIF do Condomínio *</label>
            <input type="text" value={nif} onChange={e => setNif(e.target.value)} placeholder="Ex: 900123456" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-blue-500 font-mono-custom" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-500 mb-1">Código Postal (Interativo) *</label>
            <input type="text" value={codigoPostal} onChange={e => setCodigoPostal(e.target.value)} placeholder="Ex: 2840-124 (para teste)" className="border border-slate-200 px-3 py-2 text-sm rounded-lg focus:outline-blue-500 font-mono-custom" />
            <p className="text-[10px] text-slate-400 mt-1">Insira '2840-124' ou '2775-245' para autocompletar.</p>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-500 mb-1">Localidade *</label>
            <input type="text" value={localidade} readOnly className="border border-slate-200 bg-slate-100 px-3 py-2 text-sm rounded-lg focus:outline-none" placeholder="Preenchimento automático" />
          </div>
        </div>

        {/* E-MAIL OFICIAL DO PRÉDIO / RESPOSTA OBRIGATÓRIA */}
        <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-2">
              <i className="fa-solid fa-envelope text-emerald-600"></i>
              <span>E-mail Oficial do Prédio *</span>
            </label>
            <span className="text-[10px] font-bold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
              Obrigatório • Respostas & IA
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Insira o e-mail oficial do condomínio (pode ser o e-mail da empresa gestora onde recebem toda a informação e comunicações referentes a este prédio). A Inteligência Artificial (Google AI Studio) e o Autoresponder utilizarão este canal para ler as solicitações dos condóminos, associar comprovativos/faturas, consultar o histórico da fração e responder autonomamente com precisão.
          </p>
          <div className="relative">
            <i className="fa-solid fa-at absolute left-3.5 top-3 text-emerald-600 text-sm"></i>
            <input
              type="email"
              required
              value={emailPredio}
              onChange={e => setEmailPredio(e.target.value)}
              placeholder={`Ex: ${nome ? nome.toLowerCase().replace(/[^a-z0-9]/g, ".") : "edificio"}.${codigoPostal ? codigoPostal.split("-")[0] : "condo"}@gestaocondominios.pt`}
              className="w-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Upload de Fotografia do Prédio */}
        <div className="pt-2">
          <label className="text-xs font-semibold text-slate-500 block mb-1">Fotografia do Prédio (Opcional)</label>
          <div className="flex items-center space-x-3">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-200 flex items-center space-x-2 cursor-pointer">
              <i className="fa-solid fa-camera"></i>
              <span>Carregar Foto (WebP Convert)</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={processarImagemPredio} className="hidden" />
            {foto && (
              <div className="flex items-center space-x-2">
                <img src={foto} className="h-10 w-10 rounded object-cover border border-slate-300" referrerPolicy="no-referrer" />
                <span className="text-xs text-slate-500 font-medium font-mono-custom">Carregada</span>
                <button type="button" onClick={() => setFoto(null)} className="text-red-500 text-xs hover:underline cursor-pointer"><i className="fa-solid fa-trash"></i></button>
              </div>
            )}
          </div>
        </div>

        {/* Checklist de Ativação do Património Comum */}
        <div className="pt-2 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-600 block mb-3 uppercase tracking-wider">Património Comum (Ativação Dinâmica de Módulos)</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 font-semibold text-slate-700">
            <label className="flex items-center space-x-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={elevador} onChange={e => setElevador(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-slate-300" />
              <span>Elevadores</span>
            </label>
            {elevador && (
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-mono-custom">Qtd:</span>
                <input type="number" min="1" value={numElevadores} onChange={e => setNumElevadores(Number(e.target.value))} className="border border-slate-200 px-2 py-1 text-xs rounded w-16 focus:outline-blue-500 font-mono-custom" />
              </div>
            )}
            <label className="flex items-center space-x-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={garagem} onChange={e => setGaragem(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-slate-300" />
              <span>Garagem Comum</span>
            </label>
            <label className="flex items-center space-x-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={piscina} onChange={e => setPiscina(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-slate-300" />
              <span>Piscina</span>
            </label>
            <label className="flex items-center space-x-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={salaComum} onChange={e => setSalaComum(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-slate-300" />
              <span>Sala Comum / Reuniões</span>
            </label>
            <label className="flex items-center space-x-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={arrecadacoes} onChange={e => setArrecadacoes(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-slate-300" />
              <span>Arrecadações Comuns</span>
            </label>
            <label className="flex items-center space-x-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={jardins} onChange={e => setJardins(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-slate-300" />
              <span>Jardins/Espaços Verdes</span>
            </label>
            <label className="flex items-center space-x-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={churrasqueira} onChange={e => setChurrasqueira(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-slate-300" />
              <span>Churrasqueira</span>
            </label>
            <label className="flex items-center space-x-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={terraco} onChange={e => setTerraco(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-slate-300" />
              <span>Terraço</span>
            </label>
            <label className="flex items-center space-x-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={ginasio} onChange={e => setGinasio(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-slate-300" />
              <span>Ginásio</span>
            </label>
            <label className="flex items-center space-x-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={spa} onChange={e => setSpa(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-slate-300" />
              <span>Spa</span>
            </label>
            <label className="flex items-center space-x-2.5 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={wcPiscina} onChange={e => setWcPiscina(e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-slate-300" />
              <span>WC Piscina</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={limparFormulario}
            className="border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center gap-2 select-none"
            title="Cancelar edição e voltar à lista de prédios"
          >
            <i className="fa-solid fa-xmark text-slate-500"></i>
            <span>Cancelar Edição</span>
          </button>

          <button
            type="submit"
            className="border-2 border-emerald-500 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-md hover:shadow-lg active:ring-2 active:ring-emerald-400 select-none flex items-center gap-2"
            title="Guardar dados do prédio no sistema"
          >
            <img 
              src="/estados-acoes/12-adicionar.png" 
              alt="Guardar" 
              className="h-5 w-5 object-contain" 
            />
            <span>Guardar</span>
          </button>
        </div>
      </form>
        </>
      )}
    </div>
  );
}
