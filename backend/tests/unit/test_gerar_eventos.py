from scripts.gerar_eventos import gerar_eventos_aleatorios
from src.core.models.event import SupplyChainEvent
from src.core.services.validator import Validator


def test_gerador_com_mesma_seed_reproduz_a_mesma_sequencia():
    primeira = gerar_eventos_aleatorios(seed=42, quantidade=9)
    segunda = gerar_eventos_aleatorios(seed=42, quantidade=9)
    terceira = gerar_eventos_aleatorios(seed=7, quantidade=9)

    assert primeira == segunda
    assert primeira != terceira


def test_gerador_produz_eventos_validos_no_contexto_do_dominio():
    eventos = gerar_eventos_aleatorios(seed=10, quantidade=9)
    objetos = [SupplyChainEvent.de_dict(item) for item in eventos]

    assert all(evento is not None for evento in objetos)

    validador = Validator()
    contexto = validador.construir_contexto_eventos([evento for evento in objetos if evento is not None])
    assert contexto is not None
