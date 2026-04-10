"""Helpers para snapshots e impacto de blockchain durante testes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from src.testes.models import ClusterSnapshot, NodeSnapshot


def _timestamp_utc_atual() -> str:
    """Retorna o horario atual em UTC no formato padrao do projeto."""

    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def capturar_snapshot_cluster(
    clients: dict[str, Any],
    no_executor_id: str,
) -> ClusterSnapshot:
    """Coleta estado, cadeia, rede, mempool e demonstracao dos nos disponiveis."""

    entradas: list[NodeSnapshot] = []
    for client in clients.values():
        estado = None
        cadeia = None
        rede = None
        mempool = None
        demonstracao = None

        if client.disponivel:
            try:
                estado = client.consultar_estado()
            except Exception:
                estado = None
            try:
                cadeia = client.consultar_cadeia()
            except Exception:
                cadeia = None
            try:
                rede = client.consultar_rede()
            except Exception:
                rede = None
            try:
                mempool = client.consultar_mempool()
            except Exception:
                mempool = None
            try:
                demonstracao = client.consultar_demonstracao()
            except Exception:
                demonstracao = None

        metadata = client.metadata
        if isinstance(estado, dict):
            metadata = type(client.metadata)(
                node_id=client.metadata.node_id,
                nome=client.metadata.nome,
                base_url=client.metadata.base_url,
                disponivel=client.disponivel,
                papel_no=estado.get("papel_no"),
                perfil_no=estado.get("perfil_no"),
                mineracao_automatica_ativa=estado.get("mineracao_automatica_ativa"),
                capacidade_mineracao=estado.get("capacidade_mineracao"),
                altura_cadeia=estado.get("altura_cadeia"),
                hash_ponta=estado.get("hash_ponta"),
            )

        entradas.append(
            NodeSnapshot(
                node=metadata,
                estado=estado,
                cadeia=cadeia,
                rede=rede,
                mempool=mempool,
                demonstracao=demonstracao,
            )
        )

    entradas.sort(key=lambda entrada: entrada.node.node_id)
    return ClusterSnapshot(
        capturado_em=_timestamp_utc_atual(),
        no_executor_id=no_executor_id,
        entradas=entradas,
    )


def obter_entrada(snapshot: ClusterSnapshot, node_id: str) -> NodeSnapshot | None:
    """Retorna a entrada de snapshot para um no especifico."""

    for entrada in snapshot.entradas:
        if entrada.node.node_id == node_id:
            return entrada
    return None


def localizar_evento_confirmado(snapshot: ClusterSnapshot, event_id: str) -> list[str]:
    """Lista os nos cuja cadeia ativa confirmou o evento informado."""

    nos: list[str] = []
    for entrada in snapshot.entradas:
        cadeia = entrada.cadeia.get("cadeia_ativa") if entrada.cadeia else None
        if not isinstance(cadeia, list):
            continue
        for bloco in cadeia:
            eventos = bloco.get("events") if isinstance(bloco, dict) else None
            if not isinstance(eventos, list):
                continue
            if any(
                isinstance(evento, dict) and evento.get("event_id") == event_id
                for evento in eventos
            ):
                nos.append(entrada.node.node_id)
                break
    return nos


def resumir_impacto_blockchain(
    snapshot_inicial: ClusterSnapshot,
    snapshot_final: ClusterSnapshot,
    no_alvo_id: str,
    *,
    eventos_monitorados: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Resume as diferencas observadas na blockchain e no cluster."""

    entrada_inicial = obter_entrada(snapshot_inicial, no_alvo_id)
    entrada_final = obter_entrada(snapshot_final, no_alvo_id)

    estado_inicial = entrada_inicial.estado if entrada_inicial else None
    estado_final = entrada_final.estado if entrada_final else None

    fork_detectado = any(
        isinstance(entrada.demonstracao, dict)
        and isinstance(entrada.demonstracao.get("demonstracao"), dict)
        and bool(entrada.demonstracao["demonstracao"].get("fork_detectado"))
        for entrada in snapshot_final.entradas
    )
    reorganizacao_detectada = any(
        isinstance(entrada.demonstracao, dict)
        and isinstance(entrada.demonstracao.get("demonstracao"), dict)
        and bool(entrada.demonstracao["demonstracao"].get("reorganizacao_detectada"))
        for entrada in snapshot_final.entradas
    )

    eventos_confirmados: dict[str, Any] = {}
    for descricao, event_id in (eventos_monitorados or {}).items():
        eventos_confirmados[descricao] = {
            "event_id": event_id,
            "confirmado_antes_em": localizar_evento_confirmado(
                snapshot_inicial,
                event_id,
            ),
            "confirmado_depois_em": localizar_evento_confirmado(
                snapshot_final,
                event_id,
            ),
        }

    return {
        "capturado_em": snapshot_final.capturado_em,
        "no_alvo_id": no_alvo_id,
        "topo_cadeia_antes": (
            estado_inicial.get("hash_ponta")
            if isinstance(estado_inicial, dict)
            else None
        ),
        "topo_cadeia_depois": (
            estado_final.get("hash_ponta") if isinstance(estado_final, dict) else None
        ),
        "altura_cadeia_antes": (
            estado_inicial.get("altura_cadeia")
            if isinstance(estado_inicial, dict)
            else None
        ),
        "altura_cadeia_depois": (
            estado_final.get("altura_cadeia")
            if isinstance(estado_final, dict)
            else None
        ),
        "mudou_topo": (
            isinstance(estado_inicial, dict)
            and isinstance(estado_final, dict)
            and estado_inicial.get("hash_ponta") != estado_final.get("hash_ponta")
        ),
        "mudou_altura": (
            isinstance(estado_inicial, dict)
            and isinstance(estado_final, dict)
            and estado_inicial.get("altura_cadeia") != estado_final.get("altura_cadeia")
        ),
        "fork_detectado": fork_detectado,
        "reorganizacao_detectada": reorganizacao_detectada,
        "eventos_monitorados": eventos_confirmados,
        "snapshot_inicial_resumido": snapshot_inicial.para_dict(),
        "snapshot_final_resumido": snapshot_final.para_dict(),
    }
