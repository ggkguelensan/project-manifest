# Codex CLI

Выбирай при работе target через Codex. Базовые границы — [context](../context.md).

Подключай выбранные skill directories ссылками в `<target>/.agents/skills/`. Codex сканирует от cwd до Git root и наследует user/admin/system skills; symlink directories поддерживаются. Не помещай объединение стеков всех targets в repo-root каталог. [Официальное обнаружение](https://learn.chatgpt.com/docs/build-skills).

Per-skill `skills.config` управляет enabled по пути; применимость локального config зависит от доверия проекту. Это отдельная проверка при установке, не предположение, что отсутствие локального файла отключает глобальный. Конфигурация MCP/plugins проверяется независимо. [Config reference](https://learn.chatgpt.com/docs/config-file/config-reference).

Фактически проверена версия 0.163.0: `skills/list` app-server с двумя cwds и forceReload на fixture увидел только собственный pm-probe skill в каждом target, но также 12 унаследованных enabled skills. Число относится к тестовой среде, не является свойством Codex. [Протокол](https://learn.chatgpt.com/docs/app-server).

Воспроизведение — `npm run test:native`. Проверены discovery и enabled metadata ответа сервера. Полный prompt, чтение body, plugin/tool activation и локальный фильтр унаследованных skills этим тестом не проверены. До заявления «только выбранный стек» отдельно проверь итоговый enabled-набор и исключения в конкретной установке. Новый сеанс обязателен после смены состава контекста.
