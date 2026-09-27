import time
from typing import List, Dict, Any, Optional
import openai
from openai import OpenAI, OpenAIError, RateLimitError, APITimeoutError, AuthenticationError
from app.providers.base import LLMProvider, GenerationResult
from app.core.security import sanitize_error_message
from app.core.logging import logger

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        self._client: Optional[OpenAI] = None
        if self.api_key:
            self._client = OpenAI(api_key=self.api_key)

    def _get_client(self) -> OpenAI:
        if self._client:
            return self._client
        # Try finding key from environment
        import os
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise ValueError("OpenAI API key not configured. Please set OPENAI_API_KEY or use Mock Provider.")
        self._client = OpenAI(api_key=key)
        return self._client

    def generate(
        self,
        messages: List[Dict[str, str]],
        model_name: str = "gpt-4o-mini",
        parameters: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = 30.0
    ) -> GenerationResult:
        client = self._get_client()
        params = parameters or {}
        temperature = float(params.get("temperature", 0.0))
        max_tokens = int(params.get("max_tokens", 1000))
        top_p = float(params.get("top_p", 1.0))

        start_time = time.perf_counter()
        retries = 2
        last_exception = None

        for attempt in range(retries + 1):
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    top_p=top_p,
                    timeout=timeout
                )
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                
                choice = response.choices[0]
                text = choice.message.content or ""
                finish_reason = choice.finish_reason
                
                prompt_tokens = response.usage.prompt_tokens if response.usage else None
                completion_tokens = response.usage.completion_tokens if response.usage else None
                total_tokens = response.usage.total_tokens if response.usage else None
                request_id = getattr(response, "id", None)

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
                logger.warning(f"OpenAI Rate limit encountered, retrying in {attempt + 1}s: {e}")
                time.sleep(attempt + 1)
            except APITimeoutError as e:
                last_exception = e
                logger.warning(f"OpenAI Timeout encountered on attempt {attempt + 1}: {e}")
                if attempt == retries:
                    break
                time.sleep(1)
            except AuthenticationError as e:
                logger.error(f"OpenAI Authentication error: {e}")
                raise ValueError("Invalid OpenAI API Key. Please verify your credentials.")
            except OpenAIError as e:
                last_exception = e
                logger.error(f"OpenAI API error: {e}")
                if attempt == retries:
                    break
                time.sleep(1)
            except Exception as e:
                last_exception = e
                break

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        safe_msg = sanitize_error_message(last_exception) if last_exception else "Unknown generation failure"
        return GenerationResult(
            text="",
            latency_ms=latency_ms,
            model=model_name,
            is_mock=False,
            error=safe_msg
        )
