// ============================================================
// PADRÃO VISUAL DGT — tokens para estilos inline
//
// Os valores reais ficam em PortalTreinamentos.module.scss (.portal).
// Aqui cada token aponta para a variável CSS com um valor de reserva,
// para o componente continuar correto mesmo fora do .portal.
//
// Uso:
//   import { T } from '../../constants/designTokens';
//   <div style={{ color: T.texto2, padding: T.esp4 }} />
//
// Regras rápidas:
//   • Texto secundário: T.texto2 (nunca T.texto3 em texto pequeno).
//   • Ciano: só sobre fundo escuro ou como borda/marcador.
//     Sobre branco, use T.cianoTexto.
//   • Links e "precisa de atenção": T.indigo.
//   • Tamanho mínimo de texto: 12px (T.fsLegenda).
// ============================================================

const v = (nome: string, reserva: string): string =>
  `var(--dgt-${nome}, ${reserva})`;

export const T = {
  // Marca
  azul: v('azul', '#202A44'),
  azulEscuro: v('azul-escuro', '#161D30'),
  azulClaro: v('azul-claro', '#EDF0F5'),
  ciano: v('ciano', '#05C3DD'),
  cianoTexto: v('ciano-texto', '#0E7C8C'),
  cianoClaro: v('ciano-claro', '#E6F9FC'),
  indigo: v('indigo', '#485CC7'),
  indigoClaro: v('indigo-claro', '#E8EAF8'),

  // Neutros
  texto: v('texto', '#202A44'),
  texto2: v('texto-2', '#5E6470'),
  texto3: v('texto-3', '#888B8D'),
  fundo: v('fundo', '#F4F6F9'),
  superficie: v('superficie', '#FFFFFF'),
  superficie2: v('superficie-2', '#F8FAFC'),
  linha: v('linha', '#D9D9D6'),
  linhaSuave: v('linha-suave', '#EDF0F5'),

  // Estados
  sucesso: v('sucesso', '#13795B'),
  sucessoClaro: v('sucesso-claro', '#E7F6EC'),
  alerta: v('alerta', '#B45309'),
  alertaClaro: v('alerta-claro', '#FFF4E5'),
  erro: v('erro', '#B42318'),
  erroClaro: v('erro-claro', '#FDE7E9'),
  info: v('info', '#485CC7'),
  infoClaro: v('info-claro', '#E8EAF8'),

  // Tipografia
  fonte: v('fonte', "Barlow, 'Segoe UI', Arial, sans-serif"),
  fsLegenda: v('fs-legenda', '12px'),
  fsDenso: v('fs-denso', '13px'),
  fsCorpo: v('fs-corpo', '14px'),
  fsPainel: v('fs-painel', '16px'),
  fsSecao: v('fs-secao', '20px'),
  fsPagina: v('fs-pagina', '24px'),
  fsDestaque: v('fs-destaque', '30px'),

  // Espaçamento (base 4)
  esp1: v('esp-1', '4px'),
  esp2: v('esp-2', '8px'),
  esp3: v('esp-3', '12px'),
  esp4: v('esp-4', '16px'),
  esp5: v('esp-5', '20px'),
  esp6: v('esp-6', '24px'),
  esp8: v('esp-8', '32px'),

  // Forma e elevação
  raioControle: v('raio-controle', '6px'),
  raioCartao: v('raio-cartao', '10px'),
  raioPilula: v('raio-pilula', '999px'),
  sombra1: v('sombra-1', '0 1px 2px rgba(32, 42, 68, .06)'),
  sombra2: v('sombra-2', '0 4px 14px rgba(32, 42, 68, .10)'),
  controleAltura: v('controle-altura', '36px')
};

export type TokenDgt = keyof typeof T;

export default T;
