import * as React from 'react';

import { IPremissasHH } from '../../services/hh/modeloHH';

import {
  COR,
  EntradaNumero,
  Secao,
  Tabela,
  campo,
  horas,
  numero,
  pct,
  td
} from './hhComum';

import { ISecaoHHProps } from './tiposTela';

// ============================================================
// HH — PREMISSAS (aba "Premissas")
// ============================================================

type ChaveNum = { [K in keyof IPremissasHH]: IPremissasHH[K] extends number ? K : never }[keyof IPremissasHH];

interface ICampoPremissa {
  chave: ChaveNum;
  rotulo: string;
  ajuda: string;
  percentual?: boolean;
}

const BASICAS: ICampoPremissa[] = [
  { chave: 'diasUteis', rotulo: 'Dias úteis no mês', ajuda: 'Padrão de 21 dias, o mesmo em todas as áreas.' },
  { chave: 'jornadaDiaria', rotulo: 'Jornada diária (h)', ajuda: '08:48 h = 8,8. Usada para ratear o dia lançado dos internos.' },
  { chave: 'horasMes', rotulo: 'Horas trabalhadas por colaborador/mês (padrão RH)', ajuda: 'Aba "Média HH" do RH.' },
  { chave: 'produtividade', rotulo: 'Produtividade (horas efetivamente produtivas)', ajuda: 'Parcela das horas que vira trabalho produtivo.', percentual: true },
  { chave: 'fatorEncargos', rotulo: 'Fator de encargos sobre salário', ajuda: 'Total com encargos ÷ salário.' },
  { chave: 'periculosidade', rotulo: 'Adicional de periculosidade', ajuda: 'Aplicado aos internos marcados com periculosidade.', percentual: true },
  { chave: 'mesesDiluicao', rotulo: 'Meses para diluir itens de compra única (1º mês)', ajuda: 'Notebook, ferramental, EPI...' },
  { chave: 'headcountInterno', rotulo: 'Headcount interno da área (quadro P.O.)', ajuda: 'Posições do quadro.' },
  { chave: 'hhReferenciaRh', rotulo: 'HH de referência do RH, aba "Média HH" (R$/h)', ajuda: 'Só para comparação.' }
];

const CAMPO: ICampoPremissa[] = [
  { chave: 'pessoasEquipeCampo', rotulo: 'Pessoas na equipe de campo', ajuda: 'Ex.: dupla de técnicos = 2.' },
  { chave: 'pontosPorDia', rotulo: 'Pontos/localidades atendidos por dia (por equipe)', ajuda: 'Média informada pela área.' }
];

const BOM: ICampoPremissa[] = [
  { chave: 'pctAnalista', rotulo: '% do custo total para horas do Analista de Projetos', ajuda: 'Regra de alocação de horas no projeto.', percentual: true },
  { chave: 'valorHoraAnalista', rotulo: 'Valor-hora do Analista de Projetos (R$/h)', ajuda: 'O valor alocado é dividido por este valor.' },
  { chave: 'pctSuprimentos', rotulo: '% do custo total para Suprimentos', ajuda: 'Regra de alocação de horas no projeto.', percentual: true },
  { chave: 'valorHoraSuprimentos', rotulo: 'Valor-hora de Suprimentos (R$/h)', ajuda: 'O valor alocado é dividido por este valor.' },
  { chave: 'custoTotalProjeto', rotulo: 'Custo total do projeto (B.O.M) (R$) — simulação', ajuda: 'Opcional: para ver as horas alocadas no Resumo. No B.O.M. vem do projeto.' },
  { chave: 'valorMedioBomPonto', rotulo: 'Valor médio do B.O.M por ponto/localidade (R$)', ajuda: 'Opcional: base do % real no Resumo.' }
];

const PremissasHH: React.FC<ISecaoHHProps> = ({ dados, resultado, editavel, mudar }) => {
  const p = dados.premissas;
  const mudarP = (parcial: Partial<IPremissasHH>): void => mudar(d => ({ ...d, premissas: { ...d.premissas, ...parcial } }));

  const linhas = (lista: ICampoPremissa[]): React.ReactNode => lista.map(c => (
    <tr key={c.chave}>
      <td style={td()}>{c.rotulo}</td>
      <td style={td(true)}>
        <EntradaNumero valor={p[c.chave] as number} percentual={c.percentual} desabilitado={!editavel} rotulo={c.rotulo} aoMudar={v => mudarP({ [c.chave]: v || 0 } as Partial<IPremissasHH>)} />
      </td>
      <td style={td(false, { color: COR.texto2, fontSize: '13px' })}>{c.ajuda}</td>
    </tr>
  ));

  const calculada = (rotulo: string, valor: string, como: string): React.ReactNode => (
    <tr>
      <td style={td()}>{rotulo}</td>
      <td style={td(true, { fontWeight: 600 })}>{valor}</td>
      <td style={td(false, { color: COR.texto2, fontSize: '13px' })}>{como}</td>
    </tr>
  );

  const COLS = [{ titulo: 'Premissa' }, { titulo: 'Valor', direita: true, largura: '190px' }, { titulo: 'Fonte / observação' }];
  const temApoio = !!dados.apoio;

  return (
    <div>
      <Secao titulo="Premissas da área" subtitulo="Campos em azul-claro são editáveis; os demais são calculados.">
        <Tabela colunas={COLS}>
          <tr>
            <td style={td()}>Mês de referência</td>
            <td style={td(true)}>
              <select aria-label="Mês de referência" value={p.mesReferencia} disabled={!editavel} onChange={e => mudarP({ mesReferencia: e.target.value })} style={{ ...campo, width: '120px', minHeight: '32px', padding: '4px 8px', background: COR.cianoClaro }}>
                {dados.meses.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </td>
            <td style={td(false, { color: COR.texto2, fontSize: '13px' })}>Base dos indicadores do mês e do custo da área.</td>
          </tr>
          {linhas(BASICAS.slice(0, 2))}
          {calculada('Horas disponíveis por colaborador no mês (h)', horas(resultado.premissas.horasDisponiveis), 'Dias úteis × jornada.')}
          {linhas(BASICAS.slice(2, 4))}
          {calculada('Horas produtivas por colaborador/mês', horas(resultado.premissas.horasProdutivas), 'Horas trabalhadas × produtividade. Base de todos os HH.')}
          {linhas(BASICAS.slice(4, 8))}
          <tr>
            <td style={td()}>Terceiros incluídos no HH</td>
            <td style={td(true)}>
              {p.terceirosOrigem === 'equipe' && temApoio
                ? <strong>{numero(resultado.premissas.terceiros)}</strong>
                : <EntradaNumero valor={p.terceirosManual} desabilitado={!editavel} rotulo="Terceiros" aoMudar={v => mudarP({ terceirosManual: v || 0 })} />}
            </td>
            <td style={td(false, { color: COR.texto2, fontSize: '13px' })}>
              {temApoio
                ? (
                  <label style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                    <input type="checkbox" disabled={!editavel} checked={p.terceirosOrigem === 'equipe'} onChange={e => mudarP({ terceirosOrigem: e.target.checked ? 'equipe' : 'manual' })} />
                    Contar na equipe de apoio (terceiros com “Inclui no HH”)
                  </label>
                )
                : 'Terceiros cujo custo entra na área.'}
            </td>
          </tr>
          {calculada('Headcount total considerado', numero(resultado.premissas.headcountTotal), 'Internos + terceiros.')}
          {linhas(BASICAS.slice(8))}
        </Tabela>
      </Secao>

      <Secao titulo="Equipe de campo e ponto/localidade">
        <Tabela colunas={COLS}>{linhas(CAMPO)}</Tabela>
      </Secao>

      <Secao titulo="Regra de alocação de horas no projeto e parâmetros do B.O.M">
        <Tabela colunas={COLS}>
          {linhas(BOM.slice(0, 4))}
          {calculada('% total aplicado no B.O.M', pct(resultado.premissas.pctTotal, 2), '% Analista de Projetos + % Suprimentos.')}
          {linhas(BOM.slice(4))}
        </Tabela>
      </Secao>

      <Secao titulo="Headcount por mês" subtitulo="Pessoas que geraram o custo do mês. Vazio = headcount total considerado; digite por cima o real do mês, se houver.">
        <Tabela colunas={[{ titulo: 'Mês' }, { titulo: 'Headcount', direita: true, largura: '190px' }, { titulo: 'Considerado', direita: true }]} minimo="420px">
          {dados.meses.map(m => (
            <tr key={m}>
              <td style={td()}>{m}</td>
              <td style={td(true)}>
                <EntradaNumero vazioPermitido valor={dados.headcountMes[m]} desabilitado={!editavel} rotulo={`Headcount ${m}`} aoMudar={v => mudar(d => ({ ...d, headcountMes: { ...d.headcountMes, [m]: v } }))} />
              </td>
              <td style={td(true, { color: COR.texto2 })}>{numero(resultado.premissas.headcountMes[m])}</td>
            </tr>
          ))}
        </Tabela>
      </Secao>
    </div>
  );
};

export default PremissasHH;
