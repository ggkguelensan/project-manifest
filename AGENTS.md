# Project Manifest

Цель: выбрать правильные repository, target и task worktree, затем подключить только нужные инструкции. Этот репозиторий не владеет архитектурой приложения, E2E-нормами и дизайном.

- Подключить проект: [adapt-project-manifest](skills/adapt-project-manifest/SKILL.md).
- Начать задачу: [start-project-task](skills/start-project-task/SKILL.md).
- Понять модель, ветки и ограничения checkout: [project model](docs/project-model.md).
- Проверить предметные адаптации выбранного target: [connections](docs/connections.md).
- Подключить только выбранный контекст: [native harness context](docs/context.md).
- Сохранить или восстановить локальную адаптацию: [workdir](docs/workdir.md).
- Менять базу: [maintenance](docs/maintenance.md).

Адаптация находится в игнорируемом `workdir/`, рабочие probes — в `e2e/tmp/`. Не меняй глобальные настройки и не публикуй локальные данные по умолчанию. Git — источник текущего состояния, локальные инструкции читаются из выбранного worktree.
