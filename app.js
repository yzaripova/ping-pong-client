'use strict';

document.addEventListener('DOMContentLoaded', init);

let ws;
let formElement;
let canvas;
let ctx;
let options;
let gameInfo;
let stopToken = { stop: true };
let shouldSyncPaddlePosition = false;
let pressedKeyCode;
let currentUserId;
let opponentUserInfo = {name: '', email: ''};

function init() {
  //ws = new WebSocket('wss://ping-pong-server.herokuapp.com');
  //ws = new WebSocket('ws://localhost:3000');
  ws = new WebSocket('wss://ping-pong.10100111.space');
  ws.addEventListener('message', onUpdateData);

  formElement = document.getElementById('form');
  const btnSend = formElement.querySelector('button');
  btnSend.addEventListener('click', onSendUserInfo);

  const btnReady = document.querySelector('.btn-ready');
  btnReady.addEventListener('click', onSendReady);

  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('keyup', onKeyUp, false);
}

function onUpdateData(event) {
  let message = JSON.parse(event.data);

  if (message.event === 'connected') {
    const lobbyData = message.lobby;
    currentUserId = message.user.id;
    setlocalStorageUserInfo(message.user.name, message.user.email);

    if (lobbyData.users.length > 1) {
      onLoadFirstPlayerInfo(lobbyData.users[1]);
      onLoadSecondPlayerInfo(lobbyData.users[0]);
    } else {
      onLoadFirstPlayerInfo(lobbyData.users[0]);
    }

    onShowLobby();
  } else if (message.event === 'user-connected') {
    opponentUserInfo = message.user;
    onLoadSecondPlayerInfo(message.user);
  } else if (message.event === 'get-ready') {
    gameInfo = message.game;
    options = message.options;

    showTimer(message.countdown);
    document.querySelector('body').classList.add('loading');

    canvas.width = options.fieldSize.x;
    canvas.height = options.fieldSize.y;

    console.log(
      'Running with ' + options.fps + ' fps, '
        + options.tickRate + ' tick rate.'
    );

    stopToken.stop = false;
    animate({
      fps: options.fps,
      stopToken: stopToken
    }, drawFrame);

    onShowGame();
  } else if (message.event === 'started') {
    document.querySelector('body').classList.remove('loading');
    gameInfo = message.game;
    generatePlayerInfoWithScoreHtml(gameInfo.players);
    document.querySelector('.btn-ready').disabled  = false;
  } else if (message.event === 'sync') {
    if (shouldSyncPaddlePosition) {
      let localPaddle = getMyPaddle();
      gameInfo = message.game;
      setMyPaddle(localPaddle);

      shouldSyncPaddlePosition = false;
      onSendUserPaddle();
    } else {
      gameInfo = message.game;
    }
  } else if (message.event === 'score') {
    // const timeout = message.timeout;
    gameInfo = message.game;
    updateScore();
    findWin();
  } else if (message.event === 'user-disconnected') {
    resetGame();
    opponentUserInfo = null;
    document.querySelector('.second-player')
            .innerHTML(`<div class="waiting">Waiting opponent...</div>`);
  }
}

function onShowLobby() {
  stopToken.stop = true;

  const lobbyElement = document.querySelector('.lobby');
  const loginElement = document.querySelector('.login');
  const playingFieldElement = document.querySelector('.playing-field');

  loginElement.classList.add('hide');
  playingFieldElement.classList.remove('show');
  playingFieldElement.classList.add('hide');
  lobbyElement.classList.remove('hide');
  lobbyElement.classList.add('show');
}

function onShowGame() {
  const lobbyElement = document.querySelector('.lobby');
  const playingFieldElement = document.querySelector('.playing-field');

  lobbyElement.classList.add('hide');
  lobbyElement.classList.remove('show');
  playingFieldElement.classList.remove('hide');
  playingFieldElement.classList.add('show');
}

function resetGame() {
  onShowLobby();
  gameInfo = null;
}

function animate(settings, callback) {
  const fps = settings.fps || 60;
  const delay = 1000 / fps;
  let lastTime = Date.now();

  let loop = function() {
    if (settings.stopToken.stop === true) {
      return;
    }

    requestAnimationFrame(loop);

    const now = Date.now();
    const elapsed = now - lastTime;

    // If enough time has elapsed, draw the next frame.
    if (elapsed >= delay) {
      // Get ready for next frame by setting `lastTime = now`, but...
      // `now - (elapsed % delay)` is an improvement over just
      // using `lastTime = now`, which can end up lowering overall fps.
      lastTime = now - (elapsed % delay);

      callback();

      // TESTING... Report #seconds since start and achieved fps.
      // let sinceStart = now - startTime;
      // let currentFps = Math.round(1000 / (sinceStart / ++frameCount) * 100) / 100;
    }
  };

  requestAnimationFrame(loop);
}

function drawFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#228b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawBall();
  drawPaddles();
  ctx.fillRect(0, (canvas.height / 2) - 1, canvas.width, 2);

  predictNextFrame();
  movePaddle();
}

function drawBall() {
  let ball = gameInfo.ball;

  let radius = options.ballSize / 2;
  ctx.beginPath();
  ctx.fillStyle = '#fff';
  ctx.arc(ball.x + radius, ball.y + radius, radius, 0, Math.PI * 2);
  ctx.fill();
}

// NOTE: keep this code in sync with server's "physics".
function predictNextFrame() {
  let ball = gameInfo.ball;
  let players = gameInfo.players;

  if (ball.x <= 0 || ball.x >= options.fieldSize.x - 1) {
    ball.velocity.x *= -1;
  }

  if (players.length === 2) {
    let topPlayer = players.find(player => player.id !== currentUserId);
    let bottomPlayer = players.find(player => player.id === currentUserId);

    if (ball.y <= topPlayer.racket.y + options.racketThickness) {
      computeHorizRacketCollision(topPlayer, ball);
    } else if (ball.y + options.ballSize >= bottomPlayer.racket.y) {
      computeHorizRacketCollision(bottomPlayer, ball);
    }

    if (ball.y <= 0) {
      ball.velocity.x = 0;
      ball.velocity.y = 0;
    } else if (ball.y >= options.fieldSize.y - options.ballSize) {
      ball.velocity.x = 0;
      ball.velocity.y = 0;
    }
  }

  ball.x += ball.velocity.x;
  ball.y += ball.velocity.y;
}

function computeHorizRacketCollision(player, ball) {
  const collision = ball.x > player.racket.x - options.ballSize
        && ball.x < player.racket.x + options.racketWidth;

  if (collision) {
    ball.velocity.y *= -1;

    let delta = Math.abs(player.racket.x - ball.x);
    if (delta < options.racketWidth / 3) {
      ball.velocity.x = -1;
    } else if (delta < options.racketWidth * 2 / 3) {
      ball.velocity.x = 0;
    } else {
      ball.velocity.x = 1;
    }
  }

  return collision;
}

function drawPaddles() {
  gameInfo.players.forEach(player => {
    let paddle = player.racket;

    ctx.fillStyle = "#fff";
    ctx.fillRect(
      paddle.x,
      paddle.y,
      options.racketWidth,
      options.racketThickness
    );
  });
}

function movePaddle() {
  let deltaX;
  const moveSpeed = 7;

  if (pressedKeyCode === 37) {
    deltaX = -moveSpeed;
  } else if (pressedKeyCode === 39) {
    deltaX = moveSpeed;
  }

  if (deltaX) {
    const minX = 0;
    const maxX = options.fieldSize.x - options.racketWidth;

    let paddle = getMyPaddle();
    paddle.x += deltaX;

    if (paddle.x < minX) {
      paddle.x = minX;
    } else if (paddle.x > maxX) {
      paddle.x = maxX;
    }

    shouldSyncPaddlePosition = true;
  }
}

function onKeyDown(event) {
  pressedKeyCode = event.keyCode;
}

function onKeyUp(event) {
  pressedKeyCode = null;
}

function getMyPaddle() {
  let currentPlayer = gameInfo.players.find(player => player.id === currentUserId);
  return currentPlayer.racket;
}

function setMyPaddle(paddle) {
  let currentPlayer = gameInfo.players.find(player => player.id === currentUserId);
  currentPlayer.racket = paddle;
}

function findWin() {
  gameInfo.players.forEach(player => {
    if (player.score === 11) {
      document.querySelector('body').classList.add('loading');
      const loadingInfoElement = document.querySelector('.loading-info div');
      loadingInfoElement.textContent = player.id === currentUserId ? 'You are winner!' : 'You are loser!';

      setTimeout(() => {
        document.querySelector('body').classList.remove('loading');
        resetGame();
      }, 3000);
    }
  })
}

function setlocalStorageUserInfo(name, email) {
  localStorage.setItem('name', name);
  localStorage.setItem('email', email);
}

function getlocalStorageUserInfo() {
  let name = localStorage.getItem('name');
  let email = localStorage.getItem('email');

  return {name, email};
}

function toggleClassForBody(className) {
  document.querySelector('body').classList.toggle(className);
}

function showTimer(time) {
  const loadingInfoElement = document.querySelector('.loading-info div');
  let timeSecond = time / 1000;
  loadingInfoElement.textContent = timeSecond;
  let timerId = setInterval(function() {
    timeSecond--;
    loadingInfoElement.textContent = timeSecond;
  }, 1000);

  setTimeout(function() {
    clearInterval(timerId);
    loadingInfoElement.textContent = '';
  }, time);
}

function onLoadFirstPlayerInfo(info) {
  const firstPlayerElement = document.querySelector('.first-player');
  generatePlayerInfoHtml(firstPlayerElement, info);
}

function onLoadSecondPlayerInfo(info) {
  const secondPlayerElement = document.querySelector('.second-player');
  generatePlayerInfoHtml(secondPlayerElement, info);
}

function generatePlayerInfoHtml(domElement, info) {
  let html = `<div class="pesonal-info">
                <div class="name">${info.name || 'Anonymous'}</div> <br>
                <span class="email">${info.email || ''}</span>
              </div>
              <img src='img/noavatar.png'>`;
  domElement.innerHTML = html;
}

function generatePlayerInfoWithScoreHtml(players) {
  const playersAndScoreElement = document.querySelector('.players-and-score');
  let currentUserInfo = getlocalStorageUserInfo();
  let html = 
  `<div class="player">
    <img src='img/noavatar.png'>
    <div class="name">${currentUserInfo.name || 'Anonymous'}</div>
  </div>
  <div class="score">0 : 0</div>
  <div class="player">
    <img src='img/noavatar.png'>
    <div class="name">${opponentUserInfo.name || 'Anonymous'}</div>
  </div>`;

  playersAndScoreElement.innerHTML = html;
}

function updateScore() {
  const scoreElement = document.querySelector('.players-and-score .score');
  let players = gameInfo.players;
  let currentUserInfo = players.find((user) => user.id === currentUserId);
  let opponentUserInfo = players.find((user) => user.id !== currentUserId);
  scoreElement.textContent = `${currentUserInfo.score} : ${opponentUserInfo.score}`;
}

function onSendMessage(data) {
  ws.send(JSON.stringify(data));
}

function onSendReady(event) {
  event.preventDefault();
  document.querySelector('.btn-ready').disabled = true;
  onSendMessage({action: 'ready'});
}

function onSendUserInfo(event) {
  event.preventDefault();
  let formData = new FormData(formElement);
  let result = {};

  for (var entry of formData.entries()) {
      result[entry[0]] = entry[1];
  }

  onSendMessage({
    action: 'join',
    user: result
  });
}

function onSendUserPaddle() {
  let paddle = getMyPaddle();

  onSendMessage({
    action: 'move',
    x: paddle.x,
    y: paddle.y
  });
}
