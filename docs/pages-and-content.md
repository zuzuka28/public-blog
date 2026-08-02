# Страницы и контент

Это руководство описывает структуру Quarto-сайта, маршруты, подключение публикаций и файлы, отвечающие за интерфейс. Оно предназначено для разработчиков и редакторов, которые изменяют сайт.

## Типы страниц

| Тип                | URL                       | Исходник                 | Где подключён                           |
| ------------------ | ------------------------- | ------------------------ | --------------------------------------- |
| Лендинг            | `/`                       | `index.qmd`              | первая ссылка navbar в `_quarto.yml`    |
| Обновления         | `/updates.html`           | `updates.qmd`            | navbar и ссылки лендинга                |
| Топики             | `/topics.html`            | `topics.qmd`             | navbar и ссылки лендинга                |
| About              | `/about.html`             | `about.qmd`              | navbar и ссылки лендинга                |
| 404                | `/404.html`               | `404.qmd`                | используется GitHub Pages автоматически |
| Статья             | `/posts/<slug>/`          | `posts/<slug>/index.qmd` | listing страницы `updates.qmd`          |
| Reveal deck статьи | `/posts/<slug>/deck.html` | `posts/<slug>/deck.qmd`  | указывается из scrolly-блока статьи     |

## Где что редактировать

| Задача                               | Файл                                                                |
| ------------------------------------ | ------------------------------------------------------------------- |
| Текст и ссылки лендинга              | `index.qmd`                                                         |
| Пункты верхнего меню                 | `_quarto.yml` → `website.navbar`                                    |
| GitHub-ссылки About                  | `about.qmd`                                                         |
| GitHub-avatar                        | `assets/github-profile.jpg`                                         |
| Favicon                              | `_quarto.yml` → `website.favicon`                                   |
| Лента публикаций и RSS               | `updates.qmd`                                                       |
| Ссылки на категории                  | `topics.qmd`                                                        |
| Общие компоненты и responsive layout | `styles.scss`                                                       |
| Светлые SCSS defaults                | `theme-light.scss`                                                  |
| Тёмные SCSS defaults                 | `theme-dark.scss`                                                   |
| Social card                          | `assets/social-card.svg` и сгенерированный `assets/social-card.png` |
| Конфигурация публикации              | `.github/workflows/publish.yml`                                     |

## Добавление статьи

Каждая статья располагается в собственной директории. В ней обязательны `index.qmd` и `assets/`.

```text
posts/
└── article-slug/
    ├── index.qmd
    ├── assets/
    │   └── cover.svg
    └── deck.qmd        # только если нужен связанный Reveal deck
```

Минимальный `posts/article-slug/index.qmd`:

```yaml
---
title: "Название"
description: "Короткое описание."
author: "zuzuka28"
date: 2026-08-02
categories: [Quarto]
image: assets/cover.svg
---
```

Чтобы подключить статьи к ленте, задайте listing в front matter файла `updates.qmd`:

```yaml
---
title: ""
page-layout: full
toc: false
listing:
  contents: "posts/*/index.qmd"
  type: default
  sort: "date desc"
  fields: [image, date, title, description, categories, reading-time]
  categories: true
  feed:
    title: "Обновления — zuzuka28 / заметки"
    description: "Новые материалы."
  page-size: 12
---
```

Файлы `posts/*/index.qmd` автоматически попадут в ленту и RSS `updates.xml`. Вспомогательные `deck.qmd` не совпадают с glob и в ленту не попадают.

## Подключение топиков

Топик задаётся в `categories` статьи. После включения listing с `categories: true` ссылка на отфильтрованную ленту имеет вид:

```markdown
[Quarto](updates.html#category=Quarto)
```

Добавляйте ссылки категорий в `topics.qmd`. Значение после `category=` должно совпадать со значением в `categories` с учётом регистра.

## Scrolly-статья

Добавьте `deck.qmd` рядом с `index.qmd`, подключите vendored-фильтр в front matter статьи:

```yaml
filters:
  - scrolly-slides
```

И свяжите текст с итоговым deck:

```markdown
::: {.scrolly-slides scrolly-slides-deck="deck.html"}
::: {.scrolly-slides-step scrolly-slides-slide="0/0"}
Текст первого шага.
:::
:::
```

Все изображения, данные и стили конкретной статьи должны находиться в её `assets/`.

## Обновление GitHub-avatar

Текущий файл получен из публичного профиля <https://github.com/zuzuka28>:

```bash
curl -L 'https://avatars.githubusercontent.com/u/66218745?s=512&v=4' \
  -o assets/github-profile.jpg
```

После обновления проверьте формат через `file assets/github-profile.jpg` и переснимите превью. Этот же файл используется как favicon через параметр `website.favicon` в `_quarto.yml`.

## Social card

Редактируйте векторный исходник `assets/social-card.svg`. Не помещайте в него обязательный для понимания страницы контент: карточка используется только в Open Graph/Twitter metadata. PNG обновляется так:

```bash
sips -s format png assets/social-card.svg --out assets/social-card.png
```

На Linux используйте любой SVG→PNG renderer, сохранив размер `1200 × 630`.

## Проверка изменений

```bash
make check
make previews
```

`make check` валидирует рендер и структуру всех появившихся директорий статей. `make previews` обновляет отслеживаемые light/dark PNG baseline.
