.PHONY: install build serve dev test install-browsers docker-build docker-up docker-down clean help

## ── Development ───────────────────────────────────────────────────────────────

install:          ## Install npm dependencies
	npm ci

dev:              ## Start Vite dev server at http://localhost:5173
	npm start

build:            ## Production build → dist/
	npm run build

serve:            ## Preview production build locally
	npm run serve

## ── Testing ───────────────────────────────────────────────────────────────────

install-browsers: ## Install Playwright browsers (--with-deps on CI)
ifdef CI
	npx playwright install --with-deps chromium firefox webkit
else
	npx playwright install chromium firefox webkit
endif

install-browsers-deps: ## Install Playwright OS deps only (CI cache-hit path)
	npx playwright install-deps chromium firefox webkit

test:             ## Run browser tests (Chromium, Firefox, WebKit)
	npm test

## ── Docker ────────────────────────────────────────────────────────────────────

docker-build:     ## Build Docker image
	docker compose build

docker-up:        ## Start container
	docker compose up -d

docker-down:      ## Stop container
	docker compose down

## ── Misc ──────────────────────────────────────────────────────────────────────

clean:            ## Remove build output
	rm -rf dist

help:             ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
