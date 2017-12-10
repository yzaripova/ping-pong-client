'use strict';

document.addEventListener('DOMContentLoaded', init);

let ws;
let formElement;

function init() {
  ws = new WebSocket('ws://localhost:3001');
  ws.addEventListener('message', onUpdateData);

  formElement = document.getElementById('form');
  const btnSend = formElement.querySelector('button');
  btnSend.addEventListener('click', onSendUserInfo);

  const btnReady = document.querySelector('.btn-ready');
  btnReady.addEventListener('click', onSendReady);
}

function onUpdateData(event) {
  let message = JSON.parse(event.data);
  
  if (message.event && message.event === 'connected') {
    const lobbyData = message.lobby;
    onLoadFirstPlayerInfo(lobbyData.users[0]);
    onShowGame();

    if (lobbyData.users.length > 1) {
      onLoadSecondPlayerInfo(lobbyData.users[1]);
    }
  }

  if (message.event && message.event === 'user-connected') {
    onLoadSecondPlayerInfo(message.user);
  }
}

function onShowGame() {
  const lobbyElement = document.querySelector('.lobby');
  const loginElement = document.querySelector('.login');
  loginElement.classList.add('hide');
  lobbyElement.classList.remove('hide');
  lobbyElement.classList.add('show');
}

function onLoadFirstPlayerInfo(info) {
  const firstPlayerElement = document.querySelector('.first-player');
  gerenatePlayerInfoHtml(firstPlayerElement, info);
  //firstPlayerElement.textContent = info.name || 'Anonymous';
}

function onLoadSecondPlayerInfo(info) {
  const secondPlayerElement = document.querySelector('.second-player');
  gerenatePlayerInfoHtml(secondPlayerElement, info);
  //secondPlayerElement.textContent = info.name || 'Anonymous';
}

function gerenatePlayerInfoHtml(domElement, info) {
  let html = `<div>${info.name || 'Anonymous'} <br>
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