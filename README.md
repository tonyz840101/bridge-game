bridge-game  2017.01

I have two roomate when I was a college student. Sometimes, when we want to play bridge, we need to find another person. So I made this bridge game with bots that can be the 4th person and play with us. 

How to run 
  Run the server with nodejs.
  connect to port 5566.
  Press findgame to join a room.
  press add bot if you need one.

It's made up with NodeJs server and a webpage in HTML, Javascript, and CSS. 
Server and client communicate with Socket.IO module, so Socket.IO module will be needed to run the server. 
The webpage receive socket emit from server and change the Page with JQuery.
The game is rendered with HTML canvas.

The bot is not fully functional, it still has some bug in it.
Due to the bot issue, the interface is still simple.

with module:
https://drive.google.com/drive/folders/1TOdWGkGAGCK-pTNYNpX0eAAfvUIdQnnS
