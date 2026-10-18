---
name: adapt-project-manifest
description: Register a multi-repository project's targets, branch policies, checkout boundaries and manifest connections without changing product code.
---

# Adapt project manifest

Вход — [AGENTS.md](../../AGENTS.md). Прочитай [модель](../../docs/project-model.md).

1. Найди существующие workspace instructions, рабочие clones и reference-каталоги. Не определяй роль checkout только по remote. Сверь Git status и worktrees read-only.
2. Подтверди неизвестные development/release-policy и выбор инструментов. Наличие ветки не означает её назначение; не спрашивай повторно известное.
3. Создай `workdir/project.json` по схеме. Сохрани реальные пути и отдельные targets. Не копируй нативную конфигурацию Worktrunk и предметные нормы E2E/Design.
4. Запусти `npm run inspect -- --project <file> --root <project-root>`. Исправь конфликты и ссылки. Существующая адаптация сохраняется; обновление не разрешает публикацию.
5. По [native context](../../docs/context.md) выбери один harness; подключение skills проверяй в новом сеансе выбранного harness отдельно от валидации JSON. Различай discovery, metadata, полный skill и исполняемые plugins/MCP/hooks. Не объявляй отсутствующий стек и не меняй глобальную конфигурацию.
