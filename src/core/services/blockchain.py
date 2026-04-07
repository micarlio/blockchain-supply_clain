"""Gerenciador principal do estado local da blockchain."""

from __future__ import annotations

from copy import deepcopy

from src.core.config import CoreConfig
from src.core.models.block import Block
from src.core.services.consensus import Consensus
from src.core.services.validator import Validator

GENESIS_TIMESTAMP = "2026-01-01T00:00:00Z"
GENESIS_PREVIOUS_HASH = "GENESIS"
STATUS_BLOCO_ADICIONADO = "bloco_adicionado_cadeia_ativa"
STATUS_BLOCO_FORK = "bloco_registrado_em_fork"
STATUS_CADEIA_REORGANIZADA = "cadeia_ativa_reorganizada"
STATUS_BLOCO_IGNORADO_PROPRIO_NO = "bloco_ignorado_proprio_no"
STATUS_BLOCO_REJEITADO = "bloco_rejeitado_validacao"
STATUS_PAYLOAD_INVALIDO = "payload_invalido"


class Blockchain:
    """Mantem a cadeia ativa e as ramificacoes conhecidas."""

    def __init__(
        self,
        config: CoreConfig | None = None,
        validator: Validator | None = None,
        consensus: Consensus | None = None,
    ) -> None:
        """Ao iniciar, o no sempre nasce com o mesmo gênesis."""

        self.config = config or CoreConfig()
        self.validator = validator or Validator(self.config)
        self.consensus = consensus or Consensus()
        self.chain: list[Block] = [self.criar_bloco_genesis()]
        self.cadeias_candidatas: list[list[Block]] = []

    def criar_bloco_genesis(self) -> Block:
        """Cria o bloco base que todos os nos devem compartilhar."""

        genesis = Block(
            index=0,
            timestamp=GENESIS_TIMESTAMP,
            previous_hash=GENESIS_PREVIOUS_HASH,
            difficulty=0,
            nonce=0,
            event_count=0,
            data_hash="",
            events=[],
            block_hash="",
            miner_id=None,
        )
        genesis.atualizar_hashes()
        return genesis

    def obter_ultimo_bloco(self) -> Block:
        """Retorna o bloco que esta na ponta da cadeia ativa."""

        return self.chain[-1]

    def obter_cadeias_candidatas(self) -> list[list[Block]]:
        """Retorna uma copia das ramificacoes guardadas localmente."""

        return deepcopy(self.cadeias_candidatas)

    def adicionar_bloco(self, block: Block) -> bool:
        """Tenta encaixar o bloco na cadeia ativa ou em algum fork conhecido."""

        return self._processar_bloco(block) != STATUS_BLOCO_REJEITADO

    def validar_bloco(self, block: Block, previous_block: Block) -> bool:
        """Delegamos a validacao de bloco para o validador."""

        return self.validator.validar_bloco(block, previous_block)

    def validar_cadeia(self, chain: list[Block]) -> bool:
        """Confere se a cadeia inteira continua consistente."""

        if not isinstance(chain, list) or not chain:
            return False

        genesis_esperado = self.criar_bloco_genesis().para_dict()
        if chain[0].para_dict() != genesis_esperado:
            return False

        return self.validator.validar_cadeia(chain)

    def substituir_cadeia(self, candidate_chain: list[Block]) -> bool:
        """Troca a cadeia ativa quando a candidata e valida e melhor."""

        if not self.validar_cadeia(candidate_chain):
            return False

        if self.consensus.comparar_cadeias(self.chain, candidate_chain) != 1:
            return False

        # Guardamos a cadeia antiga porque ela pode virar um fork valido.
        cadeia_antiga = self.copiar_cadeia()
        self.chain = deepcopy(candidate_chain)
        self._remover_cadeia_candidata(candidate_chain)
        self._registrar_cadeia_candidata(cadeia_antiga)
        return True

    def obter_trabalho_acumulado(self, chain: list[Block]) -> int:
        """Na V1, isso ainda e so o tamanho da cadeia."""

        return self.consensus.obter_trabalho_acumulado(chain)

    def resolver_conflito(self, candidate_chain: list[Block]) -> bool:
        """Se a candidata for melhor, ela vira a cadeia ativa."""

        return self.substituir_cadeia(candidate_chain)

    def copiar_cadeia(self) -> list[Block]:
        """Usamos copia para evitar alterar a cadeia original sem querer."""

        return deepcopy(self.chain)

    def processar_bloco_recebido(self, payload: dict[str, object]) -> str:
        """Recebe o payload pronto da comunicacao e tenta encaixar o bloco."""

        from src.core.serialization.json_codec import bloco_de_dict

        block = bloco_de_dict(payload)
        if block is None:
            return STATUS_PAYLOAD_INVALIDO

        if block.miner_id is not None and block.miner_id == self.config.node_id:
            return STATUS_BLOCO_IGNORADO_PROPRIO_NO

        return self._processar_bloco(block)

    def _processar_bloco(self, block: Block) -> str:
        """Aqui fica a decisao principal: ativa, fork ou rejeicao."""

        previous_block = self.obter_ultimo_bloco()
        if self.validar_bloco(block, previous_block):
            self.chain.append(deepcopy(block))
            return STATUS_BLOCO_ADICIONADO

        # Primeiro tentamos ver se o bloco continua algum fork que ja conhecemos.
        cadeia_estendida = self._tentar_estender_candidata_existente(block)
        if cadeia_estendida is not None:
            self._registrar_cadeia_candidata(cadeia_estendida)
            if self.resolver_conflito(cadeia_estendida):
                return STATUS_CADEIA_REORGANIZADA
            return STATUS_BLOCO_FORK

        # Se nao continuar um fork conhecido, pode ser o comeco de uma nova ramificacao.
        cadeia_fork = self._tentar_criar_fork_da_cadeia_ativa(block)
        if cadeia_fork is not None:
            self._registrar_cadeia_candidata(cadeia_fork)
            if self.resolver_conflito(cadeia_fork):
                return STATUS_CADEIA_REORGANIZADA
            return STATUS_BLOCO_FORK

        return STATUS_BLOCO_REJEITADO

    def _tentar_estender_candidata_existente(self, block: Block) -> list[Block] | None:
        """Tenta encaixar o bloco no final de algum fork ja salvo."""

        for cadeia in self.cadeias_candidatas:
            previous_block = cadeia[-1]
            if block.previous_hash != previous_block.block_hash:
                continue
            if not self.validar_bloco(block, previous_block):
                continue

            nova_cadeia = deepcopy(cadeia)
            nova_cadeia.append(deepcopy(block))
            return nova_cadeia

        return None

    def _tentar_criar_fork_da_cadeia_ativa(self, block: Block) -> list[Block] | None:
        """Tenta abrir uma nova ramificacao a partir de um ancestral da ativa."""

        for index, previous_block in enumerate(self.chain[:-1]):
            if block.previous_hash != previous_block.block_hash:
                continue
            if not self.validar_bloco(block, previous_block):
                continue

            nova_cadeia = deepcopy(self.chain[: index + 1])
            nova_cadeia.append(deepcopy(block))
            return nova_cadeia

        return None

    def _registrar_cadeia_candidata(self, candidate_chain: list[Block]) -> None:
        """Guarda a cadeia candidata mais atual para cada ponta conhecida."""

        if candidate_chain == self.chain:
            return

        tip_hash = candidate_chain[-1].block_hash
        for index, cadeia_existente in enumerate(self.cadeias_candidatas):
            if cadeia_existente[-1].block_hash == tip_hash:
                self.cadeias_candidatas[index] = deepcopy(candidate_chain)
                return

            # Se a nova cadeia for so uma continuacao da antiga, substituimos.
            if len(candidate_chain) >= len(cadeia_existente) and candidate_chain[: len(cadeia_existente)] == cadeia_existente:
                self.cadeias_candidatas[index] = deepcopy(candidate_chain)
                return

            # Se a antiga ja for uma versao maior da nova, nao faz sentido guardar de novo.
            if len(cadeia_existente) > len(candidate_chain) and cadeia_existente[: len(candidate_chain)] == candidate_chain:
                return

        self.cadeias_candidatas.append(deepcopy(candidate_chain))

    def _remover_cadeia_candidata(self, candidate_chain: list[Block]) -> None:
        """Remove a candidata que acabou virando ativa ou deixou de importar."""

        tip_hash = candidate_chain[-1].block_hash
        self.cadeias_candidatas = [
            cadeia for cadeia in self.cadeias_candidatas if cadeia[-1].block_hash != tip_hash
        ]

    def create_genesis_block(self) -> Block:
        """Alias de compatibilidade para `criar_bloco_genesis`."""

        return self.criar_bloco_genesis()

    def get_last_block(self) -> Block:
        """Alias de compatibilidade para `obter_ultimo_bloco`."""

        return self.obter_ultimo_bloco()

    def add_block(self, block: Block) -> bool:
        """Alias de compatibilidade para `adicionar_bloco`."""

        return self.adicionar_bloco(block)

    def is_valid_block(self, block: Block, previous_block: Block) -> bool:
        """Alias de compatibilidade para `validar_bloco`."""

        return self.validar_bloco(block, previous_block)

    def is_valid_chain(self, chain: list[Block]) -> bool:
        """Alias de compatibilidade para `validar_cadeia`."""

        return self.validar_cadeia(chain)

    def replace_chain(self, candidate_chain: list[Block]) -> bool:
        """Alias de compatibilidade para `substituir_cadeia`."""

        return self.substituir_cadeia(candidate_chain)

    def get_cumulative_work(self, chain: list[Block]) -> int:
        """Alias de compatibilidade para `obter_trabalho_acumulado`."""

        return self.obter_trabalho_acumulado(chain)

    def resolve_conflict(self, candidate_chain: list[Block]) -> bool:
        """Alias de compatibilidade para `resolver_conflito`."""

        return self.resolver_conflito(candidate_chain)

    def handle_incoming_block(self, block_dict: dict[str, object]) -> str:
        """Alias de compatibilidade para `processar_bloco_recebido`."""

        return self.processar_bloco_recebido(block_dict)
