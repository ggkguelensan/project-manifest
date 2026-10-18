# Codex CLI

Выбирай при работе target через Codex. Базовые границы — [context](../context.md).

Подключай выбранные skill directories ссылками в `<target>/.agents/skills/`. Codex сканирует от cwd до Git root и наследует user/admin/system skills; symlink directories поддерживаются. Не помещай объединение стеков всех targets в repo-root каталог. [Официальное обнаружение](https://learn.chatgpt.com/docs/build-skills).

Per-skill `skills.config` управляет enabled по пути; применимость локального config зависит от доверия проекту. Это отдельная проверка при установке, не предположение, что отсутствие локального файла отключает глобальный. Конфигурация MCP/plugins проверяется независимо. [Config reference](https://learn.chatgpt.com/docs/config-file/config-reference).

Фактически проверена версия 0.163.0: `skills/list` app-server с двумя cwds и forceReload на fixture увидел только собственный pm-probe skill в каждом target, но также 12 унаследованных enabled skills. Число относится к тестовой среде, не является свойством Codex. [Протокол](https://learn.chatgpt.com/docs/app-server).

Воспроизведение базового discovery — `npm run test:native`. Для фильтрации есть `npm run test:codex-selection`: первый процесс получает фактические paths через skills/list, второй запускается с process-local `-c 'skills.config=[{path="/absolute/skill/SKILL.md",enabled=false},…]'` для невыбранных paths. В 0.163.0 проверено сокращение enabled-набора с 14 (два fixture skills и 12 inherited) до одного выбранного. Ответ диагностики сохраняет отключённые entries с enabled=false. Глобальные файлы не меняются; доказательство сохраняется в `e2e/tmp/codex-selection-*/proof.json`.

Это нативные [CLI config overrides](https://learn.chatgpt.com/docs/cli/reference), не собственный loader. Перед запуском определи нужные skills задачи и их пути, получи текущий discovery, задай исключения и проверь результат в новом процессе. Не заменяй обязательную policy и не отключай skill, требуемый выбранной процедурой. При изменении установленных skills повтори discovery: список paths — снимок состояния, не wildcard-запрет будущих ресурсов. Не сохраняй такие абсолютные пути как переносимые общие defaults.

Проверены discovery и enabled metadata ответа app-server, без model turn. Полный prompt, чтение body и plugin/tool activation не проверены; отключение skill не доказывает отключение его инструментов. Итоговый enabled-набор и отдельные настройки MCP/plugins проверяются для конкретного продуктового запуска. Новый сеанс обязателен после смены состава контекста.
