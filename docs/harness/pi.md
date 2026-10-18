# Pi

Выбирай для Pi. Общие границы и обязательные инструкции — [context](../context.md). Для отдельного target/задачи начинай новый сеанс.

## Явный контекст

Используй `--no-skills` с повторяемыми `--skill /absolute/selected-skill`. Сохраняй директорию skill и её ссылки на закреплённую базу. Packages и `.pi/settings.json` поддерживаются нативно, но подключение всего пакета может раскрыть лишние возможности. [Skills upstream](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md).

`--no-context-files` отключает AGENTS/CLAUDE discovery, **но не SYSTEM.md и APPEND_SYSTEM.md**. Для явного набора передавай `--system-prompt ''` и повторяемые `--append-system-prompt <file>` с применимыми shared/workspace/repository/target инструкциями в порядке области. Не пропускай обязательную policy. Если её нельзя совместить с нужным scope, обозначь ограничение.

Отключай ненужное автоматическое discovery через `--no-extensions --no-prompt-templates --no-themes`. Явный `--extension` продолжает работать при `--no-extensions`; не добавляй чужие extensions. Набор инструментов задаётся отдельно через `--tools <comma-separated-allowlist>`: наличие skill не активирует нужные ему инструменты автоматически.

Перед рабочим запуском проверь эффективные settings/packages и environment. `PI_CODING_AGENT_DIR` позволяет выбрать отдельный нативный профиль процесса; тест использует только собственный fixture-каталог. Не переноси туда credentials или пользовательскую конфигурацию автоматически и не меняй глобальные настройки. `--offline` подавляет startup network operations, а не запрещает последующие модельные запросы. Scoping контекста не является файловой песочницей.

## Проверенная область

Проверено на 0.80.3, без модельных запросов:

| Команда | Что доказывает |
| --- | --- |
| `npm run test:native` | Native RPC `get_commands` возвращает ровно явно выбранные skill commands; проверяет discovery. |
| `npm run test:pi-context -- <installed-pi-package-directory>` | Нативный SDK готовит prompt с выбранными инструкциями/metadata и отложенным body, активен только read. |
| `npm run test:pi-cli-context` | Реальный CLI с явными flags готовит такой же по проверяемым свойствам контекст в session_start; отрицательный контроль обнаруживает SYSTEM override. |

CLI probe подключает одно локальное диагностическое extension через `--extension`. Оно читает `ctx.getSystemPrompt()` и `pi.getActiveTools()` в `session_start`, сохраняет наблюдение и завершает процесс; не меняет prompt/tools и не отправляет сообщения. Это проверка нативного CLI, не собственный harness. [Extensions upstream](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [SDK upstream](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md), [RPC upstream](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md).

Результаты находятся в `e2e/tmp/pi-cli-context-*/proof.json` и соответствующих SDK/discovery каталогах. Сохраняются версия, arguments, выбранные пути, tools и hash prompt. Fixture содержит посторонние инструкции/skills для проверки исключения. Исключение родительского файла-приманки не разрешает пропускать применимые продуктовые правила.

Эти проверки не доказывают исполнение skill, payload последующего model turn или безопасность произвольного пользовательского профиля. После обновления Pi либо изменения settings/набора подключений повтори соответствующую проверку; диагностическое extension не является обязательным компонентом продуктового запуска.
