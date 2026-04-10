export type TipoEvento =
  | "CADASTRAR_MATERIA_PRIMA"
  | "FABRICAR_PRODUTO_SIMPLES"
  | "FABRICAR_PRODUTO_COMPOSTO"

export type TipoEntidade = "raw_material" | "simple_product" | "composite_product"

export type PapelAtor = "FORNECEDOR" | "FABRICANTE" | "MONTADORA"

export interface EventoBlockchain {
  event_id: string
  event_type: TipoEvento
  product_id: string
  product_name: string
  entity_kind: TipoEntidade
  actor_id: string
  actor_role: PapelAtor
  timestamp: string
  input_ids: string[]
  metadata: Record<string, unknown>
}

export interface BlocoBlockchain {
  index: number
  timestamp: string
  previous_hash: string
  difficulty: number
  nonce: number
  event_count: number
  data_hash: string
  events: EventoBlockchain[]
  block_hash: string
  miner_id?: string | null
}

export interface EstadoNo {
  node_id: string
  papel_no: string
  perfil_no: string
  mineracao_automatica_ativa: boolean
  modo_observador: boolean
  difficulty: number
  dificuldade_global: number
  capacidade_mineracao: {
    perfil: string
    intervalo_ciclo_segundos: number
    tentativas_nonce_por_ciclo: number
  }
  altura_cadeia: number
  hash_ponta: string
  quantidade_mempool: number
  forks_conhecidos: number
}

export interface CadeiaResposta {
  node_id: string
  cadeia_ativa: BlocoBlockchain[]
  cadeias_candidatas: BlocoBlockchain[][]
  trabalho_acumulado_ativo: number
}

export interface MempoolResposta {
  node_id: string
  quantidade: number
  eventos: EventoBlockchain[]
}

export interface AtividadeRede {
  timestamp: string
  tipo: string
  descricao: string
  severidade: string
  node_id: string
  hash_relacionado?: string | null
  event_id_relacionado?: string | null
}

export interface NoConhecido {
  node_id: string
  papel: string
  status: string
  altura_cadeia: number | null
  hash_ponta: string | null
  tamanho_mempool: number | null
  ultimo_evento: string | null
  ultimo_contato: string | null
}

export interface RedeResposta {
  node_id: string
  papel_local: string
  estado_local: {
    altura_cadeia: number
    hash_ponta: string
    tamanho_mempool: number
    forks_conhecidos: number
  }
  nos_conhecidos: NoConhecido[]
  atividade_recente: AtividadeRede[]
  demonstracao: {
    fork_detectado: boolean
    reorganizacao_detectada: boolean
    atividade_recente: AtividadeRede | null
  }
}

export interface DemonstracaoResposta {
  node_id: string
  estado_no: EstadoNo
  demonstracao: {
    fork_detectado: boolean
    reorganizacao_detectada: boolean
    atividade_recente: AtividadeRede | null
  }
  atividades: AtividadeRede[]
}

export interface NoRastreabilidade {
  status: "confirmado" | "pendente"
  evento: EventoBlockchain
  block_index: number | null
  block_hash: string | null
  miner_id: string | null
  insumos: NoRastreabilidade[]
}

export interface RastreabilidadeResposta {
  node_id: string
  identificador: string
  eventos_confirmados: Array<{
    evento: EventoBlockchain
    block_index: number
    block_hash: string
    miner_id: string | null
  }>
  eventos_pendentes: EventoBlockchain[]
  estado_atual: {
    status: "nao_encontrado" | "pendente" | "confirmado"
    ultimo_evento: EventoBlockchain | null
    quantidade_confirmada: number
    quantidade_pendente: number
  }
  arvore_origem: NoRastreabilidade | null
}

export interface RespostaEvento {
  status: string
  event_id?: string
  node_id?: string
  motivo?: string
}

export interface RespostaMineracao {
  status: string
  motivo?: string
  bloco?: BlocoBlockchain
}

export type PapelNo = "minerador" | "controle" | "observador"

export interface PayloadConfiguracaoNo {
  papel_no: PapelNo
  intervalo_ciclo_segundos: number
  tentativas_nonce_por_ciclo: number
  perfil_mineracao?: string
}

export interface PayloadConfiguracaoRede {
  dificuldade_global: number
}

export interface RespostaConfiguracao {
  status: string
  estado: EstadoNo
  motivo?: string
}

export type NivelLogSistema = "INFO" | "WARN" | "ERROR" | "DEBUG"

export interface LogSistema {
  id: string
  timestamp: string
  level: NivelLogSistema | string
  node_id: string
  category: string
  message: string
  event_type?: string | null
  endpoint?: string | null
  method?: string | null
  request_id?: string | null
  status_code?: number | null
  duration_ms?: number | null
  request_payload?: unknown
  response_payload?: unknown
  context?: Record<string, unknown> | null
}

export interface LogsResposta {
  node_id: string
  transport: string
  updated_at: string
  entries: LogSistema[]
}

export interface OpcaoCampoTeste {
  value: string
  label: string
  description?: string | null
}

export interface CampoEntradaTeste {
  id: string
  label: string
  field_type: string
  required: boolean
  placeholder?: string | null
  help_text?: string | null
  default_value?: unknown
  options: OpcaoCampoTeste[]
}

export interface DefinicaoCenarioTeste {
  id: string
  nome: string
  descricao: string
  categoria: string
  severidade: string
  objetivo: string
  precondicoes: string[]
  comportamento_esperado: string[]
  impactos_execucao: string[]
  requires_node_selection: boolean
  node_selection_label?: string | null
  node_selection_help?: string | null
  input_fields: CampoEntradaTeste[]
  show_blockchain_impact: boolean
  show_request_response: boolean
  show_context: boolean
  default_target_node_id?: string | null
  tags: string[]
}

export interface PayloadExecucaoTeste {
  node_id?: string
  parametros?: Record<string, unknown>
}

export interface ResultadoExecucaoTeste {
  scenario_id: string
  scenario_name: string
  status_execucao: string
  teste_aprovado: boolean
  resultado_esperado: string
  resultado_observado: string
  mensagem_interpretada: string
  request_enviada: Array<Record<string, unknown>>
  response_recebida: Array<Record<string, unknown>>
  impacto_blockchain: Record<string, unknown> | null
  contexto_relevante: Record<string, unknown>
  erro_tecnico?: Record<string, unknown> | null
}

export interface ConfiguracaoNo {
  id: string
  nome: string
  url: string
}

export interface ItemInsumo {
  event_id: string
  product_id: string
  product_name: string
  event_type: TipoEvento
  entity_kind: TipoEntidade
  timestamp: string
  input_ids: string[]
  metadata: Record<string, unknown>
  status_consumo: "disponivel" | "consumido" | "pendente"
  status_origem: "confirmado" | "pendente"
  ator_origem: string
  no_origem?: string
}
