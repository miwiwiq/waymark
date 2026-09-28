# Assignment

The original task and the assessor's answers to clarifying questions, kept verbatim. Choices built on them are in [decisions.md](decisions.md).

## Spec

```text
A social travel platform where users share multi-media travel logs
The Microservices Architecture
Break the backend into four distinct services. This prevents a crash in one area (like image processing) from taking down the whole app.
1. Auth & Identity Service
This service handles who the user is. It uses NestJS and PostgreSQL with TypeORM. Use Passport.js for the Google OAuth and local email/password login. When a user signs up, this service generates a JWT pair (Access and Refresh).
Storage: PostgreSQL stores user credentials and profile details (username, date of birth).
Session Management: Redis stores the Refresh Tokens so you can "log out" a user by deleting their session from the cache.
Communication: After a successful signup, this service sends a message to RabbitMQ to let other services know a new user profile needs to be created.
2. User & Relation Service
This service manages the "Social Graph"—who follows whom. It uses NestJS and PostgreSQL. It handles the "Private Profile" logic, where follow requests are stored with a status of "PENDING," "ACCEPTED," or "REJECTED."
Communication: It listens to RabbitMQ for "User Created" events from the Auth service to initialize a profile. It also provides an internal API for the Feed service to check a user's following list.
3. Post & Media Service
Since travel posts involve many images and videos (1-10 per post), we use MongoDB with Mongoose here. MongoDB is great for storing flexible post content and arrays of image URLs.
Media Handling: Use AWS S3 or Google Cloud Storage to host the actual images. The database only stores the URL link.
Features: It handles creating, editing, and archiving posts. Archiving simply sets a isArchived: true flag in MongoDB.
4. Feed & Interaction Service
This service manages likes, comments, and the main feed logic. It uses NestJS and Redis.
Logic: When a user opens their feed, this service asks the Relation Service for the "Followed IDs," then queries the Post Service for the latest posts from those IDs.
Caching: Use Redis to cache the "Top 20" posts for popular users to make the feed load instantly.
Service Communication Diagram
[ Next.js Frontend ]
|
[ API Gateway ] (Nginx or NestJS Proxy)
|
-------------------------------------------
|               |                         |
[Auth Svc] <--> [User Svc] <-----------> [Post Svc]
|               |            |            |
[Postgres]     [Postgres]   [RabbitMQ]    [MongoDB]
|               |            |            |
[Redis]            -------> [Feed Svc] <------
Frontend Development Process
You will use Next.js for the frontend because it provides "Server Side Rendering" (SSR), which makes your travel posts searchable on Google (SEO).
State Management: Use React Context or Zustand to hold the user's login state.
Authentication Flow: The frontend intercepts 401 errors. If an Access Token expires, it automatically calls the Refresh endpoint to get a new one without the user noticing.
Media Upload: Use a library like react-dropzone. Upload files directly to S3 from the frontend (using Pre-signed URLs) to keep your backend from getting choked by heavy video files.
The Feed: Use React Query for "Infinite Scroll." As the user reaches the bottom, the frontend asks for the next page of travel posts.
Containerization & Deployment
Docker Setup
Each microservice and the frontend will have its own Dockerfile. For local development, use Docker Compose to spin up all services, including the PostgreSQL, MongoDB, Redis, and RabbitMQ containers, with a single command: docker-compose up.
```

## Clarifications

```text
1. Стек и дополнительные библиотеки

Названные технологии обязательны: NestJS, PostgreSQL + TypeORM, MongoDB + Mongoose, Redis, RabbitMQ, Passport.js, Next.js, React Query, Zustand/Context, Docker Compose. Их нельзя заменять аналогами (например, Prisma вместо TypeORM или Kafka вместо RabbitMQ). Вспомогательные библиотеки добавлять можно и нужно: валидация (class-validator, zod), логирование, UI-кит, формы, тесты, Swagger. Если какой-то выбор неочевиден, достаточно одной строки обоснования в README.
2. Облако и ключи

Деплоить в реальное облако не нужно, всё должно подниматься локально через docker-compose up.
S3: вместо AWS используйте MinIO в docker-compose. Он S3-совместимый, и pre-signed URLs работают так же, поэтому код не придётся менять при переходе на настоящий S3. Полностью замоканный фейковый upload не подходит, флоу загрузки через pre-signed URL должен работать по-настоящему.
Google OAuth: ключи можно бесплатно завести за 5 минут в Google Cloud Console (OAuth client с redirect на localhost). Ключи не коммитим, в репо кладём .env.example. Если без ключей Google-логин просто отключается, а local login работает, это нормально. Главное, чтобы код стратегии был реализован.
3. Скоуп фронта и «travel»-часть

Минимальный набор страниц:
регистрация и логин (email/password + Google);
лента с infinite scroll;
создание и редактирование поста с загрузкой 1–10 фото/видео;
страница поста с лайками и комментариями. Именно она должна рендериться через SSR, ради неё в задании упомянуто SEO;
профиль пользователя: его посты, followers/following, кнопка follow/unfollow, для своего профиля ещё редактирование и переключатель private;
входящие follow requests (accept/reject);
архив своих постов с возможностью разархивировать.
Админка и user management не нужны, только редактирование собственного профиля.
Travel-специфика задаётся полями поста: заголовок, описание/caption, локация (минимум страна и город текстом, координаты опционально), даты поездки (start/end), медиа. Теги опциональны. Карта, фильтр по локации и тому подобное считаются бонусом, а не требованием.
4. Design-документ

Отдельный proposal не нужен. Достаточно хорошего README, в котором есть:
как запустить;
схема архитектуры;
принятые решения и отклонения от спецификации (как раз те, что всплыли в этих вопросах);
известные ограничения и что можно улучшить.
5. Лайки и комментарии

Основное хранилище для лайков и комментариев — PostgreSQL (у Feed & Interaction Service своя база). Redis используется как кеш для горячих данных: топ-посты, счётчики лайков, первая страница ленты. Ваш план полностью соответствует ожиданиям.

6. Image processing

Это был просто пример того, зачем изолировать сервисы, а не требование. Можно опустить. Если хочется бонус, можно сделать асинхронную генерацию превью: после загрузки отправить событие в RabbitMQ, воркер делает thumbnail. Это не обязательно.

7. Общение Auth и User Service, создание профиля

Auth и User Service общаются асинхронно через RabbitMQ: после регистрации Auth публикует событие user.created, User Service его слушает и создаёт профиль. Прямая синхронная связь между ними не нужна.
Auth хранит только credentials, а владельцем профиля (username, date of birth и т.д.) является User Service. Эти данные передаются в событии user.created.
Про флоу после регистрации: да, пользователь попадает на главную и фетчит профиль. Polling с exponential backoff при 404 подходит. Нужен лимит попыток (например, 5), после которого показывается понятное состояние ошибки, а пока профиль грузится, показывается skeleton. Можно и по-другому: положить базовые данные (id, username) в access token или в ответ на регистрацию, чтобы UI отрисовался сразу. Подходит любой вариант, важно описать выбранный в README. Бонусом будет outbox pattern в Auth, чтобы событие не терялось, если RabbitMQ был недоступен в момент регистрации.
Если хотите заранее закрыть вопрос про хранение токенов, можно добавить отдельным пунктом:

8. Pending-запросы, когда профиль становится публичным

Автоматически принимаем все PENDING-запросы, как это сделано в Instagram. REJECTED остаются отклонёнными. Опишите это поведение в README.
9. Нагрузка и масштабирование

Требований по RPS нет, нагрузочные тесты не нужны. Приветствуется короткий раздел в README о том, как система масштабировалась бы теоретически: stateless-сервисы и горизонтальное масштабирование, fan-out on read vs on write для ленты, кеширование, индексы, read replicas. Достаточно нескольких абзацев, это не обязательно.
```
