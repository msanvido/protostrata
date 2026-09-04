Feature: Transparent Confidence Gating & Expert Review Escalation
  As a compliance lead
  I want low-confidence or ambiguous interpretations escalated to expert review
  So that ungrounded or ambiguous claims never generate unauthorized operational tasks

  Scenario: Escalate ambiguous emergency generation language in EPA NSPS KKKK
    Given the Strata workspace is initialized with enterprise projects
    When the system analyzes differences between "EPA-NSPS-KKKK_draft_revision" and "EPA-NSPS-KKKK_final_rule"
    Then the system should identify an ambiguous term with confidence "LOW"
    And the low-confidence item should be routed to the Expert Review Queue
    And when expert reviewer "u_counsel" resolves the item with decision "CONFIRMED_APPLICABLE"
    Then the expert resolution and rationale should be recorded successfully
