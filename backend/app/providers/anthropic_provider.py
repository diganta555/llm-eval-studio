import time
import os
from typing import List, Dict, Any, Optional
import anthropic
from anthropic import Anthropic, RateLimitError, APITimeoutError, AuthenticationError, APIStatusError
from app.providers.base import LLMProvider, GenerationResult
from app.core.security import sanitize_error_message
from app.core.logging import logger
from app.core.config import settings

# Mapping for common Claude model aliases to current live models
MODEL_ALIASES = {
    "claude-3-5-sonnet": "claude-sonnet-4-5-20250929",
    "claude-3-5-sonnet-20241022": "claude-sonnet-4-5-20250929",
    "claude-3-5-sonnet-latest": "claude-sonnet-4-5-20250929",
    "claude-3-haiku": "claude-haiku-4-5-20251001",
    "claude-3-haiku-20240307": "claude-haiku-4-5-20251001",
    "claude-3-opus": "claude-opus-4-5-20251101",
    "claude-3-opus-20240229": "claude-opus-4-5-20251101",
    "claude-sonnet": "claude-sonnet-4-5-20250929",
    "claude-haiku": "claude-haiku-4-5-20251001",
    "claude-opus": "claude-opus-4-5-20251101",
}

class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self._client: Optional[Anthropic] = None
        if self.api_key:
            self._client = Anthropic(api_key=self.api_key)

    def _get_client(self) -> Anthropic:
        if self._client:
            return self._client
        key = self.api_key or getattr(settings, "ANTHROPIC_API_KEY", None) or os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise ValueError("Anthropic API key not configured. Please set ANTHROPIC_API_KEY in backend/.env or configure in Model Settings.")
        self._client = Anthropic(api_key=key)
        return self._client

    def generate(
        self,
        messages: List[Dict[str, str]],
        model_name: str = "claude-sonnet-4-5-20250929",
        parameters: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = 30.0
    ) -> GenerationResult:
        client = self._get_client()
        params = parameters or {}
        temperature = float(params.get("temperature", 0.0))
        max_tokens = int(params.get("max_tokens", 1000))
        top_p = float(params.get("top_p", 1.0))

        # Resolve alias if available
        resolved_model = MODEL_ALIASES.get(model_name.lower().strip(), model_name.strip())

        # Anthropic messages API requires separating system prompt from user/assistant messages
        system_prompt = None
        anthropic_messages = []

        for msg in messages:
            role = msg.get("role", "user").lower()
            content = msg.get("content", "")
            if role == "system":
                system_prompt = content
            elif role in ("user", "assistant"):
                anthropic_messages.append({"role": role, "content": content})
            else:
                anthropic_messages.append({"role": "user", "content": content})

        # Anthropic requires at least one user message
        if not anthropic_messages:
            anthropic_messages = [{"role": "user", "content": "Hello"}]

        start_time = time.perf_counter()
        retries = 2
        last_exception = None

        for attempt in range(retries + 1):
            try:
                extra_body: Dict[str, Any] = {
                    "temperature": temperature,
                }
                if top_p < 1.0:
                    extra_body["top_p"] = top_p

                create_kwargs: Dict[str, Any] = {
                    "model": resolved_model,
                    "messages": anthropic_messages,
                    "max_tokens": max_tokens,
                    "extra_body": extra_body,
                    "timeout": timeout or 30.0,
                }
                if system_prompt:
                    create_kwargs["system"] = system_prompt

                response = client.messages.create(**create_kwargs)
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

                text = ""
                if response.content:
                    text_parts = [block.text for block in response.content if hasattr(block, "text")]
                    text = "".join(text_parts)

                prompt_tokens = response.usage.input_tokens if response.usage else None
                completion_tokens = response.usage.output_tokens if response.usage else None
                total_tokens = (prompt_tokens + completion_tokens) if (prompt_tokens is not None and completion_tokens is not None) else None
                request_id = getattr(response, "id", None)
                finish_reason = getattr(response, "stop_reason", None)

                return GenerationResult(
                    text=text,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    latency_ms=latency_ms,
                    request_id=request_id,
                    finish_reason=finish_reason,
                    model=model_name,
                    is_mock=False
                )
            except RateLimitError as e:
                last_exception = e
                logger.warning(f"Anthropic Rate limit encountered, retrying in {attempt + 1}s: {e}")
                time.sleep(attempt + 1)
            except APITimeoutError as e:
                last_exception = e
                logger.warning(f"Anthropic Timeout encountered on attempt {attempt + 1}: {e}")
                if attempt == retries:
                    break
                time.sleep(1)
            except AuthenticationError as e:
                logger.error(f"Anthropic Authentication error: {e}")
                raise ValueError("Invalid Anthropic API Key. Please verify your ANTHROPIC_API_KEY credentials.")
            except APIStatusError as e:
                last_exception = e
                logger.error(f"Anthropic API status error: {e}")
                if attempt == retries:
                    break
                time.sleep(1)
            except Exception as e:
                last_exception = e
                break

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        safe_msg = sanitize_error_message(last_exception) if last_exception else "Unknown Anthropic generation failure"
        return GenerationResult(
            text="",
            latency_ms=latency_ms,
            model=model_name,
            is_mock=False,
            error=safe_msg
        )
