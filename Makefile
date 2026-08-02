.DEFAULT_GOAL := help

QUARTO ?= quarto
NODE ?= node

.PHONY: help preview render previews check

help: ## Показать доступные команды
	@awk 'BEGIN {FS = ":.*## "; printf "Команды:\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

preview: ## Запустить локальный сайт с автообновлением
	$(QUARTO) preview

render: ## Собрать статический сайт в _site
	$(NODE) scripts/clean-output.mjs
	$(QUARTO) render

previews: render ## Обновить PNG-превью основных лейаутов
	$(NODE) scripts/capture-previews.mjs

check: render ## Проверить структуру исходников и результат рендера
	$(NODE) scripts/check-site.mjs
