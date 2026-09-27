from typing import Optional
from app.providers.base import LLMProvider, GenerationResult
from app.providers.openai_provider import OpenAIProvider
from app.providers.anthropic_provider import AnthropicProvider
from app.providers.mock_provider import MockProvider
from app.core.config import settings

def get_provider(provider_type: str = "openai", api_key: Optional[str] = None) -> LLMProvider:
    provider_type = provider_type.lower()
    if provider_type == "mock":
        return MockProvider()
    elif provider_type in ("openai", "gpt"):
        effective_key = api_key or settings.OPENAI_API_KEY
        if not effective_key:
            # If no OpenAI key configured anywhere, fall back cleanly or notify
            return MockProvider()
        return OpenAIProvider(api_key=effective_key)
    elif provider_type in ("anthropic", "claude"):
        effective_key = api_key or settings.ANTHROPIC_API_KEY
        if not effective_key:
            return MockProvider()
        return AnthropicProvider(api_key=effective_key)
    else:
        raise ValueError(f"Unsupported provider: {provider_type}")

__all__ = [
    "LLMProvider",
    "GenerationResult",
    "OpenAIProvider",
    "AnthropicProvider",
    "MockProvider",
    "get_provider"
]
