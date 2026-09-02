Feature: Semantic Impact Mapping & Dual Citation Grounding
  As an obligation owner
  I want regulatory changes mapped to my specific project and compliance obligations
  Backed by verifiable quotations from both the regulation and internal documents

  Scenario: Map FERC Order 2023 Inverter Ride-Through to Desert Solar Project
    Given the Strata workspace is initialized with enterprise projects
    When the system analyzes differences between "FERC-RM22-14_nopr" and "FERC-RM22-14_final_rule"
    Then the system should map at least one impact to project "PROJ-SOLAR-DESERT-02" or obligation "OBL-RIDETHRU-03"
    And every impact mapping must include a verified regulatory citation and an affected asset citation
    And the recommended action urgency should be "ACT_NOW" because the proceeding status is "FINAL"
