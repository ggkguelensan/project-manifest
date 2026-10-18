---
name: start-project-task
description: Select a project's repository, target, base branch and task worktree before loading task-specific instructions.
---

# Start project task

Прочитай [AGENTS.md](../../AGENTS.md) и [правила checkout](../../docs/project-model.md).

1. Определи repository/target по задаче. Если их несколько, веди branch, изменения и проверки отдельно. Не включай все skills workspace.
2. Прочитай адаптацию и реальное состояние Git. Reference-каталоги не изменяются. Сначала переиспользуй подходящий task worktree, иначе используй wt с его конфигурацией и явной базой. Release-family требует конкретного выбранного ref.
3. Выполни `npm run inspect -- --project <file> --root <project-root> --target <id> --worktree <relative-path> --purpose development` (для release: purpose release и конкретный release ref при family). Ошибку принадлежности checkout не обходи.
4. Для подключённых предметных манифестов проверь [связь адаптаций с выбранным target](../../docs/connections.md). Затем прочитай workspace instructions и инструкции выбранного worktree. Проверь наличие нужной инфраструктуры именно в этой ветке. Конфликт норм предъяви до зависимых действий.
5. Подключи только необходимые процедуры через [выбранный native адаптер](../../docs/context.md). Для смены target с другим набором правил подготовь новый сеанс: cd не очищает историю. Результат inspect не доказывает native skill discovery или изоляцию shell.
