"""Contrato mínimo do domínio de supply chain usado pelo projeto."""

EVENTO_CADASTRAR_MATERIA_PRIMA = "CADASTRAR_MATERIA_PRIMA"
EVENTO_FABRICAR_PRODUTO_SIMPLES = "FABRICAR_PRODUTO_SIMPLES"
EVENTO_FABRICAR_PRODUTO_COMPOSTO = "FABRICAR_PRODUTO_COMPOSTO"

ENTIDADE_MATERIA_PRIMA = "raw_material"
ENTIDADE_PRODUTO_SIMPLES = "simple_product"
ENTIDADE_PRODUTO_COMPOSTO = "composite_product"

PAPEL_FORNECEDOR = "FORNECEDOR"
PAPEL_FABRICANTE = "FABRICANTE"
PAPEL_MONTADORA = "MONTADORA"

TIPOS_EVENTO_SUPPLY_CHAIN = (
    EVENTO_CADASTRAR_MATERIA_PRIMA,
    EVENTO_FABRICAR_PRODUTO_SIMPLES,
    EVENTO_FABRICAR_PRODUTO_COMPOSTO,
)

TIPOS_ENTIDADE_SUPPLY_CHAIN = (
    ENTIDADE_MATERIA_PRIMA,
    ENTIDADE_PRODUTO_SIMPLES,
    ENTIDADE_PRODUTO_COMPOSTO,
)

PAPEIS_ATOR_SUPPLY_CHAIN = (
    PAPEL_FORNECEDOR,
    PAPEL_FABRICANTE,
    PAPEL_MONTADORA,
)

TIPO_ENTIDADE_ESPERADO_POR_EVENTO = {
    EVENTO_CADASTRAR_MATERIA_PRIMA: ENTIDADE_MATERIA_PRIMA,
    EVENTO_FABRICAR_PRODUTO_SIMPLES: ENTIDADE_PRODUTO_SIMPLES,
    EVENTO_FABRICAR_PRODUTO_COMPOSTO: ENTIDADE_PRODUTO_COMPOSTO,
}


def tipo_evento_valido(tipo_evento: str) -> bool:
    """Confere se o tipo faz parte do contrato atual do projeto."""

    return tipo_evento in TIPOS_EVENTO_SUPPLY_CHAIN


def tipo_entidade_valido(tipo_entidade: str) -> bool:
    """Confere se o tipo de entidade faz parte do contrato atual."""

    return tipo_entidade in TIPOS_ENTIDADE_SUPPLY_CHAIN


def papel_ator_valido(papel_ator: str) -> bool:
    """Confere se o papel do ator faz parte do contrato atual do projeto."""

    return papel_ator in PAPEIS_ATOR_SUPPLY_CHAIN


def tipo_entidade_esperado_por_evento(tipo_evento: str) -> str | None:
    """Retorna o tipo de entidade criado por cada evento do domínio."""

    return TIPO_ENTIDADE_ESPERADO_POR_EVENTO.get(tipo_evento)
