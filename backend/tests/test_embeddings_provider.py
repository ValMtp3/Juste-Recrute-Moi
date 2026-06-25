from data.vector import embeddings


def test_openai_provider_unloads_local_onnx_session(monkeypatch):
    monkeypatch.setattr(embeddings, "_configured_provider", lambda: "openai")
    monkeypatch.setattr(embeddings, "_openai_api_key", lambda: "sk-test")

    embeddings._onnx_session = object()
    embeddings._onnx_tokenizer = object()
    embeddings._onnx_error = "previous load error"
    embeddings._onnx_loaded = True
    embeddings._last_onnx_fallback_error = "previous load error"

    assert embeddings.active_provider() == "openai"
    assert embeddings._onnx_session is None
    assert embeddings._onnx_tokenizer is None
    assert embeddings._onnx_error == ""
    assert embeddings._onnx_loaded is False
    assert embeddings._last_onnx_fallback_error is None
