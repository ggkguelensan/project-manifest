# Claude Code CLI

Выбирай для Claude Code. Базовые границы — [context](../context.md).

Подключай выбранные standalone skills в target `.claude/skills/`, учитывая ancestor/user scopes. AGENTS.md остаётся источником правил, CLAUDE.md — ссылкой. Нативный plugin подключай только если он нужен для выбранной задачи; не упаковывай все stack-модули в один обязательный plugin. [Официальные skills](https://code.claude.com/docs/en/skills).

Для standalone skills поддерживаются skillOverrides: off скрывает и запрещает вызов, name-only оставляет имя, user-invocable-only ограничивает вызов моделью. Для исключения нерелевантного стека name-only недостаточен. Plugin skills не управляются skillOverrides: их включение регулируется отдельно. Managed policy сохраняет приоритет.

На версии 2.1.295 фактически проверен discovery через `npm run test:claude-discovery`: два новых CLI-процесса в соседних targets возвращают каждый только собственный skill среди пользовательских команд. Тест отправляет только control initialize по протоколу [официального SDK](https://github.com/anthropics/claude-agent-sdk-python/blob/main/src/claude_agent_sdk/_internal/query.py), без user message/model turn. Использует отдельный fixture CLAUDE_CONFIG_DIR, project settings, отключённые hooks, пустой MCP-набор и tools; глобальные настройки не меняет. CLI-процессы завершаются после ответа.

Встроенные команды остаются: в проверенной версии их 48. Inventory при initialize не доказывает состав model-facing prompt, чтение CLAUDE.md, исполнение body или tool activation. Не трактуй его как строгий allowlist всех возможностей. Proof с версией, arguments и именами команд хранится в `e2e/tmp/claude-discovery-*/proof.json`; полные account/settings данные не сохраняются. Для продуктового профиля отдельно проверь /skills, plugin/tools и источники инструкций в новом сеансе, сохрани результат без секретов.

--safe-mode выключает customizations и не является способом использовать выбранные проектные skills. --bare меняет discovery контекста и пропускает hooks, но согласно help skills всё ещё могут разрешаться; он сам по себе не гарантирует выбранный allowlist. Глобальную конфигурацию не редактируй ради target.
