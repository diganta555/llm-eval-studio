import time
import random
import uuid
from typing import List, Dict, Any, Optional
from app.providers.base import LLMProvider, GenerationResult

class MockProvider(LLMProvider):
    """
    A realistic offline mock provider for testing the studio, running dry-runs,
    and verifying the complete evaluation pipeline without external API credentials.
    """
    def __init__(self, latency_range: tuple = (120, 260)):
        self.latency_range = latency_range

    def generate(
        self,
        messages: List[Dict[str, str]],
        model_name: str = "mock-eval-model",
        parameters: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = 30.0
    ) -> GenerationResult:
        start_time = time.perf_counter()
        
        # Simulate realistic network/processing latency
        simulated_delay = random.uniform(self.latency_range[0] / 1000.0, self.latency_range[1] / 1000.0)
        time.sleep(simulated_delay)
        
        # Extract user question from messages
        user_content = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                user_content = m.get("content", "")
                break

        user_lower = user_content.lower()

        # Generate realistic domain responses based on context / question
        if "python" in user_lower:
            text = (
                "Python is a high-level, interpreted, general-purpose programming language. "
                "Its design philosophy emphasizes code readability with the use of significant indentation. "
                "It is dynamically typed and garbage-collected, supporting multiple programming paradigms."
            )
        elif "api" in user_lower:
            text = (
                "An Application Programming Interface (API) is a formal set of rules and protocols "
                "that enables different software applications and system components to communicate, "
                "exchange data, and execute services seamlessly."
            )
        elif "novatech" in user_lower or "founding year" in user_lower or "what year was" in user_lower:
            # Context-abstention case from demo dataset
            if "novatech solutions" in user_lower:
                text = (
                    "Based on the provided context, the founding year of NovaTech Solutions is not mentioned. "
                    "The context only specifies that it is an enterprise cloud software company based in Seattle."
                )
            else:
                text = "Based on the provided context, this information is not specified."
        elif "galileo" in user_lower or "telescope" in user_lower or "jupiter" in user_lower:
            text = (
                "In 1610, Italian astronomer Galileo Galilei observed the four largest moons of Jupiter "
                "using a telescope he constructed himself. These moons are Io, Europa, Ganymede, and Callisto."
            )
        elif "process and thread" in user_lower:
            text = (
                "A process is an independent executing program with its own dedicated memory space and system resources. "
                "A thread is a lightweight unit of execution within a process that shares the address space and resources "
                "with peer threads in the same process."
            )
        elif "acid" in user_lower:
            text = (
                "ACID properties in database transaction management stand for Atomicity, Consistency, "
                "Isolation, and Durability. Together, they guarantee that database transactions are executed reliably "
                "even in the event of failures, power outages, or concurrent operations."
            )
        else:
            text = f"The model has processed the query: '{user_content[:60]}...' and verified that all relevant parameters meet the specified criteria."

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        
        # Realistic token calculation (roughly 4 chars per token)
        prompt_tokens = max(10, sum(len(m.get("content", "")) for m in messages) // 4)
        completion_tokens = max(15, len(text) // 4)
        total_tokens = prompt_tokens + completion_tokens

        return GenerationResult(
            text=text,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
            request_id=f"mock-req-{uuid.uuid4().hex[:10]}",
            finish_reason="stop",
            model=model_name or "mock-eval-model",
            is_mock=True
        )
