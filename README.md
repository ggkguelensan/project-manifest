# Project Manifest

Модель многорепозиторного проекта и процедуры выбора рабочего контекста. Вход агента — [AGENTS.md](AGENTS.md).

После `npm ci`:

```sh
npm run check
npm test
npm run inspect -- --project /absolute/project/project-manifest/workdir/project.json --root /absolute/project
npm run inspect -- --project /absolute/project/project-manifest/workdir/project.json --root /absolute/project --target web --worktree worktrees/frontend-task --purpose development
```

`inspect` проверяет [схему](schemas/project.schema.json), физические пути, ссылки, закреплённые базы и выбранный Git worktree. Это read-only операция: она не делает fetch, switch, install или запуск harness. JSON результата выводится в stdout; если его сохраняют, используют `e2e/tmp/` выбранного target.

Для новой задачи Worktrunk создаёт worktree по своей конфигурации. Указанный base commit — текущее локальное значение выбранной ветки, не доказательство исторической точки создания task branch.
