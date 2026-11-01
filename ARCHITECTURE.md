# Месяц чтения — карта архитектуры

Обновлена 01.11.2026. Та же схема для двойного клика — `Карта.html`, правятся вместе.

Приложение на телефон по рилсу «6 тем за месяц»: 30 уроков-конспектов, ссылки на лекции и сайты,
читалка своих книг. Сервера нет: всё работает в браузере телефона, данные — только в телефоне.

```mermaid
flowchart TD
  User([Павел · телефон или компьютер])

  Screens["Экраны · index.html + js/app.js<br/>Сегодня · Курс · Урок · Книги · Читалка"]
  Reader["Разбор книг · js/books.js + js/zip.js<br/>FB2 · FB2.ZIP · EPUB · TXT"]
  SW["Работа без интернета · sw.js"]

  Lessons[("Уроки · js/lessons.js")]
  Content[("Конспекты 6 тем · content/*.json")]
  Build["Сборка и проверка · _служебное/build.js"]
  Progress[("Прогресс и закладки · localStorage mesyac.v1")]
  Files[("Файлы книг · IndexedDB mesyac-chteniya")]

  Shop([Магазин книг · ЛитРес])
  Web([Лекции и сайты · Open Yale, YouTube, Our World in Data, Google Arts & Culture])

  User -->|"читает"| Screens
  Content -->|"собирает"| Build
  Build -->|"пишет и поднимает версию"| Lessons
  Lessons -->|"30 уроков"| Screens
  Screens ==>|"пройденные дни, ответы, место в книге"| Progress
  Screens -->|"загруженный файл"| Reader
  Reader ==>|"хранит файл"| Files
  SW -.->|"кэширует приложение"| Screens
  User -.->|"покупает книгу, скачивает FB2/EPUB"| Shop
  Screens -.->|"ссылки открываются отдельно"| Web

  classDef cloud fill:#e8f0fe,stroke:#4285f4
  classDef warn fill:#fff3cd,stroke:#b8860b
  class Shop,Web cloud
  class Progress,Files warn
  linkStyle 4,6 stroke:#d33,stroke-width:3px
```

**Легенда**
- **Синие** — внешние сайты: магазин книг и открытые лекции. Приложение их только открывает ссылкой, данных туда не шлёт.
- **Янтарные** — данные, которые живут только в этом телефоне: прогресс и файлы книг. Очистка данных сайта в браузере их сотрёт.
- **Красные линии** — запись этих данных.
- **Пунктир** — необязательные пути: кэш для офлайна, покупка книги, внешние ссылки.
