from typing import List, Dict, Any, Optional

def compute_calibration_stats(
    pairs: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Computes calibration metrics between judge scores and human review scores.
    Each pair contains: {"judge_score": float, "human_score": float, "metric_name": str}
    """
    valid_pairs = [p for p in pairs if p.get("judge_score") is not None and p.get("human_score") is not None]
    if not valid_pairs:
        return {
            "sample_size": 0,
            "mean_absolute_error": 0.0,
            "mean_signed_error": 0.0,
            "agreement_rate_10pct": 0.0,
            "agreement_rate_20pct": 0.0,
        }

    n = len(valid_pairs)
    errors = [p["judge_score"] - p["human_score"] for p in valid_pairs]
    abs_errors = [abs(e) for e in errors]

    mae = sum(abs_errors) / n
    mse = sum(errors) / n

    # Within 10 points and 20 points
    within_10 = sum(1 for e in abs_errors if e <= 10.0) / n * 100.0
    within_20 = sum(1 for e in abs_errors if e <= 20.0) / n * 100.0

    return {
        "sample_size": n,
        "mean_absolute_error": round(mae, 2),
        "mean_signed_error": round(mse, 2),
        "agreement_rate_10pct": round(within_10, 1),
        "agreement_rate_20pct": round(within_20, 1),
    }
