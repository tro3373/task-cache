SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c # -c: Needed in .SHELLFLAGS. Default is -c.
.DEFAULT_GOAL := run

dotenv := $(PWD)/.env
-include $(dotenv)

export

npmi:
	@npm i
npmi-%:
	@npm i $(*)
npmi_if_needed:
	@if [[ ! -e node_modules ]]; then \
		make npmi; \
	fi

clean:
	@rm -rf node_modules
build-dev:
	@make _build opt=-dev
build-stg:
	@make _build opt=-stg
build-prd:
	@make _build opt=-prd
build: npmi_if_needed
	@npm run build$(opt)

run: npmi_if_needed open_browser
	@npm run dev

dev: ## Start development server
	vercel dev

# Deployment
deploy: ## Deploy to Vercel
	vercel --prod

deploy-preview: ## Deploy preview to Vercel
	vercel

# Utility commands
clean: ## Clean build artifacts and dependencies
	rm -rf node_modules/
	rm -rf .vercel/
	rm -f npm-debug.log*
	rm -f yarn-debug.log*
	rm -f yarn-error.log*

status: ## Show git and deployment status
	@echo "=== Git Status ==="
	git status --short
	@echo ""
	@echo "=== Vercel Status ==="
	vercel ls 2>/dev/null || echo "Not logged in to Vercel or no deployments found"

# Setup commands
setup: install ## Initial project setup
	@echo "Setting up CORS Proxy project..."
	@echo "1. Install Vercel CLI if not installed:"
	@echo "   npm install -g vercel"
	@echo ""
	@echo "2. Login to Vercel:"
	@echo "   vercel login"
	@echo ""
	@echo "3. Start development:"
	@echo "   make dev"
	@echo ""
	@echo "4. Deploy to production:"
	@echo "   make deploy"

# Quick deployment workflow
ship: check ## Run checks and deploy to production
	@echo "Running pre-deployment checks..."
	make check
	@echo "Deploying to production..."
	make deploy
	@echo "Deployment complete!"

# Environment info
info: ## Show environment information
	@echo "=== Environment Information ==="
	@echo "Node version: $$(node --version 2>/dev/null || echo 'Not installed')"
	@echo "NPM version: $$(npm --version 2>/dev/null || echo 'Not installed')"
	@echo "Vercel CLI version: $$(vercel --version 2>/dev/null || echo 'Not installed')"
	@echo "Git version: $$(git --version 2>/dev/null || echo 'Not installed')"
	@echo ""
	@echo "=== Project Information ==="
	@echo "Project directory: $$(pwd)"
	@echo "Package.json exists: $$(test -f package.json && echo 'Yes' || echo 'No')"
	@echo "Vercel.json exists: $$(test -f vercel.json && echo 'Yes' || echo 'No')"
	@echo "API endpoint exists: $$(test -f api/proxy.js && echo 'Yes' || echo 'No')"

# Logs
logs: ## Show Vercel deployment logs
	vercel logs

# Redeploy (useful after fixing configuration)
redeploy: ## Redeploy to existing Vercel project
	vercel --prod --force

open_browser:
	@local_url="http://$(shell ipa 2>/dev/null || echo localhost):3000" && \
		open "$${local_url}" 2>/dev/null || echo "==> Open $${local_url} in your browser."
