"""Testes da configuracao compartilhada do core."""

from src.core.config import (
    CoreConfig,
    GLOBAL_POW_DIFFICULTY,
    PERFIL_NO_MALICIOSO,
    construir_config_no_por_perfil,
)


def test_perfis_padrao_preservam_dificuldade_global_da_rede() -> None:
    """Todos os nos devem minerar e validar usando a mesma dificuldade."""

    config_alpha = construir_config_no_por_perfil("node-alpha")
    config_evil = construir_config_no_por_perfil("node-evil")

    assert config_alpha.global_difficulty == GLOBAL_POW_DIFFICULTY
    assert config_evil.global_difficulty == GLOBAL_POW_DIFFICULTY
    assert config_alpha.difficulty == config_evil.difficulty


def test_node_evil_tem_vantagem_so_na_capacidade_de_mineracao() -> None:
    """O no malicioso simula hash power maior sem mudar o PoW global."""

    config_alpha = construir_config_no_por_perfil("node-alpha")
    config_evil = construir_config_no_por_perfil("node-evil")

    assert config_evil.node_profile == PERFIL_NO_MALICIOSO
    assert config_evil.difficulty == config_alpha.difficulty
    assert config_evil.nonce_attempts_per_cycle > config_alpha.nonce_attempts_per_cycle
    assert (
        config_evil.mining_cycle_interval_seconds
        < config_alpha.mining_cycle_interval_seconds
    )


def test_historico_de_dificuldade_preserva_blocos_antigos_e_proximos() -> None:
    """Mudancas globais passam a valer para descendentes da ancora."""

    config = CoreConfig(difficulty=2)

    cadeia_sem_ancora = [type("BlocoStub", (), {"block_hash": "genesis"})()]
    cadeia_com_ancora = [
        type("BlocoStub", (), {"block_hash": "genesis"})(),
        type("BlocoStub", (), {"block_hash": "hash-bloco-1"})(),
    ]

    assert config.obter_dificuldade_global_para_cadeia(cadeia_sem_ancora) == 2

    assert (
        config.registrar_dificuldade_global(
            5,
            bloco_ancora_hash="hash-bloco-1",
            update_id="update-001",
            node_id_origem="node-alpha",
            timestamp="2026-04-09T12:00:00Z",
        )
        is True
    )

    assert config.obter_dificuldade_global_para_cadeia(cadeia_sem_ancora) == 2
    assert config.obter_dificuldade_global_para_cadeia(cadeia_com_ancora) == 5
    assert config.sincronizar_dificuldade_global_ativa(cadeia_com_ancora) == 5
