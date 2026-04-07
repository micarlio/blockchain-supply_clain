"""Testes unitarios do modelo de evento."""

from src.core.models.event import SupplyChainEvent


def criar_evento_valido() -> SupplyChainEvent:
    """Retorna um evento valido para os testes."""

    return SupplyChainEvent(
        event_id="evt-001",
        event_type="CREATE_RAW_MATERIAL",
        product_id="lot-001",
        product_name="Leite Cru",
        actor_id="produtor-01",
        actor_role="PRODUCER",
        timestamp="2026-04-01T10:00:00Z",
        input_ids=["origem-001"],
        metadata={"origin": "Fazenda A", "quantity": 100, "unit": "L"},
    )


def test_evento_valido_passa_na_validacao_basica() -> None:
    """Um evento bem formado deve ser aceito."""

    event = criar_evento_valido()

    assert event.validar_basico() is True
    assert event.validate_basic() is True


def test_para_dict_e_de_dict_preservam_o_payload() -> None:
    """O round-trip do evento deve manter os mesmos dados."""

    event = criar_evento_valido()
    payload = event.para_dict()

    reconstruido = SupplyChainEvent.de_dict(payload)

    assert reconstruido == event
    assert reconstruido.para_dict() == payload
    assert reconstruido.to_dict() == payload


def test_evento_com_metadata_nao_serializavel_falha_na_validacao() -> None:
    """Objetos nao serializaveis devem invalidar o evento."""

    event = criar_evento_valido()
    event.metadata["invalid"] = object()

    assert event.validar_basico() is False


def test_de_dict_retorna_none_quando_input_ids_saem_do_contrato() -> None:
    """Quando o payload foge do formato esperado, o parse volta `None`."""

    payload = criar_evento_valido().para_dict()
    payload["input_ids"] = ["ok", ""]

    assert SupplyChainEvent.de_dict(payload) is None
