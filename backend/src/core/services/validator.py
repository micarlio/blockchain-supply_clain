"""Serviços de validação para eventos, blocos e cadeias."""

from __future__ import annotations

from src.core.config import CoreConfig
from src.core.models.block import Block
from src.core.models.dominio import (
    ENTIDADE_MATERIA_PRIMA,
    ENTIDADE_PRODUTO_COMPOSTO,
    ENTIDADE_PRODUTO_SIMPLES,
    EVENTO_CADASTRAR_MATERIA_PRIMA,
    EVENTO_FABRICAR_PRODUTO_COMPOSTO,
    EVENTO_FABRICAR_PRODUTO_SIMPLES,
    PAPEL_FABRICANTE,
    PAPEL_FORNECEDOR,
    PAPEL_MONTADORA,
    tipo_entidade_esperado_por_evento,
)
from src.core.models.event import SupplyChainEvent

PAPEL_EXIGIDO_POR_EVENTO = {
    EVENTO_CADASTRAR_MATERIA_PRIMA: PAPEL_FORNECEDOR,
    EVENTO_FABRICAR_PRODUTO_SIMPLES: PAPEL_FABRICANTE,
    EVENTO_FABRICAR_PRODUTO_COMPOSTO: PAPEL_MONTADORA,
}


def _inteiro_nao_negativo(value: object) -> bool:
    """Retorna `True` quando o valor é um inteiro simples e válido."""

    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _texto_preenchido(value: object) -> bool:
    """No bloco, os campos textuais obrigatórios não podem vir vazios."""

    return isinstance(value, str) and bool(value)


def _lot_id_evento(event: SupplyChainEvent) -> str | None:
    """Extrai o lot_id serializado quando ele existir no metadata."""

    lot_id = event.metadata.get("lot_id") if isinstance(event.metadata, dict) else None
    return lot_id if isinstance(lot_id, str) and bool(lot_id) else None


def _identificadores_rastreabilidade_evento(event: SupplyChainEvent) -> dict[str, str]:
    """Lista os identificadores que podem ser usados numa consulta de rastreabilidade."""

    identificadores = {
        "event_id": event.event_id,
        "product_id": event.product_id,
    }
    lot_id = _lot_id_evento(event)
    if lot_id is not None:
        identificadores["lot_id"] = lot_id
    return identificadores


class Validator:
    """Ponto central de validação estrutural do core."""

    def __init__(self, config: CoreConfig | None = None) -> None:
        """Guarda a configuração local usada nas validações."""

        self.config = config or CoreConfig()

    def validar_evento(self, event: SupplyChainEvent) -> bool:
        """Evento válido aqui é evento com estrutura mínima correta."""

        return isinstance(event, SupplyChainEvent) and event.validar_basico()

    def validar_evento_de_dominio(
        self,
        event: SupplyChainEvent,
        eventos_anteriores: dict[str, SupplyChainEvent] | None = None,
        input_ids_consumidos: set[str] | None = None,
    ) -> bool:
        """Aplica as regras mínimas de composição produtiva do projeto."""

        return (
            self.diagnosticar_rejeicao_evento_de_dominio(
                event,
                eventos_anteriores,
                input_ids_consumidos,
            )
            is None
        )

    def diagnosticar_rejeicao_evento_de_dominio(
        self,
        event: SupplyChainEvent,
        eventos_anteriores: dict[str, SupplyChainEvent] | None = None,
        input_ids_consumidos: set[str] | None = None,
    ) -> str | None:
        """Retorna um motivo explicito quando a regra de dominio rejeita o evento."""

        if not self.validar_evento(event):
            return "estrutura_invalida"

        eventos_anteriores = eventos_anteriores or {}
        input_ids_consumidos = input_ids_consumidos or set()

        if event.event_id in eventos_anteriores:
            return "evento_duplicado"

        if len(set(event.input_ids)) != len(event.input_ids):
            return "input_ids_duplicados"

        identificadores_novos = _identificadores_rastreabilidade_evento(event)
        for evento_anterior in eventos_anteriores.values():
            identificadores_anteriores = _identificadores_rastreabilidade_evento(
                evento_anterior
            )
            for campo_novo, valor_novo in identificadores_novos.items():
                for (
                    campo_anterior,
                    valor_anterior,
                ) in identificadores_anteriores.items():
                    if valor_novo != valor_anterior:
                        continue
                    if campo_novo == "product_id" and campo_anterior == "product_id":
                        return "product_id_duplicado"
                    if campo_novo == "lot_id" and campo_anterior == "lot_id":
                        return "lot_id_duplicado"
                    return "identificador_rastreabilidade_duplicado"

        if PAPEL_EXIGIDO_POR_EVENTO.get(event.event_type) != event.actor_role:
            return "papel_invalido_para_evento"

        if tipo_entidade_esperado_por_evento(event.event_type) != event.entity_kind:
            return "entidade_invalida_para_evento"

        if event.event_type == EVENTO_CADASTRAR_MATERIA_PRIMA:
            return (
                None if len(event.input_ids) == 0 else "materia_prima_nao_aceita_inputs"
            )

        if not event.input_ids:
            return "input_ids_obrigatorios"

        eventos_referenciados: list[SupplyChainEvent] = []
        for input_id in event.input_ids:
            evento_anterior = eventos_anteriores.get(input_id)
            if evento_anterior is None:
                return "input_id_inexistente"
            if input_id in input_ids_consumidos:
                return "input_id_ja_consumido"
            eventos_referenciados.append(evento_anterior)

        tipos_referenciados = {evento.entity_kind for evento in eventos_referenciados}

        if event.event_type == EVENTO_FABRICAR_PRODUTO_SIMPLES:
            return (
                None
                if tipos_referenciados == {ENTIDADE_MATERIA_PRIMA}
                else "produto_simples_exige_materia_prima"
            )

        if event.event_type == EVENTO_FABRICAR_PRODUTO_COMPOSTO:
            if not tipos_referenciados.issubset(
                {
                    ENTIDADE_MATERIA_PRIMA,
                    ENTIDADE_PRODUTO_SIMPLES,
                    ENTIDADE_PRODUTO_COMPOSTO,
                }
            ):
                return "produto_composto_referencia_tipo_invalido"

            return (
                None
                if bool(
                    tipos_referenciados.intersection(
                        {
                            ENTIDADE_PRODUTO_SIMPLES,
                            ENTIDADE_PRODUTO_COMPOSTO,
                        }
                    )
                )
                else "produto_composto_exige_produto_derivado"
            )

        return "tipo_evento_desconhecido"

    def construir_contexto_eventos(
        self,
        events: list[SupplyChainEvent],
        eventos_anteriores: dict[str, SupplyChainEvent] | None = None,
        input_ids_consumidos: set[str] | None = None,
    ) -> tuple[dict[str, SupplyChainEvent], set[str]] | None:
        """Aplica um lote de eventos em ordem e devolve o contexto atualizado."""

        if not isinstance(events, list):
            return None

        contexto_eventos = dict(eventos_anteriores or {})
        contexto_consumidos = set(input_ids_consumidos or set())

        for event in events:
            contexto_atualizado = self.aplicar_evento_ao_contexto(
                event,
                contexto_eventos,
                contexto_consumidos,
            )
            if contexto_atualizado is None:
                return None

            contexto_eventos, contexto_consumidos = contexto_atualizado

        return contexto_eventos, contexto_consumidos

    def aplicar_evento_ao_contexto(
        self,
        event: SupplyChainEvent,
        eventos_anteriores: dict[str, SupplyChainEvent] | None = None,
        input_ids_consumidos: set[str] | None = None,
    ) -> tuple[dict[str, SupplyChainEvent], set[str]] | None:
        """Valida um evento e devolve uma nova versao do contexto com ele aplicado."""

        contexto_eventos = dict(eventos_anteriores or {})
        contexto_consumidos = set(input_ids_consumidos or set())

        if not self.validar_evento_de_dominio(
            event, contexto_eventos, contexto_consumidos
        ):
            return None

        contexto_eventos[event.event_id] = event
        contexto_consumidos.update(event.input_ids)
        return contexto_eventos, contexto_consumidos

    def construir_contexto_cadeia(
        self,
        chain: list[Block],
    ) -> tuple[dict[str, SupplyChainEvent], set[str]] | None:
        """Lê os eventos confirmados da cadeia na ordem em que eles apareceram."""

        if not isinstance(chain, list) or not chain:
            return None

        contexto_eventos: dict[str, SupplyChainEvent] = {}
        contexto_consumidos: set[str] = set()

        for block in chain[1:]:
            contexto_atualizado = self.construir_contexto_eventos(
                block.events,
                contexto_eventos,
                contexto_consumidos,
            )
            if contexto_atualizado is None:
                return None

            contexto_eventos, contexto_consumidos = contexto_atualizado

        return contexto_eventos, contexto_consumidos

    def validar_bloco(self, block: Block, previous_block: Block | None = None) -> bool:
        """Confere estrutura, hashes, PoW e encadeamento do bloco."""

        if not isinstance(block, Block):
            return False

        if not _inteiro_nao_negativo(block.index):
            return False
        if not _inteiro_nao_negativo(block.difficulty):
            return False
        if not _inteiro_nao_negativo(block.nonce):
            return False
        if not _inteiro_nao_negativo(block.event_count):
            return False

        if not _texto_preenchido(block.timestamp):
            return False
        if not _texto_preenchido(block.previous_hash):
            return False
        if not isinstance(block.data_hash, str):
            return False
        if not isinstance(block.block_hash, str):
            return False

        if not isinstance(block.events, list):
            return False
        if block.event_count != len(block.events):
            return False
        if not all(self.validar_evento(event) for event in block.events):
            return False

        if block.data_hash != block.calcular_hash_dados():
            return False
        if block.block_hash != block.calcular_hash_bloco():
            return False
        if not block.possui_pow_valido():
            return False

        if previous_block is None:
            return True

        if not isinstance(previous_block, Block):
            return False
        if block.index != previous_block.index + 1:
            return False
        if block.previous_hash != previous_block.block_hash:
            return False
        return True

    def validar_cadeia(self, chain: list[Block]) -> bool:
        """Percorre a cadeia inteira validando bloco por bloco."""

        if not isinstance(chain, list) or not chain:
            return False

        for index, block in enumerate(chain):
            previous_block = None if index == 0 else chain[index - 1]
            if not self.validar_bloco(block, previous_block):
                return False

            if index == 0:
                continue

            dificuldade_esperada = self.config.obter_dificuldade_global_para_cadeia(
                chain[:index]
            )
            if block.difficulty != dificuldade_esperada:
                return False

        return self.construir_contexto_cadeia(chain) is not None

    def validate_event(self, event: SupplyChainEvent) -> bool:
        """Alias de compatibilidade para `validar_evento`."""

        return self.validar_evento(event)

    def validate_block(self, block: Block, previous_block: Block | None = None) -> bool:
        """Alias de compatibilidade para `validar_bloco`."""

        return self.validar_bloco(block, previous_block)

    def validate_chain(self, chain: list[Block]) -> bool:
        """Alias de compatibilidade para `validar_cadeia`."""

        return self.validar_cadeia(chain)

    def validate_domain_event(
        self,
        event: SupplyChainEvent,
        previous_events: dict[str, SupplyChainEvent] | None = None,
        consumed_input_ids: set[str] | None = None,
    ) -> bool:
        """Alias de compatibilidade para `validar_evento_de_dominio`."""

        return self.validar_evento_de_dominio(
            event, previous_events, consumed_input_ids
        )
