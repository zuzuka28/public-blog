# public-blog

Исходники личного блога `zuzuka28` на [Quarto](https://quarto.org/) с vendored-расширением [quarto-scrolly-slides](https://github.com/zuzuka28/quarto-scrolly-slides).

## Документация

- [`docs/pages-and-content.md`](docs/pages-and-content.md) — типы страниц, подключение статей и карта редактирования;
- [`DESIGN.md`](DESIGN.md) — дизайн-контракт;
- [`previews/README.md`](previews/README.md) — визуальные baseline.

## Требования

- [Quarto](https://quarto.org/docs/get-started/) `>= 1.9`;
- Node.js `>= 20`;
- Chrome, Chromium или Edge для снимков;
- `make`.

## Команды

```bash
make preview   # локальный preview с автообновлением
make render    # статический сайт в _site/
make check     # рендер и структурные проверки
make previews  # light/dark PNG baseline
```

## Структура

```text
.
├── _quarto.yml
├── index.qmd
├── updates.qmd
├── about.qmd
├── posts/                         # исходники статей по одной директории на материал
├── docs/                          # руководство по страницам и контенту
├── assets/                        # общие изображения и social card
├── _extensions/scrolly-slides/    # закреплённое Quarto extension
├── previews/                      # отслеживаемые визуальные baseline
├── scripts/                       # проверки и захват screenshots
└── .github/workflows/publish.yml
```

## Расширение

Текущая vendored-ревизия записана в [`_extensions/scrolly-slides/SOURCE.md`](_extensions/scrolly-slides/SOURCE.md). После обновления runtime-файлов выполните `make check` и `make previews`.

## GitHub Pages

Workflow `.github/workflows/publish.yml` публикует `main` в отдельную ветку `gh-pages`.

В настройках GitHub выберите:

1. **Settings → Pages → Deploy from a branch**;
2. ветка **`gh-pages`**, директория **`/(root)`**;
3. для Actions — **Read and write permissions**.

## Перед push

```bash
make check
make previews   # если менялись layout, стили или baseline-страницы
git status
```
