.PHONY: install build serve dev test install-browsers install-browsers-deps \
        docker-build docker-up docker-down clean help \
        require-npm require-docker

BROWSERS := chromium firefox webkit

# Bail with a clear message when a required tool is missing.
define require
@command -v $(1) >/dev/null 2>&1 || \
  { printf '\033[31merror:\033[0m %s is required but not found in PATH\n' '$(1)' >&2; exit 1; }
endef

require-npm:
	$(call require,node)
	$(call require,npm)

require-docker:
	$(call require,docker)

## ── Development ───────────────────────────────────────────────────────────────

install: require-npm      ## Install npm dependencies
	npm ci

dev: require-npm          ## Start Vite dev server at http://localhost:5173
	npm start

build: require-npm        ## Production build → dist/
	npm run build

serve: require-npm        ## Preview production build locally
	npm run serve

## ── Testing ───────────────────────────────────────────────────────────────────

install-browsers:         ## Install Playwright browsers (--with-deps on CI)
	$(call require,npx)
ifdef CI
	npx playwright install --with-deps $(BROWSERS)
else
	npx playwright install $(BROWSERS)
endif

install-browsers-deps:    ## Install Playwright OS deps only (CI cache-hit path)
	$(call require,npx)
	npx playwright install-deps $(BROWSERS)

test: require-npm         ## Run browser tests (Chromium, Firefox, WebKit)
	npm test

## ── Docker ────────────────────────────────────────────────────────────────────

docker-build: require-docker  ## Build Docker image
	docker compose build

docker-up: require-docker     ## Start container
	docker compose up -d

docker-down: require-docker   ## Stop container
	docker compose down

## ── Misc ──────────────────────────────────────────────────────────────────────

clean:                    ## Remove build output and test artifacts
	rm -rf dist playwright-report test-results

help:                     ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'
