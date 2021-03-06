'use strict';

function makeHTMLtag(tagName, attrs, ...children) {
  let newTag = document.createElement(tagName);

  for (let key in attrs) {
    newTag[key] = attrs[key];
  }

  children.forEach(child => {
    if (typeof child === 'string') {
      child = document.createTextNode(child);
    }

    newTag.appendChild(child);
  });

  return newTag;
}

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
let rotateField = false;
let currentUserId;
let currentUserInfo = {name: '', email: ''};
let opponentUserInfo = {name: '', email: ''};
let socketEventHandlers = {
  'connected': onConnected,
  'user-connected': onUserConnected,
  'get-ready': onGetReady,
  'started': onStarted,
  'sync': onSync,
  'score': onScore,
  'user-disconnected': onUserDisconnected
};


function init() {
  ws = new WebSocket('wss://ping-pong.10100111.space');
  ws.addEventListener('message', onSocketMessage);

  formElement = document.getElementById('form');
  formElement.addEventListener('submit', onSendUserInfo);
  let currentUserInfo = getlocalStorageUserInfo();
  if (currentUserInfo.name !== '' || currentUserInfo.email !== '') {
    formElement.querySelector('input[name="name"]').value = currentUserInfo.name;
    formElement.querySelector('input[name="email"]').value = currentUserInfo.email;
  }

  const btnReady = document.querySelector('.btn-ready');
  btnReady.addEventListener('click', onSendReady);

  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('keyup', onKeyUp, false);
}

function onSocketMessage(event) {
  let message = JSON.parse(event.data);

  let handler = socketEventHandlers[message.event];
  if (handler) {
    handler(message);
  } else {
    throw new Error(`Handler doesn't exist: ${message.event}`);
  }
}

function onConnected(message) {
  const lobbyData = message.lobby;
  currentUserId = message.user.id;
  currentUserInfo = {name: message.user.name, email: message.user.email};
  setlocalStorageUserInfo(currentUserInfo.name, currentUserInfo.email);

  if (lobbyData.users.length > 1) {
    onLoadFirstPlayerInfo(lobbyData.users[1]);
    onLoadSecondPlayerInfo(lobbyData.users[0]);
  } else {
    onLoadFirstPlayerInfo(lobbyData.users[0]);
    rotateField = true;
    document.querySelector('body').classList.add('transform-canvas');
  }

  onShowLobby();
}

function onUserConnected(message) {
  onLoadSecondPlayerInfo(message.user);
}

function onGetReady(message) {
  gameInfo = message.game;
  options = message.options;

  showTimer(message.countdown);
  toggleClassForBody('loading');

  canvas.width = options.fieldSize.x;
  canvas.height = options.fieldSize.y;

  stopToken.stop = false;
  animate({
    fps: options.fps,
    stopToken: stopToken
  }, drawFrame);

  onShowGame();
}

function onStarted(message) {
 toggleClassForBody('loading');
 gameInfo = message.game;
 generatePlayerInfoWithScoreHtml(gameInfo.players);
 document.querySelector('.btn-ready').disabled  = false;
}

function onSync(message) {
  if (shouldSyncPaddlePosition) {
    let localPaddle = getMyPaddle();
    gameInfo = message.game;
    setMyPaddle(localPaddle);

    shouldSyncPaddlePosition = false;
    onSendUserPaddle();
  } else {
    gameInfo = message.game;
  }
}

function onScore(message) {
 gameInfo = message.game;
 updateScore();
}

function onUserDisconnected(message) {
  resetGame();
  currentUserInfo = null;
  opponentUserInfo = null;
  onShowWaitingMessage();    
}

function onShowWaitingMessage() {
  let secondPlayerElement = document.querySelector('.second-player');
  let children = secondPlayerElement.children;
  if (children.length > 0) {
    Array.from(children).forEach(child => secondPlayerElement.removeChild(child));
  }
  
  secondPlayerElement.appendChild(makeHTMLtag('div', {className: 'waiting'}, 'Waiting for opponent...'));
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

  if (rotateField) {
    deltaX *= -1;
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
  opponentUserInfo = info;
  generatePlayerInfoHtml(secondPlayerElement, info);
}

function generatePlayerInfoHtml(domElement, info) {
  let imgSrc = 'img/noavatar.png';
  if (info.email && info.email !== '') {
    //getAvatar(info.email, domElement);
    imgSrc = gravatar(info.email, {size: 200});
  }

  let personalInfoElement = makeHTMLtag('div', {className: 'pesonal-info'}, '', 
    makeHTMLtag('div', {className: 'name'}, info.name || 'Anonymous'),
    makeHTMLtag('div', {className: 'email'}, info.email || '')
    );
  
  if (domElement.children.length > 0) {
    domElement.replaceChild(personalInfoElement, domElement.children[0]);
  } else {
    domElement.appendChild(personalInfoElement);
  }
  
  domElement.appendChild(makeHTMLtag('img', {src: imgSrc}));
}

function generatePlayerInfoWithScoreHtml(players) {
  const playersAndScoreElement = document.querySelector('.players-and-score');
  let imgCurrentUser = currentUserInfo.email !== '' ? gravatar(currentUserInfo.email, {size: 200}) : 'img/noavatar.png';
  let imgOpponentUser = opponentUserInfo.email !== '' ? gravatar(opponentUserInfo.email, {size: 200}) : 'img/noavatar.png';

  playersAndScoreElement.appendChild(makeHTMLtag('div', {className: 'player'}, '',
    makeHTMLtag('img', {src: imgCurrentUser}, ''),
    makeHTMLtag('div', {className: 'name'}, currentUserInfo.name || 'Anonymous')
  ));
  playersAndScoreElement.appendChild(makeHTMLtag('div', {className: 'score'}, '0 : 0'));
  playersAndScoreElement.appendChild(makeHTMLtag('div', {className: 'player'}, '',
    makeHTMLtag('img', {src: imgOpponentUser}, ''),
    makeHTMLtag('div', {className: 'name'}, opponentUserInfo.name || 'Anonymous')
  ));
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

// TODO: blocked by CORS policy.
/*function getAvatar(email, domElement) {
  const request = new XMLHttpRequest();
  const url = gravatar(email) + '.json';
  request.open('GET', url);
  request.addEventListener('load', () => onLoadAvatar(domElement))
  request.send();
}

function onLoadAvatar(domElement) {
  if (request.status === 200) {
    const response = JSON.parse(request.responseText);
    domElement.querySelector('img').src = response.entries[0].photos[0].value;
  }
}*/

