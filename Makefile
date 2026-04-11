.PHONY: install build serve dev test install-browsers install-browsers-deps \
        docker-build docker-up docker-down clean help

BROWSERS := chromium firefox webkit

# Bail with a clear message when a required tool is missing.
define require
@command -v $(1) >/dev/null 2>&1 || \
  { printf '\033[31merror:\033[0m %s is required but not found in PATH\n' '$(1)' >&2; exit 1; }
endef

## ── Development ───────────────────────────────────────────────────────────────

install:          ## Install npm dependencies
	$(call require,node)
	$(call require,npm)
	npm ci

dev:              ## Start Vite dev server at http://localhost:5173
	$(call require,node)
	$(call require,npm)
	npm start

build:            ## Production build → dist/
	$(call require,node)
	$(call require,npm)
	npm run build

serve:            ## Preview production build locally
	$(call require,node)
	$(call require,npm)
	npm run serve

## ── Testing ───────────────────────────────────────────────────────────────────

install-browsers: ## Install Playwright browsers (--with-deps on CI)
	$(call require,node)
	$(call require,npx)
ifdef CI
	npx playwright install --with-deps $(BROWSERS)
else
	npx playwright install $(BROWSERS)
endif

install-browsers-deps: ## Install Playwright OS deps only (CI cache-hit path)
	$(call require,npx)
	npx playwright install-deps $(BROWSERS)

test:             ## Run browser tests (Chromium, Firefox, WebKit)
	$(call require,node)
	$(call require,npm)
	npm test

## ── Docker ────────────────────────────────────────────────────────────────────

docker-build:     ## Build Docker image
	$(call require,docker)
	docker compose build

docker-up:        ## Start container
	$(call require,docker)
	docker compose up -d

docker-down:      ## Stop container
	$(call require,docker)
	docker compose down

## ── Misc ──────────────────────────────────────────────────────────────────────

clean:            ## Remove build output and test artifacts
	rm -rf dist playwright-report test-results

help:             ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
