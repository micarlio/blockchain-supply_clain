"""Objetos de configuracao compartilhados pelo core.

A dificuldade do PoW e global na rede: todos os nos devem minerar e validar
blocos usando a mesma regra. A diferenca entre nos fica apenas na capacidade
de tentar nonces por ciclo, simulando hash power sem mudar a validade do bloco.
"""

from dataclasses import dataclass, field

GLOBAL_POW_DIFFICULTY = 4
GLOBAL_MAX_EVENTS_PER_BLOCK = 4

PAPEL_NO_MINERADOR = "minerador"
PAPEL_NO_CONTROLE = "controle"
PAPEL_NO_OBSERVADOR = "observador"

PERFIL_NO_HONESTO = "honesto"
PERFIL_NO_MALICIOSO = "malicioso"


@dataclass(frozen=True, slots=True)
class PerfilNoPadrao:
    """Perfil default usado para subir os nos conhecidos do projeto."""

    node_id: str
    nome_exibicao: str
    node_role: str
    node_profile: str
    api_port: int
    auto_mining_enabled: bool
    observer_mode: bool
    mining_profile: str
    mining_cycle_interval_seconds: float
    nonce_attempts_per_cycle: int


@dataclass(frozen=True, slots=True)
class AtualizacaoDificuldadeGlobal:
    """Representa uma mudanca global de PoW ancorada em uma ponta da cadeia."""

    update_id: str
    difficulty: int
    bloco_ancora_hash: str
    node_id_origem: str
    timestamp: str


PERFIS_NO_PADRAO = {
    "node-alpha": PerfilNoPadrao(
        node_id="node-alpha",
        nome_exibicao="Node Alpha",
        node_role=PAPEL_NO_MINERADOR,
        node_profile=PERFIL_NO_HONESTO,
        api_port=8001,
        auto_mining_enabled=True,
        observer_mode=False,
        mining_profile="padrao",
        mining_cycle_interval_seconds=2.0,
        nonce_attempts_per_cycle=10000,
    ),
    "node-beta": PerfilNoPadrao(
        node_id="node-beta",
        nome_exibicao="Node Beta",
        node_role=PAPEL_NO_CONTROLE,
        node_profile=PERFIL_NO_HONESTO,
        api_port=8002,
        auto_mining_enabled=False,
        observer_mode=False,
        mining_profile="manual",
        mining_cycle_interval_seconds=2.0,
        nonce_attempts_per_cycle=10000,
    ),
    "node-gamma": PerfilNoPadrao(
        node_id="node-gamma",
        nome_exibicao="Node Gamma",
        node_role=PAPEL_NO_OBSERVADOR,
        node_profile=PERFIL_NO_HONESTO,
        api_port=8003,
        auto_mining_enabled=False,
        observer_mode=True,
        mining_profile="desabilitada",
        mining_cycle_interval_seconds=2.0,
        nonce_attempts_per_cycle=0,
    ),
    "node-evil": PerfilNoPadrao(
        node_id="node-evil",
        nome_exibicao="Node Evil",
        node_role=PAPEL_NO_MINERADOR,
        node_profile=PERFIL_NO_MALICIOSO,
        api_port=8004,
        auto_mining_enabled=True,
        observer_mode=False,
        mining_profile="vantagem_simulada",
        mining_cycle_interval_seconds=0.5,
        nonce_attempts_per_cycle=40000,
    ),
}


def obter_perfil_no_padrao(node_id: str) -> PerfilNoPadrao | None:
    """Retorna o perfil default de um no conhecido, quando existir."""

    return PERFIS_NO_PADRAO.get(node_id)


def listar_perfis_no_padrao() -> list[PerfilNoPadrao]:
    """Lista os perfis default conhecidos pelo projeto."""

    return list(PERFIS_NO_PADRAO.values())


@dataclass(slots=True)
class CoreConfig:
    """Configuracao em tempo de execucao para um no local da blockchain."""

    difficulty: int = GLOBAL_POW_DIFFICULTY
    max_events_per_block: int = GLOBAL_MAX_EVENTS_PER_BLOCK
    node_id: str = "node-1"
    node_role: str = PAPEL_NO_MINERADOR
    node_profile: str = PERFIL_NO_HONESTO
    auto_mining_enabled: bool = True
    observer_mode: bool = False
    mining_profile: str = "padrao"
    mining_cycle_interval_seconds: float = 2.0
    nonce_attempts_per_cycle: int = 10000
    atualizacoes_dificuldade_global: list[AtualizacaoDificuldadeGlobal] = field(
        default_factory=list
    )
    dificuldade_global_inicial: int = field(init=False)

    def __post_init__(self) -> None:
        """Guarda a dificuldade base da rede para a execucao atual."""

        self.dificuldade_global_inicial = self.difficulty

    @property
    def global_difficulty(self) -> int:
        """Alias explicito para a dificuldade global usada pela rede."""

        return self.difficulty

    def capacidade_mineracao(self) -> dict[str, object]:
        """Resumo serializavel da capacidade de mineracao simulada do no."""

        return {
            "perfil": self.mining_profile,
            "intervalo_ciclo_segundos": self.mining_cycle_interval_seconds,
            "tentativas_nonce_por_ciclo": self.nonce_attempts_per_cycle,
        }

    def obter_dificuldade_global_para_cadeia(self, chain: list[object]) -> int:
        """Resolve a dificuldade efetiva para a cadeia informada.

        A mudanca de dificuldade e global, mas passa a valer apenas para blocos que
        descendem do `bloco_ancora_hash` distribuido na atualizacao.
        """

        if not chain:
            return 0

        hashes_cadeia = {
            block.block_hash
            for block in chain
            if hasattr(block, "block_hash") and isinstance(block.block_hash, str)
        }
        dificuldade = self.dificuldade_global_inicial
        for atualizacao in self.atualizacoes_dificuldade_global:
            if atualizacao.bloco_ancora_hash in hashes_cadeia:
                dificuldade = atualizacao.difficulty

        return dificuldade

    def sincronizar_dificuldade_global_ativa(self, chain: list[object]) -> int:
        """Atualiza a dificuldade efetiva da cadeia ativa em memoria."""

        self.difficulty = self.obter_dificuldade_global_para_cadeia(chain)
        return self.difficulty

    def registrar_dificuldade_global(
        self,
        dificuldade: int,
        *,
        bloco_ancora_hash: str,
        update_id: str,
        node_id_origem: str,
        timestamp: str,
    ) -> bool:
        """Registra uma mudanca global de PoW distribuida para toda a rede."""

        if dificuldade < 0:
            raise ValueError("dificuldade_global_invalida")
        if not isinstance(bloco_ancora_hash, str) or not bloco_ancora_hash:
            raise ValueError("bloco_ancora_hash_invalido")
        if not isinstance(update_id, str) or not update_id:
            raise ValueError("update_id_invalido")
        if not isinstance(node_id_origem, str) or not node_id_origem:
            raise ValueError("node_id_origem_invalido")
        if not isinstance(timestamp, str) or not timestamp:
            raise ValueError("timestamp_atualizacao_invalido")

        if any(
            atualizacao.update_id == update_id
            for atualizacao in self.atualizacoes_dificuldade_global
        ):
            return False

        self.atualizacoes_dificuldade_global.append(
            AtualizacaoDificuldadeGlobal(
                update_id=update_id,
                difficulty=dificuldade,
                bloco_ancora_hash=bloco_ancora_hash,
                node_id_origem=node_id_origem,
                timestamp=timestamp,
            )
        )
        return True

    def aplicar_capacidade_mineracao(
        self,
        *,
        intervalo_ciclo_segundos: float | None = None,
        tentativas_nonce_por_ciclo: int | None = None,
        mining_profile: str | None = None,
    ) -> None:
        """Atualiza o hash power simulado do no durante a execucao."""

        if intervalo_ciclo_segundos is not None:
            if intervalo_ciclo_segundos <= 0:
                raise ValueError("intervalo_ciclo_invalido")
            self.mining_cycle_interval_seconds = intervalo_ciclo_segundos

        if tentativas_nonce_por_ciclo is not None:
            if tentativas_nonce_por_ciclo < 0:
                raise ValueError("tentativas_nonce_invalidas")
            self.nonce_attempts_per_cycle = tentativas_nonce_por_ciclo

        if mining_profile:
            self.mining_profile = mining_profile


def construir_config_no_por_perfil(
    node_id: str,
    *,
    difficulty: int = GLOBAL_POW_DIFFICULTY,
    max_events_per_block: int = GLOBAL_MAX_EVENTS_PER_BLOCK,
) -> CoreConfig:
    """Monta a configuracao default de um no conhecido sem duplicar regras."""

    perfil = obter_perfil_no_padrao(node_id)
    if perfil is None:
        return CoreConfig(
            node_id=node_id,
            difficulty=difficulty,
            max_events_per_block=max_events_per_block,
        )

    return CoreConfig(
        node_id=perfil.node_id,
        node_role=perfil.node_role,
        node_profile=perfil.node_profile,
        difficulty=difficulty,
        max_events_per_block=max_events_per_block,
        auto_mining_enabled=perfil.auto_mining_enabled,
        observer_mode=perfil.observer_mode,
        mining_profile=perfil.mining_profile,
        mining_cycle_interval_seconds=perfil.mining_cycle_interval_seconds,
        nonce_attempts_per_cycle=perfil.nonce_attempts_per_cycle,
    )
