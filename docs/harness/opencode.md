# OpenCode

Выбирай для OpenCode. Базовые границы — [context](../context.md).

Подключай выбранные skills в target `.agents/skills/` или нативном `.opencode/skills/`, учитывая другие поддерживаемые источники. Не дублируй один skill в обоих каталогах. Для фильтрации модельного доступа применяются `permission.skill` в локальном opencode.json: deny скрывает и запрещает skill, ask оставляет запрос разрешения. Allowlist задаётся default deny и явными allow для выбранных имён. [Официальные правила](https://opencode.ai/docs/skills/).

Фактически проверена версия 1.18.4: `opencode --pure debug skill` обнаружил собственный pm-probe skill каждого target и исключил sibling, но также перечислил 14 унаследованных ресурсов. Debug discovery не доказывает фильтрацию metadata через permission.skill. Перед продуктовым запуском проверь эффективные разрешения конкретного агента и доступный ему каталог отдельно.

--pure исключает external plugins в диагностическом запуске; не считай это отключением встроенных возможностей и глобальных skills. Plugins, MCP и tools имеют отдельную конфигурацию. Не запускай непроверенный plugin как побочный эффект подключения документации.

Воспроизведение discovery — `npm run test:native`. Полный prompt и выполнение skill не проверены. CLI вывод записывается в локальный файл: на проверенной версии pipe мог вернуть обрезанный JSON, поэтому тест не принимает неполный вывод за пустой каталог.


`npm run test:opencode-permissions` отдельно проверяет реальное исполнение нативного `skill` tool через `opencode --pure debug agent build --tool skill --params '{"name":"probe-selected"}'`, без модельного запроса. На 1.18.4 положительный контроль загружает body второго fixture skill при allow; после изменения локального opencode.json на default deny + selected allow выбранный body загружается, а известный невыбранный skill получает permission refusal. Это проверка разрешения tool-call, не исполнение описанной в skill процедуры.

Proof с CLI arguments, результатами и ограничениями сохраняется в `e2e/tmp/opencode-permissions-*/proof.json`. Тест изменяет только собственный fixture. Конфигурация конкретного агента может переопределять общий permission: проверяй фактический agent, а не только содержимое opencode.json. Полный prompt и скрытие metadata у denied skills остаются документированным поведением, которое этот probe напрямую не наблюдает.
