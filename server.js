var http = require("http");
var url = require('url');
var fs = require('fs');
var io = require('socket.io');

var player_count = 0;
var display_message = "wait";
var player = [];
var lobby = [];
var room = [];
var room_ctr = 1;
var name_pool = ['Aaron', 'Alexander', 'Bard', 'Billy', 'Carl', 'Colin', 'Daniel', 'David', 'Edgar', 'Elliot', 'Ford', 'Frank', 'Gabe',
	'Geoffrey', 'Harry', 'Harvey', 'Isaac', 'Ivan', 'Jacob', 'John', 'Kevin', 'Kyle', 'Lance', 'Louis', 'Martin', 'Michael',
	'Neil', 'Norton', 'Oscar', 'Owen', 'Parker', 'Pete', 'Quentin', 'Quinn', 'Richard', 'Robin', 'Scott', 'Stanley', 'Thomas',
	'Troy', 'Ulysses', 'Uriah', 'Vladimir', 'Victor', 'Wade', 'Will', 'Xavier', 'Yale', 'York', 'Zachary', 'Zebulon', 'heisenberg']
var BOT_talking = true;
var pass_count = 0; 
var state = 0;
var player_sit = [];
var player_cards= new Array(4);
var target = 0;
var target_color = 0;
var target_count = 0;
var table_card = new Array(4);
var bid = [];
var teams = new Array(2);
var goals = new Array(2);
var on_table = [-1, -1, -1, -1];
var bot_wait = 2500;

function findPlayer(id){
	for(ctr_2 = 0; ctr_2<player.length; ctr_2++)
		if(player[ctr_2].s_id == id) return ctr_2;
	return -1;
}

function findPlayer2(id){
	for(ctr_2 = 0; ctr_2<player.length; ctr_2++)
		if(player[ctr_2].player_id == id) return ctr_2;
	return -1;
}

function findRoom(id){
	for(ctr_2 = 0; ctr_2<room.length; ctr_2++)
		if(room[ctr_2].roomID == id) return ctr_2;
	return -1;
}

var server = http.createServer(function(request, response) {
	console.log('Connection');
	var path = url.parse(request.url).pathname;

	switch (path) {
		case '/':
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.write('Hello, World.');
			response.end();
			break;
		case '/index.html':
			fs.readFile(__dirname + path, function(error, data) {
				if (error){
					response.writeHead(404);
					response.write("opps this doesn't exist - 404");
				}
				else {
					response.writeHead(200, {"Content-Type": "text/html"});
					response.write(data, "utf8");
				}
				response.end();
			});
			break;
		case '/poker.min.js':
			fs.readFile(__dirname + path, function(error, data) {
				if (error){
					response.writeHead(404);
					response.write("opps this doesn't exist - 404");
				}
				else {
					response.writeHead(200, {"Content-Type": "text/html"});
					response.write(data, "utf8");
				}
				response.end();
			});
			break
		case '/jquery-1.11.0.min.js':
			fs.readFile(__dirname + path, function(error, data) {
				if (error){
					response.writeHead(404);
					response.write("opps this doesn't exist - 404");
				}
				else {
					response.writeHead(200, {"Content-Type": "text/html"});
					response.write(data, "utf8");
				}
				response.end();
			});
			break
		default:
			response.writeHead(404);
			response.write("opps this doesn't exist - 404");
			response.end();
			break;
	}
});

server.listen(5566);

function shuffle(ob) {
	for (var i = ob.length; i > 0; i --) {
        var j = Math.floor(Math.random() * i);
		var tmp = ob[i - 1];
        ob[i - 1] = ob[j];
		ob[j] = tmp;
    }
}

function Newroom(){
	var room_obj = {
		'player_count': 0,
		'roomID': 0,
		'pass_count': 0, 
		'state': 0,
		'player_sit': [],
		'player_cards': new Array(4),
		'player_names': [],
		'target': 0,
		'target_color': 0,
		'target_count': 0,
		'table_card': new Array(4),
		'bid': [0, 0],
		'teams': [0, 0],
		'goals': [7, 7],
		'on_table': [-1, -1, -1, -1],
		'player_less_color': [[false, false, false, false], [false, false, false, false], [false, false, false, false], [false, false, false, false]],
		'color_left': [13, 13, 13, 13],
		'dismiss': 0,
		'bidList':[[], [], [], []],
		'feed_last_king': [-1, -1, -1, -1],
		'king_tracer': false
	};
	for(var i = 0; i < 4; i ++) room_obj.player_cards[i]= new Array(13);
	var new_rid = room.length;
	room[new_rid] = room_obj;
	room[new_rid].roomID = room_ctr;
	room_ctr ++;
	return room[new_rid].roomID;
}

function Emptyroom(){
	for(var i = 0; i < room.length; i ++){
		if(room[i].player_count < 4) return room[i].roomID;
	}
	return -1;
}

function leaveRoom(socket, rid, player_id){
	socket.leave(room[rid].roomID);
	if(room[rid].state > 0 && room[rid].state != 3){
		room[rid].state = 5;
		serv_io.to(room[rid].roomID).emit('alert', 'Your Game has been dismissed!');
		serv_io.to(room[rid].roomID).emit('init', 1);
	}
	else{
		room[rid].player_sit.splice(room[rid].player_sit.indexOf(player_id), 1);
		room[rid].player_count --;
		room[rid].dismiss --;
		if(!room[rid].dismiss){
			console.log('delete room ' + room[rid].roomID);
			room.splice(rid, 1);
		}
	}
}
var serv_io = io.listen(server); // 開啟 Socket.IO 的 listener

function bid_parser(call) {
		if(call == -1) return {'str': 'P', 'color': '#000000'};
		var result = {'str': '', 'color': '#000000'}
		var num = Math.floor(call / 5) + 1;
		var str;
		switch(call % 5){
			case 0: str="♣ ";	break;
			case 1: str="♦ ";	result.color = '#ff0000';	break;
			case 2: str="♥ ";	result.color = '#ff0000';	break;
			case 3: str="♠ ";	break;
			case 4: str="NK";	break;
		}
		result.str = str + num.toString();
		return result;
	}


function brocasting(roomID) {
	if(roomID != -1){
		var rid = findRoom(roomID);//room[rid].
		if(room[rid].state > 0 && room[rid].state < 3){
			serv_io.to(roomID).emit('message', "Start in room "+roomID);
		}
		serv_io.to(roomID).emit('get_data', {
			'state': room[rid].state,
			'roomID': roomID,
			//'display_message': display_message,
			'player_cards': room[rid].player_cards,
			'player_sit': room[rid].player_sit,
			'teams': room[rid].teams,
			'goals': room[rid].goals,
			'on_table': room[rid].on_table,
			'moving': room[rid].target,
			'current_call': room[rid].bid[1],
			'player_names': room[rid].player_names,
		});
	}
}
	
function printCard(card){
	if(card == -1) return 'error';
	var str = '';
	switch(Math.floor((card - 1) / 13)){
		case 0: str = "♣ ";	break;
		case 1: str = "♦ ";	break;
		case 2: str = "♥ ";	break;
		case 3: str = "♠ ";	break;
	}
	switch((card - 1) % 13){
		case 12: str += "A";	break;
		case 11: str += "K";	break;
		case 10: str += "Q";	break;
		case 9: str += "J";		break;
		default:
			str += ((card - 1) % 13 + 2);
			break;
	}
	return str;
}

function printColor(color){
	switch(color){
		case 0: return "♣ ";	break;
		case 1: return "♦ ";	break;
		case 2: return "♥ ";	break;
		case 3: return "♠ ";	break;
	}
	return false;
}
	
function game_judge(data, rid, roomID, player_sit_index){
	if(data.player_id != room[rid].player_sit[room[rid].target]) return -1;
	switch(room[rid].state){
		case 1:
			if(data.user_data == "pass"){
				room[rid].pass_count ++;
				if(room[rid].pass_count >= 3){
					var t = room[rid].target % 2;
					room[rid].target = room[rid].bid[0] + 1;
					if(room[rid].target == 4) room[rid].target = 0;
					room[rid].goals[t] = 6 + Math.floor((room[rid].bid[1] - 1) / 5 + 1);
					room[rid].goals[(t + 1) % 2] = 14 - room[rid].goals[t] ;
					room[rid].state = 2;
					console.log('Room ' + room[rid].roomID + ' set goal at ' + room[rid].goals);
				}
				else{
					room[rid].target ++;
					if(room[rid].target == 4) room[rid].target = 0;
				}
			}
			else {
				room[rid].bid[0] = room[rid].target;
				room[rid].bid[1] = parseInt(data.user_data);
				if(((room[rid].bid[1] - 1) % 5 != 4) && (!room[rid].bidList[room[rid].target].length || room[rid].bidList[room[rid].target].indexOf((room[rid].bid[1] - 1) % 5) == -1)) room[rid].bidList[room[rid].target][room[rid].bidList[room[rid].target].length] = (room[rid].bid[1] - 1) % 5;
				room[rid].pass_count = 0;
				room[rid].target ++;
				if(room[rid].target == 4) room[rid].target = 0;
			}
			break;
		case 2:
			var card = Number(data.user_data);
			var card_color = Math.floor((card - 1) / 13) + 1;
			var king_color = (room[rid].bid[1] - 1) % 5 + 1;
			var index = room[rid].player_cards[player_sit_index].indexOf(card);
			if(index != -1){
				if(room[rid].target_count == 0 || card_color == room[rid].target_color){
					if(room[rid].target_count == 0){
						if(room[rid].player_sit[room[rid].target] != 'BOT') room[rid].king_tracer = false;
						room[rid].on_table = [-1, -1, -1, -1];
						room[rid].target_color = card_color;
						console.log(room[rid].player_less_color);
						//display_message = "Player " + data.player_id + " throw out " + card;
					}
					//else 
						//display_message += "\nPlayer " + data.player_id + " throw out " + card;
					
					room[rid].table_card[room[rid].target_count ++] = card;
					room[rid].color_left[card_color - 1] --;
					room[rid].player_cards[player_sit_index][index] = -1;
					room[rid].on_table[player_sit_index] = card;
					
					if(room[rid].target_count < 4){
						room[rid].target ++;
						if(room[rid].target == 4) room[rid].target = 0;
						//display_message += "\nIs Player " + room[rid].player_sit[room[rid].target] + " turn";
					}
				}
				else {
					var error = false;
					for(var i = 1; i <= 13; i ++){
						if(room[rid].player_cards[player_sit_index].indexOf(i + (room[rid].target_color - 1) * 13) != -1){
							error = true;
							break;
						}
					}
					if(error) return -1;
					if(!room[rid].player_less_color[player_sit_index][card_color - 1]) room[rid].player_less_color[player_sit_index][card_color - 1] = true;
					if(room[rid].king_tracer && room[rid].target_count == 3 && card_color == king_color){
						room[rid].feed_last_king[player_sit_index] = (card - 1) % 13 + 1;
						console.log('king traced: ' + printCard(card));
					}
					else if(card_color == king_color && room[rid].target_color != king_color){
						room[rid].feed_last_king[player_sit_index] = (card - 1) % 13 + 1;
						console.log('king recorded: ' + printCard(card));
					}
					//display_message += "\nPlayer " + data.player_id + " throw out " + card;
					room[rid].table_card[room[rid].target_count ++] = card;
					room[rid].color_left[card_color - 1] --;
					room[rid].player_cards[player_sit_index][index] = -1;
					room[rid].on_table[player_sit_index] = card;
					
					if(room[rid].target_count < 4){
						room[rid].target ++;
						if(room[rid].target == 4) room[rid].target = 0;
						//display_message += "\nIs Player " + room[rid].player_sit[room[rid].target] + " turn";
					}
					
				}
				if(room[rid].target_count >= 4){
					var winner = 0, win_scroce = 0, scroce = 0;
					
					for(var i = 0; i < 4; i ++){
						scroce = 0; 
						room[rid].target ++;
						if(room[rid].target == 4) room[rid].target = 0;
						if(Math.floor((room[rid].table_card[i] - 1) / 13) + 1 == king_color) scroce =  ((room[rid].table_card[i] - 1) % 13 + 1) * 100;
						else if(Math.floor((room[rid].table_card[i] - 1) / 13) + 1 == room[rid].target_color) scroce =  ((room[rid].table_card[i] - 1) % 13 + 1) * 10;
						else scroce = 0;
						if(scroce > win_scroce){
							winner = room[rid].target;
							win_scroce = scroce;
						}
					}
					room[rid].teams[player_sit_index % 2] ++;
					if(room[rid].teams[room[rid].target % 2] == room[rid].goals[room[rid].target % 2]){
						brocasting(roomID);
						if(room[rid].player_sit.indexOf(winner) % 2) serv_io.to(roomID).emit('over', {'winner': 1});
						else serv_io.to(roomID).emit('over', {'winner': 0});
						room[rid].state = 3;
						break;
					}								
					//display_message = "This round winner is Player "+room[rid].player_sit[winner - 1];
					room[rid].target = winner;
					//display_message += "\nIs Player " + room[rid].player_sit[room[rid].target]+ " turn";
					room[rid].target_count = 0;
				}
			}
			else return -1;
			break;
		default:
			return -1;
			break;
	}
	//console.log(roomID);
	brocasting(roomID);
}

function BOT_check_greater(rid, player_sit_index, card){//check if there is any greater card of the color on others' hand
	var color = Math.floor((card - 1) / 13);
	var up_limit = (color + 1) * 13;
	
	for(var i = 1; i < 4; i ++){
		for(var j = 0; j < 13; j ++){
			var tmp = room[rid].player_cards[(player_sit_index + i) % 4][j];
			if(tmp <= up_limit && tmp > card) return true;
		}
	}
	return false;
}
/////////////////////////////////////////////////////////////////////////////////
function Bot_play(rid, roomID, player_sit_index){
	var val;
	console.log('bot' + player_sit_index);

	//console.log(room[rid].player_cards[player_sit_index]);
	switch(room[rid].state){
		case 1:
			if(room[rid].bid[1])
				if(room[rid].bid[1] >= 11 ||　room[rid].bid[0] == player_sit_index){
					val = 'pass';
					console.log('bot' + player_sit_index + ' passed');
					game_judge({'player_id': 'BOT', 'user_data': val}, rid, roomID, player_sit_index);
					return;
				}
			var color = [[0, 0, 0, 0], [0, 0, 0, 0]];
			var point = [0, 0, 0, 0];
			for(var i = 0; i < 13; i ++){//scanning
				var card = room[rid].player_cards[player_sit_index][i];
				color[0][Math.floor((card - 1)/ 13)] ++;
				var card_point = (((card - 1) % 13 - 8 <= 0)? 0 : ((card - 1) % 13 - 8))
				point[Math.floor((card - 1)/ 13)] += card_point;
				if(card_point)
					color[1][Math.floor((card - 1)/ 13)] ++;
			}
			for(var i = 0; i < 4; i ++)
				if(color[i] > 5) point[i] += 5;
			var best = point[0], best_index = 0;
			for(var i = 1; i < 4; i ++){
				if(point[i] > best){
					best= point[i];
					best_index = i;
				}
				else if(point[i] == best){
					if((color[0][i] - color[1][i]) > (color[0][best_index] - color[1][best_index])){
						best= point[i];
						best_index = i;
					}
				}
			}
			val = best_index + 1;
			while(val < room[rid].bid[1] && val < 11) val += 5;
			if(val >= 11 || val == room[rid].bid[1]) val = 'pass';
			if(val != 'pass'){
				var str = bid_parser(val - 1);
				console.log('bot' + player_sit_index + ' called ' + str.str);
			}
			else console.log('bot' + player_sit_index + ' passed');
			game_judge({'player_id': 'BOT', 'user_data': val}, rid, roomID, player_sit_index);
			break;
		case 2:
			/*for(var i = 0; i < 13; i ++){
				if(room[rid].player_cards[player_sit_index][i] != -1)console.log(printCard(room[rid].player_cards[player_sit_index][i]));
			}*/
			var king_color = (room[rid].bid[1] - 1) % 5 + 1;
			var card_class = [[], [], [], []];
			for(var i = 0; i < 13; i ++){//scanning
				if(room[rid].player_cards[player_sit_index][i] != -1){
					var color = Math.floor((room[rid].player_cards[player_sit_index][i] - 1)/ 13);
					card_class[color][card_class[color].length] = room[rid].player_cards[player_sit_index][i];
				}
			}
			for(var i = 0; i < 4; i ++){
				var str_list = [];
				for(var j = 0; j < card_class[i].length; j ++){
					str_list[str_list.length] = printCard(card_class[i][j]);
				}
				console.log(str_list);
			}
			switch(room[rid].target_count){
				case 0://no cards on desk, starting a new round					
					console.log('in case 0: there is no card on the table');
					val = -1;
					for(var i = 0; i < 4; i ++){
						if(i != king_color - 1 && room[rid].color_left[i] > 5 && card_class[i].length && !room[rid].player_less_color[(player_sit_index + 1) % 4][king_color - 1] && !room[rid].player_less_color[(player_sit_index + 3) % 4][king_color - 1]){
							console.log('	' + printColor(i) + 'matches rule 1, try to win this round with ' + printColor(i));
							for(var j = 0; j < card_class[i].length; j ++){
								if(!BOT_check_greater(rid, player_sit_index, card_class[i][j])){
									val = card_class[i][j];
									break;
								}
							}
						}
						if(val != -1) break;
					}
					if(val != -1) break;
					else console.log('	 No match for rule 1');
					for(var i = 0; i < 4; i ++){
						if(card_class[i].length && i != king_color - 1 && !room[rid].player_less_color[(player_sit_index + 1) % 4][king_color - 1] && room[rid].player_less_color[(player_sit_index + 2) % 4][king_color - 1]  && !room[rid].player_less_color[(player_sit_index + 3) % 4][king_color - 1]){
							console.log('	' + printColor(i) + 'matches rule 2, try to feed partner, expecting partner to win with king color');
							if(room[rid].feed_last_king[(player_sit_index + 2) % 4] == -1 || room[rid].feed_last_king[(player_sit_index + 2) % 4] < 6){
								val = card_class[king_color - 1];
								console.log('	feeding partner');
							}
						}
					}
					if(val != -1) break;
					else console.log('	 No match for rule 2');
					var ok_list = [];
					for(var i = 0; i < 4; i ++){
					//room[rid].bidList[room[rid].(player_sit_index + 2) % 4].indexOf(i) != -1
						if(card_class[i].length && i != king_color - 1 && !room[rid].player_less_color[(player_sit_index + 1) % 4][king_color - 1] && !room[rid].player_less_color[(player_sit_index + 3) % 4][king_color - 1] && room[rid].bidList[(player_sit_index + 2) % 4].indexOf(i) != -1) ok_list[ok_list.length] = i;
					}
					if(ok_list.length){
						var smallest = 13, index = -1;
						for(var i = 0; i < ok_list.length; i ++){
							if(i == 0)console.log('');
							console.log(printColor(ok_list[i]) + ' ');
							if(i == ok_list.length - 1) console.log('matches rule 3, try to feed partner, expecting partner to win with one of these color');

							if((card_class[ok_list[i]][0] - 1) % 13 + 1 < smallest){
								smallest = (card_class[ok_list[i]][0] - 1) % 13 + 1;
								index = i;
							}
							else if((card_class[ok_list[i]][0] - 1) % 13 + 1 == smallest){
								if(card_class[ok_list[i]].length > card_class[ok_list[index]].length){
									smallest = (card_class[ok_list[i]][0] - 1) % 13 + 1;
									index = i;
								}
							}
						}			
						val = card_class[ok_list[index]][0];
					}
					else console.log('	partner call nothing at bidding state');
					if(val != -1) break;
					else console.log('	 No match for rule 3');
					for(var i = 0; i < 4; i ++){
						if(i != king_color - 1 && card_class[i].length){
							console.log('	' + printColor(i) + 'matches rule 4, try to win this round with ' + printColor(i));
							for(var j = 0; j < card_class[i].length; j ++){
								if(!BOT_check_greater(rid, player_sit_index, card_class[i][j])){
									val = card_class[i][j];
									break;
								}
							}
						}
						if(val != -1) break;
					}
					if(val != -1) break;
					else console.log('	 No match for rule 4');
					if(card_class[king_color - 1].length){
						console.log('	' + printColor(king_color - 1) + 'matches rule 6, try to win this round with king color');
						for(var j = 0; j < card_class[king_color - 1].length; j ++){////bug
							if(!BOT_check_greater(rid, player_sit_index, card_class[king_color - 1][j])){
								val = card_class[king_color - 1][j];
								break;
							}
						}
					}
					if(val != -1) break;
					else console.log('	 No match for rule 6');
					console.log('	 throw a useless card');
					var smallest = 14, index = -1;
					var choice = [];
					for(var i = 0; i < 4; i ++){//list all choice
						if(i == king_color - 1) i ++;
						if(i == 4) break;
						if(card_class[i].length) choice[choice.length] = i;
					}
					if(!choice.length){
						console.log('	 No other card, try king color');
						choice[choice.length] = king_color - 1;
					}
					for(var i = 0; i < choice.length; i ++){
						if((card_class[choice[i]][0] - 1) % 13 + 1 % 13 < smallest){////bug
							smallest = (card_class[choice[i]][0] - 1) % 13 + 1;
							index = i;
						}
						else if((card_class[choice[i]][0] - 1) % 13 + 1 == smallest){
							if(card_class[choice[i]].length > card_class[choice[index]].length){
								smallest = (card_class[choice[i]][0] - 1) % 13 + 1;
								index = i;
							}
						}
					}
					val = card_class[choice[index]][0];
					break;
				case 1://1 cards on desk					
					console.log('in case 1: there is 1 card on the table');
					var throw_useless = false;
					if(card_class[room[rid].target_color - 1].length){//king_color
						console.log('	try to win with target color');
						if(room[rid].target_color == king_color){
							var try_this_card = card_class[king_color - 1][card_class[king_color - 1].length - 1];
							if(try_this_card > room[rid].table_card[0]){
								console.log('	measuring the king color cards');
								var win_card = [];
								for(var i = 0; i < card_class[king_color - 1].length; i ++){
									if(card_class[king_color - 1][i] > room[rid].table_card[0]){
										win_card[win_card.length] = card_class[king_color - 1][i];
									}
								}
								if((win_card[0] - 1) % 13 + 1 < 11){
									console.log('	winning with less than Q is possible');
									val = win_card[0];
								}
								else{
									console.log('	winning with less than Q is not possible');
									for(var i = 0; i < win_card.length; i ++){
										if(win_card[i] - room[rid].table_card[0] < 4){
											val = win_card[i];
										}
									}
									if(val == -1){
										val = card_class[king_color - 1][0];
										console.log('	failed: bot\'s cards of king color is not sutible');	
									}
								}
							}
							else{
								console.log('	failed: bot\'s cards of target color is not big enough');
								val = card_class[king_color - 1][0];
							}
						}
						else{
							var try_this_card = card_class[room[rid].target_color - 1][card_class[room[rid].target_color - 1].length - 1];
							console.log(!room[rid].player_less_color[(player_sit_index + 1) % 4][target_color - 1]);
							console.log(try_this_card > room[rid].table_card[0]);
							console.log(!BOT_check_greater(rid, player_sit_index, try_this_card));
							if(!room[rid].player_less_color[(player_sit_index + 1) % 4][target_color - 1] && try_this_card > room[rid].table_card[0] && !BOT_check_greater(rid, player_sit_index, try_this_card)
							){
								val = try_this_card;
							}
							else{////bug
								console.log('	failed: enemy is less on target color');
								val = card_class[room[rid].target_color - 1][0];
							}
						}
					}
					else{
						console.log('	bot don\'t have target color');
						console.log('	try to win with king color');
						if(room[rid].target_color == king_color){
							console.log('	failed: king color is target color');
							throw_useless = true;
						}
						else{
							if(card_class[king_color - 1].length){
								if((card_class[king_color - 1][0] - 1) % 13 + 1 < 9){
									val = card_class[king_color - 1][0];
								}
								else{
									console.log('	failed: bot\'s cards of king color may probabaly be won by enemy');
									throw_useless = true;
								}
							}
							else{
								console.log('	failed: bot don\'t have king color');
								throw_useless = true;
							}
						}
					}
					
					if(throw_useless){
						var smallest = 14, index = -1;
						var choice = [];
						for(var i = 0; i < 4; i ++){//list all choice
							if(i == king_color - 1) i ++;
							if(i == 4) break;
							if(card_class[i].length) choice[choice.length] = i;
						}
						if(!choice.length){
							console.log('	 No other card, try king color');
							choice[choice.length] = king_color - 1;
						}
						for(var i = 0; i < choice.length; i ++){
							if((card_class[choice[i]][0] - 1) % 13 + 1 < smallest){
								smallest = (card_class[choice[i]][0] - 1) % 13 + 1;
								index = i;
							}
							else if((card_class[choice[i]][0] - 1) % 13 + 1 == smallest){
								if(card_class[choice[i]].length > card_class[choice[index]].length){
									smallest = (card_class[choice[i]][0] - 1) % 13 + 1;
									index = i;
								}
							}
						}
						val = card_class[choice[index]][0];//
					}
					break;
				case 2://2 cards on desk  
					console.log('in case 2: there are 2 cards on the table');
					console.log('	throw any card');
					if(card_class[room[rid].target_color - 1].length) val = card_class[room[rid].target_color - 1][0];
					else{
						var smallest = 14, index = -1;
						var choice = [];
						for(var i = 0; i < 4; i ++){//list all choice
							if(i == king_color - 1) i ++;
							if(i == 4) break;
							if(card_class[i].length) choice[choice.length] = i;
						}
						if(!choice.length){
							console.log('	 No other card, try king color');
							choice[choice.length] = king_color - 1;
						}
						for(var i = 0; i < choice.length; i ++){
							if((card_class[choice[i]][0] - 1) % 13 + 1 < smallest){
								smallest = (card_class[choice[i]][0] - 1) % 13 + 1;
								index = i;
							}
							else if((card_class[choice[i]][0] - 1) % 13 + 1 == smallest){
								if(card_class[choice[i]].length > card_class[choice[index]].length){
									smallest = (card_class[choice[i]][0] - 1) % 13 + 1;
									index = i;
								}
							}
						}
						val = card_class[choice[index]][0];
					}
					break;
				case 3://3 cards on desk
					console.log('in case 3: there are 3 cards on the table');
					var winner = 0, win_scroce = 0, scroce = 0, target = player_sit_index, winner_index = 0;
					var throw_useless = false;
					for(var i = 0; i < 3; i ++){//checking who is winning
						scroce = 0; 
						target ++;
						if(target == 4) target = 0;
						if(Math.floor((room[rid].table_card[i] - 1) / 13) + 1 == king_color) scroce =  ((room[rid].table_card[i] - 1) % 13 + 1) * 100;
						else if(Math.floor((room[rid].table_card[i] - 1) / 13) + 1 == room[rid].target_color) scroce =  ((room[rid].table_card[i] - 1) % 13 + 1) * 10;
						else scroce = 0;
						if(scroce > win_scroce){
							winner_index = i;
							winner = target;
							win_scroce = scroce;
						}
					}
					if(winner % 2 == player_sit_index % 2){//partner win the round
						console.log('	partner win');
						if(card_class[room[rid].target_color - 1].length){//bot has this color
							val = card_class[room[rid].target_color - 1][0];//pick the smallest
							console.log('	smallest of target color');
						}
						else {//bot don't have this color
							console.log('	smallest among the rest');
							throw_useless = true;
						}
					}
					else{//try to win this round
						console.log('	enemy win: try to win this round');
						var winner_card = room[rid].table_card[winner_index];
						var winner_card_color = Math.floor((room[rid].table_card[winner_index] - 1) / 13) + 1;
						
						if(card_class[room[rid].target_color - 1].length){//bot has this color	
							console.log('	try to win with target color');
							var card = card_class[room[rid].target_color - 1][card_class[room[rid].target_color - 1].length - 1];
							if(winner_card_color == king_color && room[rid].target_color != king_color){
								console.log('	failed: enemy is winning with king color');
								val = card_class[room[rid].target_color - 1][0];//pick the smallest
							}
							else if(card < winner_card){//if the largest card of this color is smaller than winner_card
								console.log('	failed: bot\'s cards of target color is not big enough');
								val = card_class[room[rid].target_color - 1][0];//pick the smallest
							}
							else{
								card = -1;
								for(var i = 0; i < card_class[king_color - 1].length; i ++){//find a card to win//bug!!!!
									card = card_class[room[rid].target_color - 1][i];
									if(card > winner_card){
										console.log('	found the smallest card that can win this round: ' + printCard(card));
										val = card;
										break;
									}
								}
								if(card == -1){
									console.log('	failed: unknown error');
									val = card_class[room[rid].target_color - 1][0];//or pick the smallest
								}
							}
						}
						else{//bot don't have this color
							console.log('	bot don\'t have target color');
							console.log('	try to win with king color');
							if(room[rid].target_color == king_color){
								console.log('	failed: king color is target color');
								throw_useless = true;
							}
							else if(winner_card_color == king_color){//enemy win with king color
								console.log('	enemy is winning with king color');
								if(card_class[king_color - 1].length){//Bot has king color
									console.log('	find a king color larger than enemy');
									if(card_class[king_color - 1][card_class[king_color - 1].length - 1] > winner_card)//try to win with king color
										for(var i = 0; i < card_class[king_color - 1].length; i ++){
											if(card_class[king_color - 1][i] > winner_card){
												val = card_class[king_color - 1][i];
												console.log('	found the smallest king card that can win this round: ' + printCard(val));
												break;
											}
										}
									else{//failed to win with king color
										console.log('	failed: bot\'s cards of king color is not big enough');
										throw_useless = true;
									}
								}
								else{
									console.log('	failed: bot don\'t have king color');
									throw_useless = true;
								}
							}
							else{//enemy win with target color
								console.log('	enemy is winning with target color');
								if(card_class[king_color - 1].length){
									val = card_class[king_color - 1][0];
								}
								else{
									console.log('	failed: bot don\'t have king color');
									throw_useless = true;
								}
							}
						}
					}
					
					if(throw_useless){
						var smallest = 14, index = -1;
						var choice = [];
						for(var i = 0; i < 4; i ++){//list all choice
							if(i == king_color - 1) i ++;
							if(i == 4) break;
							if(card_class[i].length) choice[choice.length] = i;
						}
						if(!choice.length){
							console.log('	 No other card, try king color');
							choice[choice.length] = king_color - 1;
						}
						for(var i = 0; i < choice.length; i ++){
							if((card_class[choice[i]][0] - 1) % 13 + 1 < smallest){
								smallest = (card_class[choice[i]][0] - 1) % 13 + 1;
								index = i;
							}
							else if((card_class[choice[i]][0] - 1) % 13 + 1 == smallest){
								if(card_class[choice[i]].length > card_class[choice[index]].length){
									smallest = (card_class[choice[i]][0] - 1) % 13 + 1;
									index = i;
								}
							}
						}
						val = card_class[choice[index]][0];
					}
					break;
				default:
					break;
			}
			console.log('bot' + player_sit_index + ' picked: ' + printCard(val));
			game_judge({'player_id': 'BOT', 'user_data': val}, rid, roomID, player_sit_index);
				//if(!BOT_check_greater(rid, player_sit_index, card));
				
			/*for(var i = 0; i < 13; i ++){
				var card = room[rid].player_cards[player_sit_index][i];
				var result = -1;
				console.log(card + ' ' + i);
				if(card != -1){
					console.log('bot' + player_sit_index + ' trying' + printCard(card));
					result = game_judge({'player_id': 'BOT', 'user_data': card}, rid, roomID, player_sit_index);
					if(result != -1){
						console.log('bot' + player_sit_index + ' card: ' + printCard(card));
						break;
					}
				}
			}*/
			break;
		default:
			break;
	}
}
/////////////////////////////////////////////////////////////////////////////////
serv_io.sockets.on('connection', function(socket) {
	socket.emit('player_id', {'player_id': ++player_count, 'state': 0, 'display_message': display_message});
	var player_id = player_count;
	var roomID = -1;
	var player_sit_index = -1;
	
	socket.on('add user',function(msg){
		socket.username = msg;
		console.log("new user: "+msg+" logged " + socket['id']);
		player[player.length] = {'s_id': socket['id'], 'player_id': player_id, 'p_name': msg};
		//update userlist
		var userlist = [];
		for(var ctr_1 = 0; ctr_1 < player.length; ctr_1 ++)
			userlist[userlist.length] = player[ctr_1].p_name;
		serv_io.emit('userlist', {'userlist': userlist});
	});
	
	socket.on('init',function(){
		roomID = -1;
		player_sit_index = -1;
	});
	
	function timeoutBot(){
		if(roomID == -1) return;
		var rid = findRoom(roomID);
		//console.log(rid);
		Bot_play(rid, roomID, room[rid].target);
		if(room[rid].player_sit[room[rid].target] == 'BOT' && room[rid].state < 3) setTimeout(function(){ timeoutBot(); }, bot_wait);
	}
	
	socket.on('FindGame',function(){
		if(roomID != -1) return;
		console.log("Finding for " + socket.username + ' ' + socket['id']);
		lobby[lobby.length] = socket['id'];
		socket.emit('message', "Finding...");
		var pid = findPlayer(socket['id']);
		if(room.length){
			roomID = Emptyroom();
			if(roomID == -1) roomID = Newroom();
		}
		else {
			roomID = Newroom();
		}
		
		socket.join(roomID);
		var rid = findRoom(roomID);//room[rid].
		room[rid].player_sit[room[rid].player_sit.length] = player_id;
		room[rid].player_count ++;
		room[rid].dismiss ++;
		if(room[rid].player_count == 4){
			console.log('A game start in room ' + roomID);
			serv_io.to(roomID).emit('message', "Start in room " + roomID);
			var cards = [];
			for(var i = 0; i < 52; i ++) cards[i] = i + 1;
			shuffle(cards);
			for(var i = 0; i < 13; i ++)
				room[rid].player_cards[0][i] = cards[i];
			for(var i = 13; i < 26; i++)
				room[rid].player_cards[1][i - 13] = cards[i];
			for(var i = 26; i < 39; i ++)
				room[rid].player_cards[2][i - 26] = cards[i];
			for(var i = 39; i < 52; i ++)
				room[rid].player_cards[3][i - 39] = cards[i];
			
			for(var i = 0; i < 4; i ++)
				room[rid].player_cards[i].sort(function(a, b){ return a - b; });
			
			shuffle(room[rid].player_sit);
			room[rid].state = 1;
			room[rid].target = Math.floor((Math.random() * 4));
			for(var i = 0; i < 4; i ++){
				if(room[rid].player_sit[i] != 'BOT'){
					room[rid].player_names[i] = player[findPlayer2(room[rid].player_sit[i])].p_name;
				}
				else {
					room[rid].player_names[i] = name_pool[Math.floor(Math.random() * 52)];
				}
			}
			console.log(room[rid].player_names);
			brocasting(roomID);
			
			if(room[rid].player_sit[room[rid].target] == 'BOT') setTimeout(function(){ timeoutBot(); }, bot_wait);
			//while(room[rid].player_sit[room[rid].target] == 'BOT') setTimeout(function(rid, roomID){ Bot_play(rid, roomID, room[rid].target); }, 3000);
			//while(room[rid].player_sit[room[rid].target] == 'BOT') Bot_play(rid, roomID, room[rid].target);
			//if(room[rid].player_sit[room[rid].target - 1] == room[rid].player_id) socket.emit('call', {'current_call': 0});
		}
	});
	
	socket.on('BotAdd',function(){
		var rid = findRoom(roomID);//room[rid].
		room[rid].player_sit[room[rid].player_sit.length] = 'BOT';
		room[rid].player_count ++;
		if(room[rid].player_count == 4){
			console.log('A game start in room ' + roomID);
			serv_io.to(roomID).emit('message', "Start in room " + roomID);
			var cards = [];
			for(var i = 0; i < 52; i ++) cards[i] = i + 1;
			shuffle(cards);
			for(var i = 0; i < 13; i ++)
				room[rid].player_cards[0][i] = cards[i];
			for(var i = 13; i < 26; i++)
				room[rid].player_cards[1][i - 13] = cards[i];
			for(var i = 26; i < 39; i ++)
				room[rid].player_cards[2][i - 26] = cards[i];
			for(var i = 39; i < 52; i ++)
				room[rid].player_cards[3][i - 39] = cards[i];
			
			for(var i = 0; i < 4; i ++)
				room[rid].player_cards[i].sort(function(a, b){ return a - b; });
			
			shuffle(room[rid].player_sit);
			room[rid].state = 1;
			room[rid].target = Math.floor((Math.random() * 4));
			for(var i = 0; i < 4; i ++){
				if(room[rid].player_sit[i] != 'BOT'){
					room[rid].player_names[i] = player[findPlayer2(room[rid].player_sit[i])].p_name;
				}
				else {
					room[rid].player_names[i] = name_pool[Math.floor(Math.random() * 52)];
				}
			}
			console.log(room[rid].player_names);
			brocasting(roomID);
			
			if(room[rid].player_sit[room[rid].target] == 'BOT') setTimeout(function(){ timeoutBot(); }, bot_wait);
			//while(room[rid].player_sit[room[rid].target] == 'BOT') setTimeout(function(rid, roomID){ Bot_play(rid, roomID, room[rid].target); }, 3000);
		}
	});
	
	socket.on('EXIT',function(){
		var rid = findRoom(roomID);//room[rid].room[roomID].player_sit.length
		leaveRoom(socket, rid, player_id);
		//socket.leave(roomID);
		socket.emit('init', 1);
	});
	
	
	socket.on('user_data', function(data) {
		var rid = findRoom(roomID);//room[rid].
		if(player_sit_index == -1)
			player_sit_index = room[rid].player_sit.indexOf(player_id);
		game_judge(data, rid, roomID, player_sit_index);
		//while(room[rid].player_sit[room[rid].target] == 'BOT') Bot_play(rid, roomID, room[rid].target);
		if(room[rid].player_sit[room[rid].target] == 'BOT' && room[rid].state < 3) setTimeout(function(){ timeoutBot(); }, bot_wait);
		//while(room[rid].player_sit[room[rid].target] == 'BOT' && room[rid].state < 3) setTimeout(function(rid, roomID){ Bot_play(rid, roomID, room[rid].target); }, 3000);
	});
	
	//left
	socket.on('disconnect',function(){
		var tmp = findPlayer(socket['id']);
		if(tmp != -1)
			player.splice(tmp,1);
		if(roomID != -1){
			var rid = findRoom(roomID);//room[rid].
			leaveRoom(socket, rid, player_id);
			//socket.leave(roomID);
		}
		
		var userlist = [];
		for(var ctr_1 = 0; ctr_1 < player.length; ctr_1 ++)
			userlist[userlist.length] = player[ctr_1].p_name;
		serv_io.emit('userlist', {'userlist': userlist});
		console.log(socket.username+" left.");
	});
});