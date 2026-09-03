.PHONY: help install build run dev test test-ui test-bdd test-unit demo clean

help:
	@echo "======================================================================"
	@echo "  STRATA REGULATORY INTELLIGENCE & LIVING OPERATIONS WORKSPACE"
	@echo "======================================================================"
	@echo "Available commands:"
	@echo "  make install    - Install Python and Node.js dependencies"
	@echo "  make build      - Compile React 19 frontend into production assets"
	@echo "  make run        - Start the full application (React UI + FastAPI backend)"
	@echo "  make dev        - Run Vite frontend dev server with hot-reloading"
	@echo "  make test       - Run all test suites (UI, BDD, and Unit/Integration)"
	@echo "  make test-ui    - Run React UI component & integration tests (Vitest)"
	@echo "  make test-bdd   - Run Cucumber / Gherkin BDD acceptance tests"
	@echo "  make test-unit  - Run Pytest unit and live LLM integration tests"
	@echo "  make demo       - Run interactive terminal CLI compliance demonstration"
	@echo "  make clean      - Clean caches, temporary database, and build outputs"
	@echo "======================================================================"

install:
	pip install -r requirements.txt
	cd frontend && npm install

build:
	cd frontend && npm run build

run: build
	python3 run.py

dev:
	cd frontend && npm run dev

test: test-ui test-bdd test-unit

test-ui:
	cd frontend && npm test

test-bdd:
	PYTHONPATH=. behave features/

test-unit:
	PYTHONPATH=. pytest -v tests/

demo:
	PYTHONPATH=. python3 strata/cli.py

clean:
	rm -rf strata.db .pytest_cache .coverage frontend/dist __pycache__ strata/__pycache__
	find . -type d -name "__pycache__" -exec rm -rf {} +
