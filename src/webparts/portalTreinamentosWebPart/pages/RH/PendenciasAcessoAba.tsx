import * as React from 'react';

import { AreaAdminService, IAreaAdmin } from '../../services/AreaAdminService';
import { DataverseService, IDataverseRecord } from '../../services/DataverseService';

const TABELA = 'dgt_rh_pendenciaacesso';
const ID = 'dgt_rh_pendenciaacessoid';
const CAMPOS = [ID, 'dgt_name', 'dgt_rh_email', 'dgt_rh_areaid', 'dgt_rh_areanome', 'dgt_rh_solicitadoem'];

const texto = (r: IDataverseRecord, campo: string): string => String(r[campo] ?? '');
const normalizarEmail = (email: string): string => email.trim().toLowerCase();
const mensagem = (erro: unknown): string => erro instanceof Error ? erro.message : String(erro);

const idPorEmail = async (email: string): Promise<string> => {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${TABELA}:${email}`));
  const hex = Array.from(new Uint8Array(digest).slice(0, 16), byte => (byte + 256).toString(16).slice(1)).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
};

interface IPendenciasAcessoAbaProps {
  dataverseService?: DataverseService;
  areaInicial: string;
}

const PendenciasAcessoAba: React.FC<IPendenciasAcessoAbaProps> = ({ dataverseService, areaInicial }) => {
  const areasService = React.useMemo(
    () => dataverseService ? new AreaAdminService(dataverseService) : undefined,
    [dataverseService]
  );
  const [areas, setAreas] = React.useState<IAreaAdmin[]>([]);
  const [cadastrados, setCadastrados] = React.useState<Set<string>>(new Set<string>());
  const [pendencias, setPendencias] = React.useState<IDataverseRecord[]>([]);
  const [nome, setNome] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [areaId, setAreaId] = React.useState(areaInicial);
  const [erro, setErro] = React.useState('');
  const [aviso, setAviso] = React.useState('');
  const [carregando, setCarregando] = React.useState(true);
  const [ocupado, setOcupado] = React.useState(false);

  const carregar = React.useCallback(async (): Promise<void> => {
    setCarregando(true);
    setErro('');
    try {
      if (!dataverseService || !areasService) throw new Error('Conexão com o Dataverse indisponível.');
      const [listaAreas, usuarios, registros] = await Promise.all([
        areasService.listarAreas(),
        areasService.listarUsuarios(),
        dataverseService.listarRegistros(TABELA, `$select=${CAMPOS.join(',')}&$orderby=createdon desc`)
      ]);
      setAreas(listaAreas.filter(area => area.ativa !== false));
      setCadastrados(new Set(usuarios.map(usuario => normalizarEmail(usuario.email))));
      setPendencias(registros);
    } catch (falha) {
      setErro(`Falha ao carregar pendências. ${mensagem(falha)}`);
    } finally {
      setCarregando(false);
    }
  }, [dataverseService, areasService]);

  React.useEffect(() => {
    carregar().catch(() => undefined);
  }, [carregar]);

  const executar = async (acao: () => Promise<void>, sucesso: string): Promise<void> => {
    setOcupado(true);
    setErro('');
    setAviso('');
    try {
      await acao();
      setAviso(sucesso);
      await carregar();
    } catch (falha) {
      setErro(mensagem(falha));
    } finally {
      setOcupado(false);
    }
  };

  const salvar = (evento: React.FormEvent<HTMLFormElement>): void => {
    evento.preventDefault();
    const area = areas.find(item => item.id === areaId);
    const emailLimpo = normalizarEmail(email);
    if (!dataverseService || !areasService || ocupado) return;
    if (!nome.trim() || !area || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpo)) {
      setErro('Informe o nome, um e-mail válido e a área.');
      return;
    }
    executar(async () => {
      const usuarios = await areasService.listarUsuarios();
      if (usuarios.some(usuario => normalizarEmail(usuario.email) === emailLimpo)) {
        throw new Error('Este e-mail já está cadastrado. Use a pessoa existente em Estrutura por área.');
      }
      const id = await idPorEmail(emailLimpo);
      if (await dataverseService.obterRegistro(TABELA, id, [ID])) {
        throw new Error('Já existe uma pendência de acesso para este e-mail.');
      }
      try {
        await dataverseService.criarRegistro(TABELA, {
          [ID]: id,
          dgt_name: nome.trim(),
          dgt_rh_email: emailLimpo,
          dgt_rh_areaid: area.id,
          dgt_rh_areanome: area.nome
        });
      } catch (falha) {
        if (await dataverseService.obterRegistro(TABELA, id, [ID])) {
          throw new Error('Já existe uma pendência de acesso para este e-mail.');
        }
        throw falha;
      }
      setNome('');
      setEmail('');
    }, 'Pendência registrada.').catch(() => undefined);
  };

  const marcarSolicitado = (id: string): void => {
    if (!dataverseService || ocupado) return;
    executar(async () => {
      const registro = await dataverseService.obterRegistro(TABELA, id, ['dgt_rh_solicitadoem']);
      if (!registro) throw new Error('Pendência indisponível. Atualize a lista.');
      if (!texto(registro.registro, 'dgt_rh_solicitadoem')) {
        await dataverseService.atualizarRegistro(TABELA, id, {
          dgt_rh_solicitadoem: new Date().toISOString()
        }, registro.etag);
      }
    }, 'Solicitação registrada.').catch(() => undefined);
  };

  return (
    <section>
      {erro && <p role="alert" style={{ color: '#B42318' }}>{erro}</p>}
      {aviso && <p role="status">{aviso}</p>}
      <form onSubmit={salvar}>
        <fieldset disabled={carregando || ocupado || !areas.length} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16 }}>
          <legend>Cadastrar pessoa pendente</legend>
          <label>Nome<br /><input required maxLength={200} value={nome} onChange={evento => setNome(evento.target.value)} /></label>
          <label>E-mail<br /><input required type="email" maxLength={254} value={email} onChange={evento => setEmail(evento.target.value)} /></label>
          <label>Área<br />
            <select required value={areaId} onChange={evento => setAreaId(evento.target.value)}>
              <option value="">Selecione a área</option>
              {areas.map(area => <option key={area.id} value={area.id}>{area.nome}</option>)}
            </select>
          </label>
          <button type="submit">Registrar pendência</button>
        </fieldset>
      </form>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '16px 0' }}>
        <strong>Pendências registradas</strong>
        <button type="button" disabled={carregando || ocupado} onClick={carregar}>Atualizar lista</button>
      </div>
      {carregando && <p role="status">Carregando pendências…</p>}
      {!carregando && !erro && pendencias.length === 0 && <p>Nenhuma pendência registrada.</p>}
      {pendencias.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderSpacing: '0 8px' }}>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Área</th><th>Situação</th><th>Ação</th></tr></thead>
            <tbody>
              {pendencias.map(registro => {
                const id = texto(registro, ID);
                const emailRegistro = texto(registro, 'dgt_rh_email');
                const constaNoPortal = cadastrados.has(normalizarEmail(emailRegistro));
                const solicitadoEm = texto(registro, 'dgt_rh_solicitadoem');
                return (
                  <tr key={id}>
                    <td>{texto(registro, 'dgt_name')}</td>
                    <td>{emailRegistro}</td>
                    <td>{texto(registro, 'dgt_rh_areanome')}</td>
                    <td>{constaNoPortal ? 'Cadastrado no portal' : solicitadoEm ? 'Acesso solicitado' : 'A solicitar acesso'}</td>
                    <td>{!constaNoPortal && !solicitadoEm && (
                      <button type="button" disabled={ocupado || carregando} onClick={() => marcarSolicitado(id)}>Marcar como solicitado</button>
                    )}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default PendenciasAcessoAba;
