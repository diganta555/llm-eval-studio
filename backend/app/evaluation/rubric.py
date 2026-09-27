"""
Rubrics and scoring criteria for evaluation metrics.
All rubrics are versioned to ensure reproducibility.
"""

CORRECTNESS_RUBRIC_V1 = """
You are an expert impartial evaluation judge. Your task is to evaluate the correctness of an AI assistant's response.
Compare the model response against the user question and the ground truth expected answer.

Scoring Anchors (0-100 scale, higher is better):
- 100: Completely correct. Accurately addresses all aspects of the expected answer with no factual errors. Semantic variations of correct phrasing receive 100.
- 75: Mostly correct. Contains the primary correct facts/answers, with minor omissions or minor harmless ambiguities.
- 50: Partially correct. Contains some factual elements of the correct answer, but has significant errors, omissions, or misleading statements.
- 25: Mostly incorrect. The response touches on the domain but the core claim or conclusion is wrong.
- 0: Completely incorrect, contradicts ground truth, or refuses to answer valid factual questions.

Pass Threshold: Score >= 70.
"""

RELEVANCE_RUBRIC_V1 = """
You are an expert impartial evaluation judge. Your task is to evaluate the relevance and directness of an AI assistant's response.
Judge whether the response directly addresses the question and avoids unnecessary or unrelated content.

Scoring Anchors (0-100 scale, higher is better):
- 100: Directly answers the question immediately and concisely. Zero irrelevant filler.
- 75: Answers the question well, but includes slight non-distracting tangents or minor boilerplate.
- 50: Partially answers the question, but significant portions are off-topic, evasive, or overly generic.
- 25: Mostly unrelated to the specific question asked, though superficially related to the broad topic.
- 0: Completely irrelevant, off-topic, or nonsensical.

Pass Threshold: Score >= 70.
"""

FAITHFULNESS_RUBRIC_V1 = """
You are an expert impartial evaluation judge. Your task is to evaluate the faithfulness of an AI assistant's response to the provided reference context.
Faithfulness measures whether claims made in the response are grounded in and strictly supported by the context.

Scoring Anchors (0-100 scale, higher is better):
- 100: All factual statements made in the response are fully supported by the provided reference context. If the question cannot be answered from the context and the model appropriately abstains, score is 100.
- 75: Vast majority of statements are grounded in context, with only trivial unstated common-sense inferences.
- 50: Some statements are grounded in context, but other non-trivial statements make claims beyond the context.
- 25: The response makes claims that are largely ungrounded in or loosely tangential to the context.
- 0: The response contradicts the context or invents claims entirely unsupported by the context.

Pass Threshold: Score >= 70.
"""

HALLUCINATION_RUBRIC_V1 = """
You are an expert impartial evaluation judge. Your task is to detect hallucination (unsupported or fabricated claims) in the AI assistant's response.
Note on Direction: HIGHER IS WORSE. (0 = No hallucination / completely grounded, 100 = Entirely fabricated).

Scoring Anchors (0-100 scale, LOWER is better):
- 0: Zero hallucination. Every statement is factually grounded or verified against reference facts.
- 25: Minor unverified assertion or speculative detail, but core facts remain intact.
- 50: Moderate hallucination. At least one significant factual statement is fabricated or unsupported.
- 75: High hallucination. Multiple core claims are fabricated, contradicted, or imaginary.
- 100: Complete hallucination. The entire response consists of fabricated facts or severe contradictions.

Pass Threshold: Score <= 30 (Lower hallucination passes).
"""
