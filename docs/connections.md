# Проверка подключённых адаптаций

Читай после выбора task worktree, до подключения предметных skills. Project владеет registry и выбором target; каждый предметный манифест проверяет собственную адаптацию. Наличие записи в registry не доказывает, что выбран правильный workdir.

Запусти из Project Manifest:

```sh
npm run validate:connections -- --project /absolute/project.json --root /absolute/MyProject --target web --worktree worktrees/frontend-task --purpose development --e2e e2e-manifest/workdir/my-project/frontend/web --design design-manifest/workdir/my-project/frontend/web
```

Это пример. Передавай только адаптации манифестов, выбранных target; для каждого выбранного манифеста адаптация обязательна. Пути --e2e/--design относительны project root. Release-параметры соответствуют [модели проекта](project-model.md).

Команда повторно читает Git и registry, проверяет чистые точные pins, вызывает scripts/adaptation.ts выбранной базы и сверяет repository/target IDs с выбором Project. Используются публичные CLI владельцев: E2E — именованные adaptation/base/target/scope; Design — directory/base/target/repository-id/target-id. Несовместимый CLI или формат отклоняется владельцем; fallback и автоматическая миграция отсутствуют. Это исполнение явно зарегистрированного доверенного локального кода, не sandbox.

Результат содержит selection и результаты владельцев без переписывания их настроек. Смысловые конфликты требований разных манифестов проверяет агент по исходным ресурсам. Сохранённый JSON — наблюдение на момент проверки, не вечное разрешение: после изменения ветки, pins или адаптаций выполни проверку снова. Native discovery и включённые tools проверяются [отдельно](context.md).

`npm run test:connections -- <common-project-root> <e2e-base> <design-base>` создаёт изолированный repository с вложенным target и task worktree, временные проектные данные в e2e/tmp Project и отдельные адаптации в игнорируемых workdir владельцев. Проверяет реальный вызов обоих валидаторов, неверную идентичность, пропущенную адаптацию и несовпадение pin. Оставляет proof в target/e2e/tmp/connections.json; исходники и tracked состояние checkout не меняются. Этот probe не запускает браузер и не проверяет применение произвольных проектных требований.
