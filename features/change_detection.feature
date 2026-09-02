Feature: Regulatory Change Detection & Citation Grounding
  As a compliance analyst
  I want the system to detect material changes between successive regulatory proceeding versions
  And ground every claim in verifiable, paired citations

  Scenario: Detect material cluster study timeline changes in FERC Order 2023
    Given the Strata workspace is initialized with energy regulations
    When the system analyzes differences between "FERC-RM22-14_nopr" and "FERC-RM22-14_final_rule"
    Then the system should detect at least 3 material changes
    And the system should detect a status transition from "PROPOSED" to "FINAL"
    And every material change record must contain a valid citation referencing the source text
