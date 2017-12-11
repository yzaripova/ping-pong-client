'use strict';

document.addEventListener('DOMContentLoaded', init);

let ws;
let formElement;
let canvas;
let ctx;
let paddles = [];
let ball = {};
let options;
let gameInfo;

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
  document.addEventListener('keydown', updatePosition, false);
}

function onUpdateData(event) {
  let message = JSON.parse(event.data);
  
  if (message.event && message.event === 'connected') {
    const lobbyData = message.lobby;
    onLoadFirstPlayerInfo(lobbyData.users[0]);
    onShowLobby();

    if (lobbyData.users.length > 1) {
      onLoadSecondPlayerInfo(lobbyData.users[1]);
    }
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

    drawPlayingField(message.options, message.game);
    onShowGame();
  }

  if (message.event && message.event === 'started') {
    document.querySelector('body').classList.remove('loading');
  }
}

function onShowLobby() {
  const lobbyElement = document.querySelector('.lobby');
  const loginElement = document.querySelector('.login');
  loginElement.classList.add('hide');
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

function drawPlayingField(options, gameInfo) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#228b22';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawBall({x: gameInfo.ball.x, y: gameInfo.ball.y, r: 
    options.ballSize/2});
  drawPaddles();
  ctx.fillRect(0, canvas.height/2 - 1, canvas.width, 2);
}

function drawBall(ball) {
  ctx.beginPath();
  ctx.fillStyle = '#fff';
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2, false);
  ctx.fill();
}

function drawPaddles() {
  paddles.forEach(padd => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(padd.x, padd.y, padd.w, padd.h);
  });
}

function Paddle(pos, width, height) {
  this.h = height;
  this.w = width;
  
  this.x = canvas.width/2 - this.w/2;
  this.y = (pos === 'top') ? 0 : canvas.height - this.h;
}

function updatePosition(event) {
  if (event.keyCode !== 37 && event.keyCode !== 39) {
    return;
  }

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

  drawPlayingField(options, gameInfo);
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