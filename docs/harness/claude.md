# Claude Code CLI

Выбирай для Claude Code. Базовые границы — [context](../context.md).

Подключай выбранные standalone skills в target `.claude/skills/`, учитывая ancestor/user scopes. AGENTS.md остаётся источником правил, CLAUDE.md — ссылкой. Нативный plugin подключай только если он нужен для выбранной задачи; не упаковывай все stack-модули в один обязательный plugin. [Официальные skills](https://code.claude.com/docs/en/skills).

Для standalone skills поддерживаются skillOverrides: off скрывает и запрещает вызов, name-only оставляет имя, user-invocable-only ограничивает вызов моделью. Для исключения нерелевантного стека name-only недостаточен. Plugin skills не управляются skillOverrides: их включение регулируется отдельно. Managed policy сохраняет приоритет.

Установлена версия 2.1.295; проверены --version и --help, discovery в целевом сеансе не проверено. Не выдавай документационную поддержку за успешную установку. После подключения открой /skills в новом локальном сеансе, проверь selected/disabled skills, plugin/tools и источники инструкций; сохрани результат проверки в e2e/tmp без секретов.

--safe-mode выключает customizations и не является способом использовать выбранные проектные skills. --bare меняет discovery контекста и пропускает hooks, но согласно help skills всё ещё могут разрешаться; он сам по себе не гарантирует выбранный allowlist. Глобальную конфигурацию не редактируй ради target.
