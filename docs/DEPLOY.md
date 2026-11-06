# Деплой

Сервер: VPS Aeza MSKs-1 (Москва), Ubuntu 24.04, 1 vCPU, 2 ГБ RAM + 2 ГБ swap. Адрес: https://lkstudenta.ru (запасной — https://83-141-92-172.sslip.io).

## Как устроено

```
Интернет → Caddy (80/443, HTTPS Let's Encrypt) → app (Next.js, :3000) → db (PostgreSQL 16)
```
- Наружу открыт только Caddy. База и приложение — во внутренней сети Docker.
- Брандмауэр ufw: 22, 80, 443. SSH — только по ключу, вход по паролю отключён.
- Секреты (`POSTGRES_PASSWORD`, `APP_SECRET`, `AI_API_KEY`) — в `/opt/dekanat/deploy/.env` на сервере, права 600. Сгенерированы на сервере, в репозиторий и в переписку не попадают.

## Обновить сервер после изменений

```bash
rsync -az --delete -e "ssh -i ~/.ssh/dekanat_aeza" --exclude node_modules --exclude .next --exclude .git --exclude .env --exclude '*.local.md' --exclude .claude --exclude deploy/out --exclude deploy/.env ./ root@83.141.92.172:/opt/dekanat/
```

```bash
ssh -i ~/.ssh/dekanat_aeza root@83.141.92.172 'cd /opt/dekanat/deploy && docker compose -f docker-compose.prod.yml build app && docker compose -f docker-compose.prod.yml --profile tools build tools && docker compose -f docker-compose.prod.yml run --rm tools npx prisma migrate deploy && docker compose -f docker-compose.prod.yml up -d app caddy'
```

## Догрузить новые справочные данные без очистки базы

```bash
ssh -i ~/.ssh/dekanat_aeza root@83.141.92.172 'cd /opt/dekanat/deploy && docker compose -f docker-compose.prod.yml run --rm -v /opt/dekanat/scripts:/app/scripts:ro tools npx tsx scripts/load-extras.ts'
```

## Пересоздать тестовые данные (удаляет все данные!)

```bash
ssh -i ~/.ssh/dekanat_aeza root@83.141.92.172 'cd /opt/dekanat/deploy && docker compose -f docker-compose.prod.yml run --rm -e ALLOW_SEED=1 -e SEED_CREDENTIALS_FILE=/app/out/demo-accounts.md tools npx tsx prisma/seed.ts'
```
Пароли тестовых аккаунтов появятся в `/opt/dekanat/deploy/out/demo-accounts.md` на сервере.

## Логи

```bash
ssh -i ~/.ssh/dekanat_aeza root@83.141.92.172 'cd /opt/dekanat/deploy && docker compose -f docker-compose.prod.yml logs --tail 100 app caddy'
```

## Ежедневные задачи (cron на сервере)

- 00:05 МСК — пересчёт демо-изменений расписания (`scripts/refresh-demo.ts`), чтобы переносы всегда были «на этой неделе».

## Обновить мероприятия МГИМО

mgimo.ru отдаёт автоматическим запросам заглушку защиты от ботов, обходить её мы не стали. Анонсы снимаются вручную через обычный браузер в `data/mgimo-events.json` (раз в несколько дней), затем пересоздаются данные или выполняется загрузка только мероприятий.

> Образы собирать **по очереди** (`build app`, затем `build tools`): параллельная сборка на 2 ГБ памяти падает на `npm run build`.
