Feature: Living Project State & Defensible Audit Trail
  As an auditor or compliance officer
  I want an append-only living history of all decisions, impacts, and human overrides
  So that I can defend our compliance timeline during an examination

  Scenario: Reconstruct living timeline and record non-destructive human override
    Given the Strata workspace has completed analysis of "EPA-NSPS-KKKK"
    When reviewer "u_reviewer" records an override on an action for "OBL-CEMS-02"
    Then the action state should transition to "MODIFIED"
    And the original action text must remain preserved in the audit event log
    And the reconstructed living audit dossier for "obligation:OBL-CEMS-02" must contain all historical events
