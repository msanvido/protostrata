import os
import re
from typing import Optional
from bs4 import BeautifulSoup
import fitz  # PyMuPDF

class DocumentExtractor:
    @staticmethod
    def extract_text(file_path_or_content: str, is_raw_content: bool = False, file_type: Optional[str] = None) -> str:
        """Extracts clean text from PDF, HTML, or plain text."""
        if is_raw_content:
            content = file_path_or_content
            if file_type == "html" or (content.strip().startswith("<") and ">" in content):
                return DocumentExtractor._extract_html(content)
            return content

        file_path = file_path_or_content
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            return DocumentExtractor._extract_pdf(file_path)
        elif ext in [".html", ".htm"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return DocumentExtractor._extract_html(f.read())
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()

    @staticmethod
    def _extract_pdf(pdf_path: str) -> str:
        doc = fitz.open(pdf_path)
        full_text = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            # Strip simple running headers / page numbers like "Page X of Y"
            lines = [line for line in text.splitlines() if not re.match(r"^(Page\s+\d+|Docket\s+No\..*|\d+)$", line.strip(), re.IGNORECASE)]
            full_text.append("\n".join(lines))
        doc.close()
        return "\n\n".join(full_text)

    @staticmethod
    def _extract_html(html_content: str) -> str:
        soup = BeautifulSoup(html_content, "html.parser")
        # Remove script and style tags
        for s in soup(["script", "style", "nav", "footer", "header"]):
            s.decompose()
        # Convert headings to explicit markers if needed
        for i in range(1, 7):
            for h in soup.find_all(f"h{i}"):
                h.insert_before(f"\n\n### {h.get_text().strip()}\n")
                h.decompose()
        return soup.get_text(separator="\n")
