import pytest
from strata.pipeline.confidence import ConfidenceRubric
from strata.models.analysis import ConfidenceTier

def test_confidence_rubric_signals():
    # Citation failure forces LOW
    conf, reason = ConfidenceRubric.evaluate(["SIG_CITE_FAIL: span mismatch", "SIG_HIGH_STAKES"])
    assert conf == ConfidenceTier.LOW
    assert "verification failed" in reason
    assert ConfidenceRubric.should_escalate_to_expert_review(conf) is True

    # Undefined ambiguous term forces LOW
    conf, reason = ConfidenceRubric.evaluate(["SIG_AMBIG_TERM: undefined phrasing"])
    assert conf == ConfidenceTier.LOW
    assert "ambiguous" in reason
    assert ConfidenceRubric.should_escalate_to_expert_review(conf) is True

    # High stakes or rank tie caps at MEDIUM
    conf, reason = ConfidenceRubric.evaluate(["SIG_HIGH_STAKES: deadline change"])
    assert conf == ConfidenceTier.MEDIUM
    assert ConfidenceRubric.should_escalate_to_expert_review(conf) is False

    # Clean citations and distinct match eligible for HIGH
    conf, reason = ConfidenceRubric.evaluate(["SIG_CLEAN_GROUND"])
    assert conf == ConfidenceTier.HIGH
    assert ConfidenceRubric.should_escalate_to_expert_review(conf) is False
