'use strict';

document.addEventListener('DOMContentLoaded', init);

let ws;
let formElement;
let canvas;
let ctx;
let paddles = [];
let options;
let gameInfo;
let fps;
let lastKeyDownCode;
let isAnimating;

function init() {
  ws = new WebSocket('ws://localhost:3001');
  ws.addEventListener('message', onUpdateData);

  formElement = document.getElementById('form');
  const btnSend = formElement.querySelector('button');
  btnSend.addEventListener('click', onSendUserInfo);

  const btnReady = document.querySelector('.btn-ready');
  btnReady.addEventListener('click', onSendReady);

  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  document.addEventListener('keydown', updatePaddlePosition, false);
}

function onUpdateData(event) {
  let message = JSON.parse(event.data);
  
  if (message.event && message.event === 'connected') {
    const lobbyData = message.lobby;

    if (lobbyData.users.length > 1) {
      onLoadFirstPlayerInfo(lobbyData.users[1]);
      onLoadSecondPlayerInfo(lobbyData.users[0]);
    } else {
      onLoadFirstPlayerInfo(lobbyData.users[0]);
    }

    onShowLobby();
  }

  if (message.event && message.event === 'user-connected') {
    onLoadSecondPlayerInfo(message.user);
  }

  if (message.event && message.event === 'get-ready') {
    showTimer(message.countdown);
    document.querySelector('body').classList.add('loading');

    canvas.width = message.options.fieldSize.x;
    canvas.height = message.options.fieldSize.y;

    paddles.push(new Paddle('bottom', message.options.racketWidth, 
      message.options.racketThickness));
    paddles.push(new Paddle('top', message.options.racketWidth, 
      message.options.racketThickness));

    gameInfo = message.game;
    options = message.options;

    draw();
    onShowGame();
  }

  if (message.event && message.event === 'started') {
    document.querySelector('body').classList.remove('loading');
    gameInfo = message.game;
    startAnimation();
  }

  if (message.event && message.event === 'sync') {
    if (lastKeyDownCode) {
      onSendUserPaddle(lastKeyDownCode);
    }
    gameInfo = message.game;
    draw();
  }

  if (message.event && message.event === 'user-disconnected') {
    onShowLobby();
    onSendMessage({action: 'not-ready'});
  }
}

function onShowLobby() {
  const lobbyElement = document.querySelector('.lobby');
  const loginElement = document.querySelector('.login');
  const playingFieldElement = document.querySelector('.playing-field');

  loginElement.classList.add('hide');
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

function startAnimation() {
  let now;
  let then = Date.now();
  let delay = 1000/fps;
  let delta;
  isAnimating = true;

  requestAnimationFrame(startAnimation);
     
    now = Date.now();
    delta = now - then;
    
    if (delta > delay && isAnimating) {
      then = now - (delta % delay);
        draw();
    }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#228b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawBall();
  drawPaddles();
  ctx.fillRect(0, canvas.height/2 - 1, canvas.width, 2);
}

function drawBall() {
  let ball = gameInfo.ball;
  let radius = options.ballSize / 2;
  ctx.beginPath();
  ctx.fillStyle = '#fff';
  ctx.arc(ball.x, ball.y, radius, 0, Math.PI*2, false);
  ctx.fill();
}

function drawPaddles() {
  paddles.forEach(padd => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(padd.x, padd.y, padd.w, padd.h);
  });
}

function updatePaddlePosition(event) {
  if (event.keyCode !== 37 && event.keyCode !== 39) {
    return;
  }

  lastKeyDownCode = event.keyCode;

  if (event.keyCode === 37) {
    paddles[0].x -= 10;

    if (paddles[0].x < 0) {
      paddles[0].x = 0;
    }
  }

  if (event.keyCode === 39) {
    paddles[0].x += 10;

    if (paddles[0].x > canvas.width - paddles[0].w) {
      paddles[0].x = canvas.width - paddles[0].w;
    }
  }

  draw();
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
  domElement.innerHTML =html;
}

function onSendMessage(data) {
  ws.send(JSON.stringify(data));
}

function onSendReady(event) {
  event.preventDefault();
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

function onSendUserPaddle(keyCode) {
  onSendMessage({
    action: 'move',
    x: paddles[0].x,
    y: paddles[0].y,
    keyCode: keyCode
  })
}

function Paddle(pos, width, height) {
  this.h = height;
  this.w = width;
  
  this.x = canvas.width/2 - this.w/2;
  this.y = (pos === 'top') ? 0 : canvas.height - this.h;
}