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

open_browser:
	@local_url="http://$(shell ipa 2>/dev/null || echo localhost):3000" && \
		open "$${local_url}" 2>/dev/null || echo "==> Open $${local_url} in your browser."
