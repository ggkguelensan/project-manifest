# Pi

Выбирай для Pi. Базовые границы — [context](../context.md).

Для явного набора используй `--no-skills` и повторяемые `--skill /absolute/selected-skill`. Packages и `.pi/settings.json` также поддерживаются нативно, но объединение всех ресурсов пакета не соответствует выбору target. [Skills upstream](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md).

Фактически проверена версия 0.80.3: offline RPC get_commands с одним --skill, --no-skills, --no-extensions, --no-prompt-templates, --no-themes и --no-context-files вернул ровно один тестовый skill. Модель не вызывалась. CLI help и установленный resource-loader подтверждают, что явные skill paths сохраняются при отключении discovery. [RPC upstream](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md).

Это профиль диагностического теста, не готовая команда для продуктовой работы: --no-context-files также отключает AGENTS.md. В реальном запуске либо сохраняй проверенное native discovery инструкций, либо явно передай выбранный AGENTS.md поддерживаемым способом. Отключение extensions не отключает явно переданные -e; не добавляй их без необходимости.

Повтори `npm run test:native` после обновления Pi. Проверены зарегистрированные skill commands, не полный prompt или выполнение процедуры. Для рабочего сеанса проверь также пакеты, extensions, prompts и фактические инструменты.
