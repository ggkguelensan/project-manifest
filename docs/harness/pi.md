# Pi

Выбирай для Pi. Базовые границы — [context](../context.md).

Для явного набора используй `--no-skills` и повторяемые `--skill /absolute/selected-skill`. Packages и `.pi/settings.json` также поддерживаются нативно, но объединение всех ресурсов пакета не соответствует выбору target. [Skills upstream](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md).

Фактически проверена версия 0.80.3: offline RPC get_commands с одним --skill, --no-skills, --no-extensions, --no-prompt-templates, --no-themes и --no-context-files вернул ровно один тестовый skill. Модель не вызывалась. CLI help и установленный resource-loader подтверждают, что явные skill paths сохраняются при отключении discovery. [RPC upstream](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md).

Это профиль диагностического теста, не готовая команда для продуктовой работы: --no-context-files также отключает AGENTS.md. В реальном запуске либо сохраняй проверенное native discovery инструкций, либо явно передай выбранный AGENTS.md поддерживаемым способом. Отключение extensions не отключает явно переданные -e; не добавляй их без необходимости.

После обновления повтори `npm run test:native` для CLI discovery и `npm run test:pi-context -- <installed-pi-package-directory>` для подготовленного SDK-контекста. Второй тест загружает уже установленный `@earendil-works/pi-coding-agent`, ничего не устанавливает и не вызывает модель. Использует нативные `DefaultResourceLoader` и `createAgentSession`, проверяет `session.systemPrompt` и активные tools. Это проверочный клиент SDK, не новый harness. [SDK upstream](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md).

В SDK 0.80.3 проверено: выбранный AGENTS присутствует, metadata выбранного skill присутствуют, его полный body остаётся отложенным, посторонние инструкции и skills отсутствуют, активен только `read`. Отдельный отрицательный контроль показывает: `noContextFiles` **не отключает SYSTEM.md и APPEND_SYSTEM.md**. В проверочном профиле автоматический system override подавлен явным `systemPrompt: ''`, а `appendSystemPrompt` содержит выбранный файл. CLI предоставляет отдельные `--system-prompt` и повторяемые `--append-system-prompt`; тождество итогового CLI prompt этому SDK-профилю пока не проверено.

Тест использует отдельный agentDir, in-memory settings/auth/session и фиктивные ресурсы. Он не доказывает изоляцию обычного запуска с пользовательскими packages/settings. В продуктовой настройке явно учти все применимые обязательные инструкции от workspace до target и shared policy; исключение родительского файла-приманки в тесте не разрешает пропускать применимые правила. Не меняй пользовательский agentDir ради теста.

Доказательство сохраняется в `e2e/tmp/pi-context-*/proof.json`; содержит версию, выбранные пути, tools и hash подготовленного prompt. Выполнение skill и model turn не проверены. `read` ограничивает набор инструментов, но не является файловой песочницей. Для рабочего CLI-сеанса остаётся проверить packages, extensions, prompts и фактически подготовленный контекст с его настройками.
