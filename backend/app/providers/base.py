from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Protocol

@dataclass
class GenerationResult:
    text: str
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    latency_ms: float = 0.0
    request_id: Optional[str] = None
    finish_reason: Optional[str] = None
    model: str = ""
    is_mock: bool = False
    error: Optional[str] = None

class LLMProvider(Protocol):
    def generate(
        self,
        messages: List[Dict[str, str]],
        model_name: str,
        parameters: Dict[str, Any],
        timeout: Optional[float] = None
    ) -> GenerationResult:
        """Executes a completion request and returns a normalized GenerationResult."""
        ...
