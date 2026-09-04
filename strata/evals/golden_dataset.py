from typing import List, Dict, Any

# Curated Golden Evaluation Benchmark Dataset for Regulatory Intelligence
# Covers FERC Order 2023 (Interconnection), EPA NSPS Subpart KKKK (Turbines),
# NERC CIP physical security, and enterprise capital asset mappings.

MATERIALITY_BENCHMARK_CASES: List[Dict[str, Any]] = [
    {
        "id": "mat_ferc_cluster_study",
        "description": "Cluster study timeline transition from 180 days to mandatory 150 days with $2,500/day penalties.",
        "diff_type": "MODIFIED",
        "before_text": "Transmission providers shall make reasonable efforts to complete interconnection feasibility and system impact studies within 180 calendar days.",
        "after_text": "Transmission providers must transition to a first-ready, first-served cluster study process and complete all cluster studies within 150 calendar days. Failure to meet these study deadlines shall subject the transmission provider to civil financial penalties of $2,500 per day until completed.",
        "expected_materiality": "MATERIAL",
        "expected_change_type": "DEADLINE_SHIFT",
        "expected_verbatim_phrases": ["150 calendar days", "$2,500 per day"]
    },
    {
        "id": "mat_ferc_ride_through",
        "description": "Mandatory IEEE 2800 inverter ride-through requirements for all newly interconnecting resources.",
        "diff_type": "MODIFIED",
        "before_text": "Large generating facilities must ride through abnormal frequency and voltage events to the extent practicable.",
        "after_text": "All newly interconnecting solar photovoltaic, battery storage, and inverter-based generation facilities must maintain continuous voltage and frequency ride-through capability in full compliance with IEEE Standard 2800-2022 during abnormal transmission system events.",
        "expected_materiality": "MATERIAL",
        "expected_change_type": "NEW_REQUIREMENT",
        "expected_verbatim_phrases": ["IEEE Standard 2800-2022", "continuous voltage and frequency ride-through capability"]
    },
    {
        "id": "mat_epa_nox_tightening",
        "description": "Stationary combustion turbine NOx emission ceiling reduction to 2.5 ppmvd.",
        "diff_type": "MODIFIED",
        "before_text": "Nitrogen oxides (NOx) emissions from stationary combustion turbines shall not exceed 15 ppm at 15 percent O2.",
        "after_text": "Nitrogen oxides (NOx) emissions from new or reconstructed stationary combustion turbines firing natural gas shall not exceed 2.5 ppmvd at 15 percent O2 on a 4-hour rolling average, achievable through selective catalytic reduction (SCR).",
        "expected_materiality": "MATERIAL",
        "expected_change_type": "NEW_REQUIREMENT",
        "expected_verbatim_phrases": ["2.5 ppmvd at 15 percent O2", "selective catalytic reduction (SCR)"]
    },
    {
        "id": "mat_epa_cems_reporting",
        "description": "Quarterly CEMS compliance reporting window shortened to 30 days.",
        "diff_type": "MODIFIED",
        "before_text": "The owner or operator shall submit continuous monitoring summaries on a semi-annual basis within 60 days following the reporting period.",
        "after_text": "The owner or operator shall submit certified CEMS compliance data electronically on a quarterly basis within 30 days of the end of each calendar quarter.",
        "expected_materiality": "MATERIAL",
        "expected_change_type": "DEADLINE_SHIFT",
        "expected_verbatim_phrases": ["quarterly basis within 30 days"]
    },
    {
        "id": "mat_epa_scope_expansion",
        "description": "Expansion of regulatory applicability threshold down to smaller generating capacity.",
        "diff_type": "MODIFIED",
        "before_text": "The provisions of this subpart apply to each stationary combustion turbine with a heat input at peak load equal to or greater than 50 MMBtu/h.",
        "after_text": "The provisions of this subpart apply to covered entities with a capacity threshold equal to or greater than 10 MMBtu/h, expanding the regulatory scope.",
        "expected_materiality": "MATERIAL",
        "expected_change_type": "SCOPE_CHANGE",
        "expected_verbatim_phrases": ["covered entities", "capacity threshold equal to or greater than 10 MMBtu/h"]
    },
    {
        "id": "mat_ferc_repeal_feasibility_study",
        "description": "Removal of legacy individualized preliminary feasibility study requirement.",
        "diff_type": "REMOVED",
        "before_text": "Transmission providers shall conduct an individual preliminary feasibility study for each interconnection customer upon request.",
        "after_text": "",
        "expected_materiality": "MATERIAL",
        "expected_change_type": "REQUIREMENT_REMOVED",
        "expected_verbatim_phrases": ["preliminary feasibility study"]
    },
    {
        "id": "mat_definition_clarification",
        "description": "Formalized statutory definition for continuous parameter monitoring systems.",
        "diff_type": "MODIFIED",
        "before_text": "The term parameter monitoring means measuring process conditions.",
        "after_text": "The term continuous parameter monitoring system is defined as the automated sensor telemetry and real-time alarms required to verify continuous compliance.",
        "expected_materiality": "MATERIAL",
        "expected_change_type": "DEFINITION_CHANGE",
        "expected_verbatim_phrases": ["is defined as the automated sensor telemetry"]
    },
    {
        "id": "mat_editorial_formatting",
        "description": "Non-substantive grammatical and sub-clause formatting update.",
        "diff_type": "MODIFIED",
        "before_text": "Definitions under this section apply throughout the subpart unless otherwise noted.",
        "after_text": "Definitions under this section (a) through (g) apply throughout this subpart, unless otherwise specified herein.",
        "expected_materiality": "IMMATERIAL",
        "expected_change_type": "DEFINITION_CHANGE",
        "expected_verbatim_phrases": ["apply throughout this subpart"]
    },
    {
        "id": "mat_typographical_whitespace",
        "description": "Whitespace and punctuation normalization without substantive legal delta.",
        "diff_type": "MODIFIED",
        "before_text": "Facility operators must keep records on-site.",
        "after_text": "Facility  operators  must   keep records on-site.",
        "expected_materiality": "IMMATERIAL",
        "expected_change_type": "NEW_REQUIREMENT",
        "expected_verbatim_phrases": ["records on-site"]
    },
    {
        "id": "mat_short_header_immaterial",
        "description": "Short subpart header cosmetic change (< 5 words, non-binding).",
        "diff_type": "MODIFIED",
        "before_text": "Subpart KKKK",
        "after_text": "Subpart KKKK - Rules",
        "expected_materiality": "IMMATERIAL",
        "expected_change_type": "NEW_REQUIREMENT",
        "expected_verbatim_phrases": ["Subpart KKKK"]
    }
]

CITATION_VERACITY_CASES: List[Dict[str, Any]] = [
    {
        "id": "cite_exact_ieee",
        "domain": "FERC Order 2023",
        "source_text": "All newly interconnecting solar photovoltaic, battery storage, and inverter-based generation facilities must maintain continuous voltage and frequency ride-through capability in full compliance with IEEE Standard 2800-2022 during abnormal transmission system events.",
        "valid_quote": "continuous voltage and frequency ride-through capability in full compliance with IEEE Standard 2800-2022",
        "invalid_paraphrased_quote": "facilities must ride through grid frequency swings under IEEE 2800 rules"
    },
    {
        "id": "cite_exact_penalty",
        "domain": "FERC Order 2023",
        "source_text": "Failure to meet these study deadlines shall subject the transmission provider to civil financial penalties of $2,500 per day until completed.",
        "valid_quote": "civil financial penalties of $2,500 per day until completed",
        "invalid_paraphrased_quote": "daily fines of twenty five hundred dollars for late studies"
    },
    {
        "id": "cite_exact_nox_limit",
        "domain": "EPA 40 CFR Part 60 KKKK",
        "source_text": "Nitrogen oxides (NOx) emissions from new or reconstructed stationary combustion turbines firing natural gas shall not exceed 2.5 ppmvd at 15 percent O2 on a 4-hour rolling average, achievable through selective catalytic reduction (SCR).",
        "valid_quote": "shall not exceed 2.5 ppmvd at 15 percent O2 on a 4-hour rolling average",
        "invalid_paraphrased_quote": "cannot emit more than two and a half ppmvd over four hours"
    },
    {
        "id": "cite_exact_cems_schedule",
        "domain": "EPA 40 CFR Part 60 KKKK",
        "source_text": "The owner or operator shall submit certified CEMS compliance data electronically on a quarterly basis within 30 days of the end of each calendar quarter.",
        "valid_quote": "submit certified CEMS compliance data electronically on a quarterly basis within 30 days",
        "invalid_paraphrased_quote": "send electronic CEMS telemetry reports every quarter in thirty calendar days"
    },
    {
        "id": "cite_exact_tortoise_mitigation",
        "domain": "BLM / USFWS Environmental Mitigation",
        "source_text": "Facility operators must maintain active biological monitoring and designated exclusion fencing around desert tortoise nesting zones during construction.",
        "valid_quote": "maintain active biological monitoring and designated exclusion fencing around desert tortoise nesting zones",
        "invalid_paraphrased_quote": "keep biological watchers and turtle barriers around nesting grounds during building"
    },
    {
        "id": "cite_exact_substation_security",
        "domain": "NERC CIP-014 Physical Security",
        "source_text": "All transmission owners operating critical 500kV bulk electric substations must implement 24/7 automated perimeter intrusion detection systems and physical barriers within 90 calendar days.",
        "valid_quote": "implement 24/7 automated perimeter intrusion detection systems and physical barriers within 90 calendar days",
        "invalid_paraphrased_quote": "install continuous perimeter sensor alarms and security gates within three months"
    }
]

IMPACT_GROUNDING_CASES: List[Dict[str, Any]] = [
    {
        "id": "ground_solar_ride_through",
        "description": "FERC Order 2023 ride-through impact on Mojave Desert Solar facility and inverter agreement.",
        "regulation_clause": "maintain continuous voltage and frequency ride-through capability in full compliance with IEEE Standard 2800-2022",
        "company_doc_id": "DOC-SOLAR-GRID-03",
        "expected_affected_obligation": "OBL-RIDETHRU-03",
        "expected_affected_project": "PROJ-SOLAR-DESERT-02"
    },
    {
        "id": "ground_gt_cems_reporting",
        "description": "EPA NSPS KKKK CEMS reporting impact on Datacenter Gas Turbine CEMS monitoring program.",
        "regulation_clause": "submit certified CEMS compliance data electronically on a quarterly basis within 30 days of the end of each calendar quarter",
        "company_doc_id": "DOC-GT-AIR-01",
        "expected_affected_obligation": "OBL-CEMS-02",
        "expected_affected_project": "PROJ-GT-DC-01"
    },
    {
        "id": "ground_gt_nox_ceiling",
        "description": "EPA NSPS KKKK 2.5 ppmvd NOx ceiling impact on Datacenter Gas Turbine Title V Air Permit.",
        "regulation_clause": "Nitrogen oxides (NOx) emissions from new or reconstructed stationary combustion turbines firing natural gas shall not exceed 2.5 ppmvd at 15 percent O2",
        "company_doc_id": "DOC-GT-AIR-01",
        "expected_affected_obligation": "OBL-NOX-01",
        "expected_affected_project": "PROJ-GT-DC-01"
    },
    {
        "id": "ground_solar_desert_tortoise",
        "description": "BLM environmental condition impact on Mojave Desert Solar biological compliance plan.",
        "regulation_clause": "Facility operators must establish protective perimeters and conduct active species relocation surveys for desert tortoise (Gopherus agassizii) habitats.",
        "company_doc_id": "DOC-SOLAR-ENV-02",
        "expected_affected_obligation": "OBL-TORTOISE-01",
        "expected_affected_project": "PROJ-SOLAR-DESERT-02"
    },
    {
        "id": "ground_pjm_bess_substation",
        "description": "NERC CIP-014 physical security impact on PJM Fast-Response Battery Energy Storage System.",
        "regulation_clause": "All transmission owners operating critical 500kV bulk electric substations must implement 24/7 automated perimeter intrusion detection systems",
        "company_doc_id": None,
        "expected_affected_obligation": None,
        "expected_affected_project": "PROJ-BESS-PEAKER-03"
    },
    {
        "id": "ground_rejection_nuclear_containment",
        "description": "Negative control test: Nuclear containment acoustic inspection clause must NOT match solar, battery, or gas assets.",
        "regulation_clause": "Containment structures for commercial pressurized water nuclear reactors must undergo secondary coolant loop acoustic leak testing every 24 months.",
        "company_doc_id": None,
        "expected_affected_obligation": None,
        "expected_affected_project": None
    }
]
