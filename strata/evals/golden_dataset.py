from typing import List, Dict, Any

# Curated Golden Evaluation Benchmark Dataset for Regulatory Intelligence
# Covers FERC Order 2023 (Interconnection) and EPA NSPS Subpart KKKK (Turbines)

MATERIALITY_BENCHMARK_CASES: List[Dict[str, Any]] = [
    {
        "id": "mat_ferc_cluster_study",
        "description": "Cluster study timeline transition from 180 days to mandatory 150 days with $2,500/day penalties.",
        "before_text": "Transmission providers shall make reasonable efforts to complete interconnection feasibility and system impact studies within 180 calendar days.",
        "after_text": "Transmission providers must transition to a first-ready, first-served cluster study process and complete all cluster studies within 150 calendar days. Failure to meet these study deadlines shall subject the transmission provider to civil financial penalties of $2,500 per day until completed.",
        "expected_materiality": "MATERIAL",
        "expected_change_type": "DEADLINE_SHIFT",
        "expected_verbatim_phrases": ["150 calendar days", "$2,500 per day"]
    },
    {
        "id": "mat_ferc_ride_through",
        "description": "Mandatory IEEE 2800 inverter ride-through requirements for all newly interconnecting resources.",
        "before_text": "Large generating facilities must ride through abnormal frequency and voltage events to the extent practicable.",
        "after_text": "All newly interconnecting solar photovoltaic, battery storage, and inverter-based generation facilities must maintain continuous voltage and frequency ride-through capability in full compliance with IEEE Standard 2800-2022 during abnormal transmission system events.",
        "expected_materiality": "MATERIAL",
        "expected_change_type": "NEW_REQUIREMENT",
        "expected_verbatim_phrases": ["IEEE Standard 2800-2022", "continuous voltage and frequency ride-through capability"]
    },
    {
        "id": "mat_epa_nox_tightening",
        "description": "Stationary combustion turbine NOx emission ceiling reduction to 2.5 ppmvd.",
        "before_text": "Nitrogen oxides (NOx) emissions from stationary combustion turbines shall not exceed 15 ppm at 15 percent O2.",
        "after_text": "Nitrogen oxides (NOx) emissions from new or reconstructed stationary combustion turbines firing natural gas shall not exceed 2.5 ppmvd at 15 percent O2 on a 4-hour rolling average, achievable through selective catalytic reduction (SCR).",
        "expected_materiality": "MATERIAL",
        "expected_change_type": "NEW_REQUIREMENT",
        "expected_verbatim_phrases": ["2.5 ppmvd at 15 percent O2", "selective catalytic reduction (SCR)"]
    },
    {
        "id": "mat_epa_cems_reporting",
        "description": "Quarterly CEMS compliance reporting window shortened to 30 days.",
        "before_text": "The owner or operator shall submit continuous monitoring summaries on a semi-annual basis within 60 days following the reporting period.",
        "after_text": "The owner or operator shall submit certified CEMS compliance data electronically on a quarterly basis within 30 days of the end of each calendar quarter.",
        "expected_materiality": "MATERIAL",
        "expected_change_type": "DEADLINE_SHIFT",
        "expected_verbatim_phrases": ["quarterly basis within 30 days"]
    },
    {
        "id": "mat_editorial_formatting",
        "description": "Non-substantive grammatical and formatting update.",
        "before_text": "Definitions under this section apply throughout the subpart unless otherwise noted.",
        "after_text": "Definitions under this section (a) through (g) apply throughout this subpart, unless otherwise specified herein.",
        "expected_materiality": "IMMATERIAL",
        "expected_change_type": "DEFINITION_CHANGE",
        "expected_verbatim_phrases": ["apply throughout this subpart"]
    },
    {
        "id": "mat_typographical_cleanup",
        "description": "Whitespace and minor typo normalization.",
        "before_text": "Facility operators must keep records on site.",
        "after_text": "Facility operators must keep records on-site for five years.",
        "expected_materiality": "IMMATERIAL",
        "expected_change_type": "DEFINITION_CHANGE",
        "expected_verbatim_phrases": ["records on-site"]
    }
]

CITATION_VERACITY_CASES: List[Dict[str, Any]] = [
    {
        "id": "cite_exact_ieee",
        "source_text": "All newly interconnecting solar photovoltaic, battery storage, and inverter-based generation facilities must maintain continuous voltage and frequency ride-through capability in full compliance with IEEE Standard 2800-2022 during abnormal transmission system events.",
        "valid_quote": "continuous voltage and frequency ride-through capability in full compliance with IEEE Standard 2800-2022",
        "invalid_paraphrased_quote": "facilities must ride through grid frequency swings under IEEE 2800 rules"
    },
    {
        "id": "cite_exact_penalty",
        "source_text": "Failure to meet these study deadlines shall subject the transmission provider to civil financial penalties of $2,500 per day until completed.",
        "valid_quote": "civil financial penalties of $2,500 per day until completed",
        "invalid_paraphrased_quote": "daily fines of twenty five hundred dollars for late studies"
    }
]

IMPACT_GROUNDING_CASES: List[Dict[str, Any]] = [
    {
        "id": "ground_solar_ride_through",
        "regulation_clause": "maintain continuous voltage and frequency ride-through capability in full compliance with IEEE Standard 2800-2022",
        "company_doc_id": "DOC-SOLAR-GRID-03",
        "expected_affected_obligation": "OBL-RIDETHRU-03",
        "expected_affected_project": "PROJ-SOLAR-DESERT-02"
    },
    {
        "id": "ground_gt_nox_cems",
        "regulation_clause": "submit certified CEMS compliance data electronically on a quarterly basis within 30 days of the end of each calendar quarter",
        "company_doc_id": "DOC-GT-AIR-01",
        "expected_affected_obligation": "OBL-CEMS-02",
        "expected_affected_project": "PROJ-GT-DC-01"
    }
]
