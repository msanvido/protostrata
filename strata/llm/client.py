import os
import json
import re
import requests
from typing import Dict, Any, Optional, List

class LLMClient:
    """Unified LLM client supporting OpenRouter, Gemini, Anthropic, OpenAI, Ollama, and Mock offline fallback."""

    def __init__(self, provider: Optional[str] = None, model: Optional[str] = None):
        # Determine provider (default: openrouter)
        if provider:
            self.provider = provider.lower()
        elif os.environ.get("STRATA_LLM_PROVIDER"):
            self.provider = os.environ.get("STRATA_LLM_PROVIDER").lower()
        elif os.environ.get("OPENROUTER_API_KEY"):
            self.provider = "openrouter"
        elif os.environ.get("GEMINI_API_KEY"):
            self.provider = "gemini"
        elif os.environ.get("ANTHROPIC_API_KEY"):
            self.provider = "anthropic"
        elif os.environ.get("OPENAI_API_KEY"):
            self.provider = "openai"
        else:
            self.provider = "openrouter"

        # Default models per provider (default: google/gemini-2.5-flash)
        default_models = {
            "openrouter": "google/gemini-2.5-flash",
            "gemini": "gemini-1.5-flash",
            "anthropic": "claude-3-5-sonnet-20241022",
            "openai": "gpt-4o-mini",
            "ollama": "llama3",
            "mock": "deterministic-mock"
        }
        self.model = model or os.environ.get("STRATA_LLM_MODEL") or default_models.get(self.provider, "google/gemini-2.5-flash")

    def _call_chat_completion(self, messages: List[Dict[str, str]], json_mode: bool = True) -> str:
        """Dispatches chat completion request to the configured provider."""
        if self.provider == "mock":
            raise RuntimeError("Mock provider does not execute network LLM requests.")

        if self.provider == "openrouter":
            api_key = os.environ.get("OPENROUTER_API_KEY")
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY is not set.")
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/msanvido/protostrata",
                "X-Title": "Strata Regulatory Intelligence"
            }
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": 0.0
            }
            if json_mode:
                payload["response_format"] = {"type": "json_object"}
            resp = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=25)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenRouter API error {resp.status_code}: {resp.text}")
            return resp.json()["choices"][0]["message"]["content"]

        elif self.provider == "openai":
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY is not set.")
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": 0.0
            }
            if json_mode:
                payload["response_format"] = {"type": "json_object"}
            resp = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload, timeout=25)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI API error {resp.status_code}: {resp.text}")
            return resp.json()["choices"][0]["message"]["content"]

        elif self.provider == "anthropic":
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not api_key:
                raise ValueError("ANTHROPIC_API_KEY is not set.")
            headers = {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }
            system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
            user_msgs = [m for m in messages if m["role"] != "system"]
            payload = {
                "model": self.model,
                "max_tokens": 1024,
                "temperature": 0.0,
                "system": system_msg,
                "messages": user_msgs
            }
            resp = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload, timeout=25)
            if resp.status_code != 200:
                raise RuntimeError(f"Anthropic API error {resp.status_code}: {resp.text}")
            return resp.json()["content"][0]["text"]

        elif self.provider == "ollama":
            endpoint = os.environ.get("OLLAMA_ENDPOINT", "http://localhost:11434/v1")
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": 0.0
            }
            resp = requests.post(f"{endpoint}/chat/completions", json=payload, timeout=30)
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama API error {resp.status_code}: {resp.text}")
            return resp.json()["choices"][0]["message"]["content"]

        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

    def classify_materiality(self, before_text: str, after_text: str) -> Dict[str, Any]:
        """Calls the live LLM to classify change materiality and extract verbatim citation spans."""
        system_instruction = (
            "You are a regulatory compliance analyst. Analyze the regulatory delta between before_text and after_text. "
            "Determine if the change is MATERIAL or IMMATERIAL. "
            "Select change_type from: NEW_REQUIREMENT, DEADLINE_SHIFT, SCOPE_CHANGE, DEFINITION_CHANGE, REQUIREMENT_REMOVED. "
            "CRITICAL: Any quoted span in 'verbatim_quote' MUST be an exact character-for-character substring of after_text. "
            "Return valid JSON matching this schema: "
            "{\"materiality\": \"MATERIAL\"|\"IMMATERIAL\", \"change_type\": \"...\", \"description\": \"...\", \"verbatim_quote\": \"...\"}"
        )
        user_prompt = f"BEFORE TEXT:\n{before_text}\n\nAFTER TEXT:\n{after_text}"

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt}
        ]

        raw_out = self._call_chat_completion(messages, json_mode=True)
        # Clean JSON if model output includes markdown code blocks
        clean_json = re.sub(r"^```json\s*|\s*```$", "", raw_out.strip(), flags=re.MULTILINE)
        try:
            return json.loads(clean_json)
        except Exception:
            # Fallback parse
            m = re.search(r"\{.*\}", clean_json, re.DOTALL)
            if m:
                return json.loads(m.group(0))
            raise ValueError(f"Failed to parse LLM JSON: {raw_out}")

    def match_impact(self, change_description: str, regulatory_quote: str, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Calls the live LLM to match regulatory changes against internal company assets with dual grounding."""
        system_instruction = (
            "You are a compliance impact specialist. Evaluate candidate enterprise assets against the regulatory change. "
            "For each truly affected asset, provide a clear rationale explaining the impact. "
            "CRITICAL: Quoted text from the enterprise asset MUST be an exact substring from the provided asset text. "
            "Return valid JSON: {\"matches\": [{\"entity_id\": \"...\", \"entity_type\": \"...\", \"rationale\": \"...\", \"verbatim_asset_quote\": \"...\"}]}"
        )
        cand_descriptions = "\n".join([f"- ID: {c['entity_id']} ({c['entity_type']}): {c['text']}" for c in candidates])
        user_prompt = (
            f"REGULATORY CHANGE:\n{change_description}\n"
            f"REGULATORY QUOTE:\n\"{regulatory_quote}\"\n\n"
            f"CANDIDATE ENTERPRISE ASSETS:\n{cand_descriptions}"
        )

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt}
        ]

        raw_out = self._call_chat_completion(messages, json_mode=True)
        clean_json = re.sub(r"^```json\s*|\s*```$", "", raw_out.strip(), flags=re.MULTILINE)
        try:
            parsed = json.loads(clean_json)
            return parsed.get("matches", [])
        except Exception:
            m = re.search(r"\{.*\}", clean_json, re.DOTALL)
            if m:
                return json.loads(m.group(0)).get("matches", [])
            return []
