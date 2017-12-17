# ping-pong-client

Онлайн-игра пинг-понг с использованием Canvas

##Описание работы
* Игра 2D (вид сверху). У каждого игрока своя платформа(ракетка) управляемая клавиатурой (стрелки вправо и влево). Мяч считается забитым, если он задел стенку соперника, не задев ракетки. Игра окончивается, если один из игроков покидает сессию.
* Пользователь заходит на стартовую старницу, заполняет форму (имя, email). Если нет игрока ожидающего соперника, то ему создается отдельная сессия, игрок переходит на страницу лобби и ожидает соперника. Если уже есть игрок ожидающий соперника, то присоединяется к нему.
* На странице лобби игроку необходимо подтвердить готовность начать игру. После готовности обоих игроков, через некоторый интервал времени, будет отображена страница игры.
* Обмен данными между игроками осуществляется через WebSocket. Информация об игроках формируется перед началом игры на основе введенных данных и данных с сервера, вставляется в DOM-дерево. Аватарки игроков запрашиваются на сервисе gravatar по ранее введенному адресу почты. Счет обновляется после соотвествующих событий с сервера.
* Описание работы сервера: https://github.com/nag5000/ping-pong-server

##Стартовая страница
![Start page](/img/dis01.png)
Format: ![Alt Text](url)

##Лобби
![Lobby page](/img/dis02.png)
Format: ![Alt Text](url)

##Страница игры
![Start page](/img/dis03.png)
Format: ![Alt Text](url)

##TODO
* Не удаляет запросить данные профиля с gravatar.
* Игра не заканчивает, необходимо продумываем логики совместно с сервером.
* Анимация движения мяча не плавна, необходима более сложная логика клиента с учетом пинга.


