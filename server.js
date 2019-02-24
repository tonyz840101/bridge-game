const http = require('http')
const url = require('url')
const fs = require('fs')
const io = require('socket.io')

//server
const server = http.createServer((request, response) => {
	let path = url.parse(request.url).pathname;
	let responseError = () => {
		response.writeHead(404)
		response.write('404 - Not Found')
		response.end()
	}
	let responseHTML = (data) => {
		response.writeHead(200, {'Content-Type': 'text/html'})
		response.write(data, 'utf8')
		response.end()
	}
	switch (path) {
		case '/':{
			fs.readFile(__dirname + '/index.html', (error, data)=>{
				if (error){
					responseError()
				} else {
					responseHTML(data)
				}
			})
			break;
		}
		case '/index.html':{
			fs.readFile(__dirname + path, (error, data)=>{
				if (error){
					responseError()
				} else {
					responseHTML(data)
				}
			})
			break;
		}
		case '/poker.min.js':{
			fs.readFile(__dirname + path, (error, data)=>{
				if (error){
					responseError()
				} else {
					responseHTML(data)
				}
			})
			break;
		}
		case '/jquery-1.11.0.min.js':{
			fs.readFile(__dirname + path, (error, data)=>{
				if (error){
					responseError()
				} else {
					responseHTML(data)
				}
			})
			break;
		}
		default:{
			responseError()
			break;
		}
	}
	
})
server.listen(5566);
const serv_io = io.listen(server)
//game data
const namePool = ['Aaron', 'Alexander', 'Bard', 'Billy', 'Carl', 'Colin', 'Daniel', 'David', 'Edgar', 'Elliot', 'Ford', 'Frank', 'Gabe',
	'Geoffrey', 'Harry', 'Harvey', 'Isaac', 'Ivan', 'Jacob', 'John', 'Kevin', 'Kyle', 'Lance', 'Louis', 'Martin', 'Michael',
	'Neil', 'Norton', 'Oscar', 'Owen', 'Parker', 'Pete', 'Quentin', 'Quinn', 'Richard', 'Robin', 'Scott', 'Stanley', 'Thomas',
	'Troy', 'Ulysses', 'Uriah', 'Vladimir', 'Victor', 'Wade', 'Will', 'Xavier', 'Yale', 'York', 'Zachary', 'Zebulon', 'heisenberg']
const playerState = {
	'in_lobby': 0,
	'waiting_to_start': 1,
	'calling_bid': 2,
	'playing': 3,
	'end': 4,
}
const botWaitingTime = 3141//2500
const botReport = false//true
const cardPatternsPic = ['♣', '♦','♥', '♠']
const cardPointsText = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K','A']
let roomList = []
let playerList = []
let roomIdCount = 1
let playerIdCount = 0
/*
in a room, every player will have
{
socketId:
name: 'string',
card: new Array(13),
bidPattern: [false, false, false, false],
patternWithout: [false, false, false, false]
lastTrumpInNormalRound: -1
}
*/
function shuffle(targetList){
	for(let i = targetList.length; i --; ){
		let j = ~~(Math.random() * (i+1))
		let temp = targetList[i]
		targetList[i] = targetList[j]
		targetList[j] = temp
	}
}

function RoomObj(){
	this.roomId = roomIdCount ++ //for socket room
	this.currentState = playerState.waiting_to_start
	this.playerInfo = []
	this.humanPlayerCount = 0//decide whether the room should exist or not
	
	this.passCount = 0
	this.lastCall = {'bid': -1, 'caller': -1}
	this.currentMovingPlayer = 0//index of playerPlayOrder
	this.currentRoundPattern = -1
	this.oneRoundCounter = 0//
	this.cardOnTable = [-1, -1, -1, -1]//for display
	this.cardLaid = [-1, -1, -1, -1]//in the order card is laid
	this.teamScore = [0, 0]//%2 ==0 & ==1 two team
	this.teamGoal = [7, 7]//
	this.cardLeftOfPattern = [13, 13, 13, 13];
	
	this.emitBroadcast = (act, data) => {
		switch(act){
			case 'stateUpdate': {
				data = { 'playerState': this.currentState }
				break
			}
			case 'roomInfo': {
				data = {
					'roomId': this.roomId,
					'currentRoundPattern': this.currentRoundPattern,
					'currentMovingPlayer': this.currentMovingPlayer,
					'teamGoal': this.teamGoal,
					'teamScore': this.teamScore,
					'cardOnTable': this.cardOnTable,
					'cardLaid': this.cardLaid,
					'playerNames': [this.playerInfo[0].name, this.playerInfo[1].name, this.playerInfo[2].name, this.playerInfo[3].name]
				}
				break
			}
		}
		serv_io.to(this.roomId).emit(act, data)
	}
	
	this.getRoomInfo = () => {
		return {
			'roomId': this.roomId,
			'currentRoundPattern': this.currentRoundPattern,
			'currentMovingPlayer': this.currentMovingPlayer,
			'teamGoal': this.teamGoal,
			'teamScore': this.teamScore,
			'cardOnTable': this.cardOnTable,
			'cardLaid': this.cardLaid,
			'playerNames': [this.playerInfo[0].name, this.playerInfo[1].name, this.playerInfo[2].name, this.playerInfo[3].name]
		}
	}
	
	this.emitToPlayer = (index, act, data) => {
		//in this socket.io version, use to(socket_id)
		serv_io.to(this.playerInfo[index].socketId).emit(act, data)
	}
	
	this.initGame = () => {
		shuffle(this.playerInfo)
		let deck = new Array(52)
		for(let card = deck.length; card --; ){
			deck[card] = card
		}
		shuffle(deck)
		for(let i = 4; i --; ){
			for(let j = 13; j --; ){
				this.playerInfo[i].card[j] = deck[i*13+j]
			}
			this.playerInfo[i].card.sort((a, b) => { return a - b })
		}
		//console.log(this.playerInfo)
		this.currentState = playerState.calling_bid
		this.emitBroadcast('stateUpdate', 0)
		this.emitBroadcast('roomInfo', 0)
		this.emitToPlayer(0, 'calling', this.lastCall)
		//this.emitBroadcast('playerInfo', 1)
	}
	
	this.addPlayer = (socket, name, isBot) => {
		let newPlayer = {
			'socketId': socket['id'],
			'name': name,
			'card': new Array(13),
			'bidPattern': [false, false, false, false],
			'patternWithout': [false, false, false, false],//judge by the known info in game
			'lastTrumpInNormalRound': [-1, -1, -1, -1]//record only point
		}
		if(!isBot){
			this.humanPlayerCount ++
			socket.join(this.roomId)
		} else {
			newPlayer.socketId = 'Bot'
		}
		this.playerInfo.push(newPlayer)
		//this.emitBroadcast('player', )  update player number
		if(this.playerInfo.length > 3){
			this.initGame()
			console.log('room '+this.roomId+' start to call bid')
			
			bot(this, this.currentMovingPlayer)//bot part
		}
		
	}
	
	this.playerLeaves = (socket) => {
		let leavingPlayer
		for(let player of this.playerInfo){
			if(player.socketId == socket['id']){
				leavingPlayer = player
				break
			}
		}
		this.emitToPlayer(this.playerInfo.indexOf(leavingPlayer), 'leaveRoom')
		leavingPlayer.socketId = 'Bot'
		leavingPlayer.name += '(Bot)'
		socket.leave(this.roomId)
		this.humanPlayerCount --
		if(!this.humanPlayerCount){
			deleteRoom()
		}
		//emitBroadcast  
	}
	
	this.callBid = (playerSitIndex, bid) => {
		//{'bid': -1, 'caller': -1}
		let currentCall = {'bid': bid, 'caller': playerSitIndex}
		if(currentCall.bid == 'pass'){
			this.passCount ++
			if(this.passCount >= 3){
				console.log('call end')
				//set goal
				if(this.lastCall.caller % 2){
					this.teamGoal[1] = 6 + ~~(this.lastCall.bid/5)
					this.teamGoal[0] = 14 - this.teamGoal[1]
				} else {
					this.teamGoal[0] = 6 + ~~(this.lastCall.bid/5)
					this.teamGoal[1] = 14 - this.teamGoal[0]
				}
				this.currentMovingPlayer = this.lastCall.caller
				console.log('Trump: '+cardPatternsPic[this.lastCall.bid%5])
				console.log('goal set at: '+this.teamGoal)
				console.log('start with P'+this.currentMovingPlayer)
				this.currentState = playerState.playing
				this.emitBroadcast('stateUpdate', 0)
				this.emitBroadcast('roomInfo', 0)
				this.emitToPlayer(this.currentMovingPlayer, 'layingCard', 0)
				bot(this, this.currentMovingPlayer)//bot part
				return
				//start: state playing
			}
		} else {
			this.passCount = 0
			this.lastCall = currentCall
			this.playerInfo[this.currentMovingPlayer].bidPattern[this.lastCall.bid % 5] = true
			console.log('sit '+playerSitIndex+' called: '+callNumToText(bid))
			this.emitBroadcast('playerCallABid', this.lastCall)
		}
		this.currentMovingPlayer ++
		
		
		if(this.currentMovingPlayer == 4) this.currentMovingPlayer = 0
		this.emitBroadcast('roomInfo', 0)
		this.emitToPlayer(this.currentMovingPlayer, 'calling', this.lastCall)
		
		bot(this, this.currentMovingPlayer)//bot part
	}
	
	this.clearTable = () => {
		if(this.currentState != playerState.playing) return
		this.currentRoundPattern = -1
		this.oneRoundCounter = 0
	}
	this.judge = (id, cardPattern, trump) => {
		let sitSample = new Array(4)
		for(let i = 0; i < 4; i ++){
			sitSample[i] = (this.currentMovingPlayer + 1 + i) % 4
		}
		//console.log(sitSample)
		for(let i = 0; i < 4; i ++){
			if(~~(this.cardLaid[i]/13) == trump) this.cardLaid[i] += 100
			else if(~~(this.cardLaid[i]/13) != this.currentRoundPattern) this.cardLaid[i] = -1
		}
		let max = -1
		//console.log(this.cardLaid)
		for(let card of this.cardLaid){
			if(card > max) max = card
		}
		//console.log(this.cardLaid)
		//let winner = (this.cardLaid.indexOf(max) + 4 - (this.currentMovingPlayer + 1))%4
		let winner = sitSample[this.cardLaid.indexOf(max)]
		this.teamScore[winner%2]++
		if(this.teamScore[winner%2] >= this.teamGoal[winner%2]){//game end
			this.emitBroadcast('console', 'Winner is team: '+ (winner%2))
			this.currentState = playerState.end
			this.emitBroadcast('stateUpdate', 0)
			console.log('Room : '+this.roomId+'Winner is team: '+ (winner%2))
		}
		console.log('winner is p'+winner)
		return winner
	}
	
	this.layCard = (playerSitIndex, card, cardId) => {
		if(this.currentMovingPlayer != playerSitIndex) return
		let player = this.playerInfo[this.currentMovingPlayer]
		let cardPattern = ~~(card/13)
		if(!this.oneRoundCounter){
			this.currentRoundPattern = cardPattern
			//console.log('pattern set: '+cardPatternsPic[cardPattern])
			this.cardOnTable = [-1, -1, -1, -1]
		}
		//lay the card
		console.log('p'+this.currentMovingPlayer+' laid'+cardPatternsPic[cardPattern]+cardPointsText[card%13])
		this.cardLaid[this.oneRoundCounter] = card
		this.cardOnTable[this.currentMovingPlayer] = card
		player.card.splice(cardId, 1)
		this.cardLeftOfPattern[cardPattern] --
		//set & record pattern
		if(this.oneRoundCounter){
			if(cardPattern != this.currentRoundPattern){
				player.patternWithout[this.currentRoundPattern] = true
				if((this.lastCall.bid % 5) == cardPattern){
					player.lastTrumpInNormalRound[cardPattern] = card % 13
				}
			}
		}
		this.emitToPlayer(this.currentMovingPlayer, 'getPlayerInfo', 0)
		//if round end
		if(this.oneRoundCounter == 3){
			this.currentMovingPlayer = this.judge(playerSitIndex, cardPattern, this.lastCall.bid %5)
			this.clearTable()
			this.emitToPlayer(this.currentMovingPlayer, 'layingCard', 0)
			this.emitBroadcast('roomInfo', 0)
		} else {//else keep going
			this.oneRoundCounter ++
			this.currentMovingPlayer ++
			if(this.currentMovingPlayer == 4) this.currentMovingPlayer = 0
			this.emitToPlayer(this.currentMovingPlayer, 'layingCard', 0)
			this.emitBroadcast('roomInfo', 0)
			
		}
		
		bot(this, this.currentMovingPlayer)//bot part
	}
	
	this.botCheckGreater = (id, card) => {
		let pattern = ~~(card/13)
		let patternMax = 13 * (pattern + 1)
		for(let i = 1; i < 4; i ++){
			let tmp = this.cardLaid[i]
			if(tmp <= patternMax && tmp > card) return true
		}
		for(let i = 1; i < 4; i ++){
			for(let j = 0; j < this.playerInfo[(id + i) % 4].card.length; j ++){
				//console.log('    '+cardPatternsPic[i]+cardPointsText[this.playerInfo[(id + i) % 4].card[j]%13])
				let tmp = this.playerInfo[(id + i) % 4].card[j]
				if(tmp <= patternMax && tmp > card) return true
			}
		}
		return false
	}
}

function callNumToText(call){//only for display
		if(call == 'pass' || call == -1){
			return 'pass'
		}
		let callPattern = call%5
		let callNum = ~~(call/5)
		let callText = callNum.toString()+' '
		switch(callPattern){
			case 4:{
				callText += 'NT'
				break;
			}
			case 3:{
				callText += '♠'
				break;
			}
			case 2:{
				callText += '♥'
				break;
			}
			case 1:{
				callText += '♦'
				break;
			}
			case 0:{
				callText += '♣'
				break;
			}
			default:
				return false
		}
		return callText
	}

function findEmptyRoom(){
	for	(let room of roomList){
		if (room.playerInfo.length < 4) return room
	}
	let temp = new RoomObj()
	roomList.push(temp)
	return temp
}

function deleteRoom(){
	for	(let i = roomList.length; i--; ){
		if (!roomList[i].humanPlayerCount){
			console.log('delete Room '+roomList[i].roomId)
			roomList.splice(i, 1)
			return
		}
	}
}

function joinRoom(socket, name){
	let room = findEmptyRoom()
	room.addPlayer(socket, name, false)
	return room
}

function botCall(room, id){
	/*
	room.callBid(playerSitIndex, callData)
	socket.emit('callBid', 'pass')
	let call = pattern + callNum*5
	socket.emit('callBid', call)
	5~14 is ok
	*/
	//console.log(room)
	if(room.lastCall.bid != -1){//bot is not smart , so it shouldn't call too high
		if(room.lastCall.bid > 15){
			console.log('	bot' + id + ' passed')
			room.callBid(id, 'pass')
		}
	}
	//scoring
	let pattern = {'count': [0, 0, 0, 0], 'goodCard': [0, 0, 0, 0]}
	let score = [0, 0, 0, 0]
	for(let i = 0; i < 13; i ++){
		let card = room.playerInfo[id].card[i]
		let currentPattern = ~~((card - 1)/ 13)
		pattern.count[currentPattern] ++//count cards
		let cardScore = ((card % 13 - 8 <= 0)? 0 : (card % 13 - 8))//count J Q K A
		score[currentPattern] += cardScore
		if(cardScore){
			pattern.goodCard ++
		}
	}
	for(let i = 0; i < 4; i ++){//if more than 5 cards, bot takes this into consideration
		if(pattern.count[i] > 5) score[i] +=5
	}
	let best = {'score': score[0], 'index': 0}
	for(let i = 1; i < 4; i ++){//find best
		if(score[i] > best.score){
			best.score = score[i]
			best.index = i
		} else if(score[i] == best.score){
			if((pattern.goodCard[i] - pattern.goodCard[best.index]) > 0){
				best.score = score[i]
				best.index = i
			}
		}
	}
	let call = best.index
	if(call < 5) call += 5
	while(call < room.lastCall.bid && call < 10) call += 5 // create call
	if(call > 15 || call <= room.lastCall.bid) call = 'pass'
	if(call != 'pass'){
		let str = callNumToText(call)
		console.log('	bot' + id + ' called: ' + str)
	}
	else{
		console.log('	bot' + id + ' passed')
	}
	room.callBid(id, call)
}

function botPlay(room, id){
	//room.layCard(playerSitIndex, card, cardId)
	console.log('bot play')
	let trump = room.lastCall.bid % 5
	let cardInPattern = [[], [], [], []]
	let len = room.playerInfo[id].card.length
	let printHand = ''
	for(let i = 0; i < len; i ++){//divide card in pattern
		let pattern = ~~(room.playerInfo[id].card[i] / 13)
		//console.log(pattern)
		printHand += (cardPatternsPic[pattern]+cardPointsText[room.playerInfo[id].card[i]%13]+'/ ')
		cardInPattern[pattern].push(room.playerInfo[id].card[i])
		//cardInPattern[pattern][cardInPattern[pattern].length] = room.playerInfo[id].card[i]
	}
	console.log(printHand)
	let result = -1
	switch(room.oneRoundCounter){
		case 0:{
			if(botReport) console.log('card on table: 0')
			//S_01
			if(botReport) console.log('  S_01: start')
			for(let i = 0; i < 4; i ++){
				if(i == trump || !cardInPattern[i].length) continue
				if(room.cardLeftOfPattern[i] > 5 &&
				(!room.playerInfo[(id + 1) % 4].patternWithout[i] && !room.playerInfo[(id + 3) % 4].patternWithout[i])){
					if(botReport) console.log('    trying '+cardPatternsPic[i])
					for(let j = 0; j < cardInPattern[i].length; j ++){
						//if(botReport) console.log('  '+cardPatternsPic[i]+cardPointsText[cardInPattern[i][j]%13])
						//console.log(room.botCheckGreater(id, cardInPattern[i][j]))
						if(!room.botCheckGreater(id, cardInPattern[i][j])){
							result = cardInPattern[i][j]
							break
						}
					}
					if(result == -1){
						if(botReport) console.log('    '+cardPatternsPic[i]+' doesn\'t match')
					} else break
				}
			}
			if(result != -1){
				if(botReport){
					console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
					console.log('  S_01: normal pattern, card left > 5, max card of '+cardPatternsPic[~~(result/13)]+', others all have')
				}
				break
			} else if(botReport) console.log('  S_01: no match')
			//S_02
			if(botReport) console.log('  S_02: start')
			for(let i = 0; i < 4; i ++){
				if(i == trump || !cardInPattern[i].length) continue
				if((!room.playerInfo[(id + 1) % 4].patternWithout[i] && !room.playerInfo[(id + 3) % 4].patternWithout[i]) && room.playerInfo[(id + 2) % 4].patternWithout[i]){
					if(botReport) console.log('    trying '+cardPatternsPic[i])
					if(room.playerInfo[(id + 2) % 4].lastTrumpInNormalRound[i] == -1 || room.playerInfo[(id + 2) % 4].lastTrumpInNormalRound[i] < 6){
						result = cardInPattern[i][0]
						break
					} else {
						if(botReport) console.log('    '+cardPatternsPic[i]+' doesn\'t match')
					}
				}
			}
			if(result != -1){
				if(botReport){
					console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
					console.log('  S_02: normal pattern, enemy have, partner should win with trump')
				}
				break
			} else if(botReport) console.log('  S_02: no match')
			//S_03
			let patternList = []
			for(let i = 0; i < 4; i ++){
				if(i == trump || !cardInPattern[i].length) continue
				if(!room.playerInfo[(id + 1) % 4].patternWithout[i] && !room.playerInfo[(id + 3) % 4].patternWithout[i] && !room.playerInfo[(id + 2) % 4].patternWithout[i]){//
					if(room.playerInfo[(id + 2) % 4].bidPattern[i]){//partner ever called
						patternList.push(i)
					}
				}
			}
			if(patternList.length){
				if(botReport) console.log('  S_03: start')
				let min = 13
				let index = -1
				for(let i = 0; i < patternList.length; i ++){
					if(cardInPattern[patternList[i]][0] % 13 < min){
						min = cardInPattern[patternList[i]][0]
						index = i
					} else if(cardInPattern[patternList[i]][0] % 13 == min){
						if(cardInPattern[patternList[i]].length > cardInPattern[patternList[index]].length){
							min = cardInPattern[patternList[i]][0]
							index = i
						}
					}
				}
				console.log(index)
				result = cardInPattern[patternList[index]][0]
			} else {
				if(botReport) console.log('  S_03: skipped')
			}
			if(result != -1){
				if(botReport){
					console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
					console.log('  S_03: normal pattern, enemy have, partner should win with trump')
				}
				break
			} else if(botReport) console.log('  S_03: no match')
			//S_04
			for(let k = 0; k < 4; k ++){//find any possible max pattern(normal > trump)
				let i = (k + trump + 1) % 4
				if(!cardInPattern[i].length) continue
				let len = cardInPattern[i].length
				for(let j = 0; j < len; j ++){
					if(!room.botCheckGreater(id, cardInPattern[i][j])){
						result = cardInPattern[i][j]
						break
					}
				}
				if(result == -1){
					if(botReport) console.log('    '+cardPatternsPic[i]+' doesn\'t match')
				} else break
			}
			if(result != -1){
				if(botReport){
					console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
					console.log('  S_04: lay possible max card to win (normal pattern > trump)')
				}
				break
			} else if(botReport) console.log('  S_04: no match')
			break
		}		
		case 1:{
			if(botReport) console.log('card on table: 1')
			if(cardInPattern[room.currentRoundPattern].length){//if I have it
				if(botReport) console.log('  S_11: have current pattern')
				let possible = []
				for(let i of cardInPattern[room.currentRoundPattern]){//find possible card to win previous player
					if(i > room.cardLaid[0]){
						possible.push(i)
						break
					}
				}
				if(possible.length){
					if(!room.botCheckGreater(id, possible[possible.length - 1])){
						result = possible[possible.length - 1]
						if(botReport){
							console.log('  S_11-1: try to win with current MAX in '+cardPatternsPic[~~(result/13)])
							console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
						}
					} else if(possible[0] % 13 < 11){
						result = possible[0]
						if(botReport){
							console.log('  S_11-2: try to win with less than Q')
							console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
						}
					}
				} else {
					result = cardInPattern[room.currentRoundPattern][0]
					if(botReport){
						console.log('  S_11-3: throw MIN in '+cardPatternsPic[~~(result/13)])
						console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
					}
				}
			} else {
				if(room.currentRoundPattern != trump){
					if(!room.playerInfo[(id + 1) % 4].patternWithout[room.currentRoundPattern]){
						result = cardInPattern[trump][0]
						if(botReport){
							console.log('  S_12-1: expect win with trump')
							console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
						}
					}
				} else {
					if(botReport) console.log('  S_12: no winning possible')
				}
			}
			break
		}
		case 2:{//current throw an useless card
			if(botReport) console.log('card on table: 2')
			let tmp = new Array(2)
			for(let i = 0; i < 2; i ++){
				if(~~(room.cardLaid[i]/13) == trump) tmp[i] = room.cardLaid[i] + 100
				else if(~~(room.cardLaid[i]/13) != room.currentRoundPattern) tmp[i] = -1
				else tmp[i] = room.cardLaid[i]
			}
			let max = -1
			for(let card of tmp){
				if(card > max) max = card
			}
			let winner = tmp.indexOf(max)
			let currentMax = room.cardLaid[winner]
			//console.log('#####'+winner+' '+currentMax)
			if(cardInPattern[room.currentRoundPattern].length){
				if(botReport) console.log('  S_21: I have card of this pattern')//win max or win just a little
				if(!room.botCheckGreater(id, cardInPattern[room.currentRoundPattern][cardInPattern[room.currentRoundPattern].length - 1])){//try max
					if(botReport) console.log('  S_21-1: able to win with MAX')
					result = cardInPattern[room.currentRoundPattern][cardInPattern[room.currentRoundPattern].length - 1]
					if(botReport){
						console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
					}
				} else {//try to win a little
					if(winner){//partner 0 loses => winner == 1
						if(botReport) console.log('  S_21-2: partner loses')
						for(let i of cardInPattern[room.currentRoundPattern]){
							if(i > currentMax){
								result = i
								break
							}
						}
						if(result != -1){
							if(botReport){
								console.log('  S_21-2.1: win a little bit')
								console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
							}
						} else {
							result = cardInPattern[room.currentRoundPattern][0]
							if(botReport){
								console.log('  S_21-2.2: can\'t win, lay MIN')
								console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
							}
						}
					} else {//partner 0 wins do logic of patternWithout
						if(botReport) console.log('  S_21-3: partner wins')
						let nextId = (id + 1) % 4
						if(room.playerInfo[nextId].patternWithout[room.currentRoundPattern]){
						//next player don't have current pattern, then I can do nothing no matter what
							result = cardInPattern[room.currentRoundPattern][0]
							if(botReport){
								console.log('  S_21-3.1: next player don\'t have card of this pattern, lay MIN whatever')
								console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
							}
						} else {
							if((currentMax%13) < 8){//currentMax is small
								if(botReport) console.log('  S_22-1: currentMax is small, force next player lay a card >9')
								for(let i of cardInPattern[room.currentRoundPattern]){
									if(i > currentMax){
										result = i
										break
									}
								}
								if(result != -1){
									if(botReport){
										console.log('  S_22-1.1: forced, win a little bit')
										console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
									}
								} else {
									result = cardInPattern[room.currentRoundPattern][0]
									if(botReport){
										console.log('  S_22-1.2: can\'t win, lay MIN')
										console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
									}
								}
							} else {
								result = cardInPattern[room.currentRoundPattern][0]
								if(botReport){
									console.log('  S_21-3.1: next player don\'t have card of this pattern, lay MIN whatever')
									console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
								}
							}
						}
						
						if(botReport){
							console.log('  S_21-3: can\'t win, lay MIN')
							console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
						}
					}
				}
				//if(!room.playerInfo[id].patternWithout[room.currentRoundPattern])
				
			} else {
				if(botReport) console.log('  S_22: I don\'t have card of this pattern')
				if(cardInPattern[trump].length){
					result = cardInPattern[trump][0]
					if(botReport){
						console.log('  S_22-1: try trump')
						console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
					}
				} else {
					if(botReport){
						console.log('  S_22-2: don\'t have trump')
						console.log('    will throw useless')
					}
					//throw useless
				}
			}
			/*
			not yet 
				maybe check the without_pattern, check_greater,
			*/
			break
		}
		case 3:{
			if(botReport) console.log('card on table: 3')
			let tmp = new Array(3)
			for(let i = 0; i < 3; i ++){
				if(~~(room.cardLaid[i]/13) == trump) tmp[i] = room.cardLaid[i] + 100
				else if(~~(room.cardLaid[i]/13) != room.currentRoundPattern) tmp[i] = -1
				else tmp[i] = room.cardLaid[i]
			}
			let max = -1
			for(let card of tmp){
				if(card > max) max = card
			}
			//console.log('#####'+tmp+' '+max)
			let winner = tmp.indexOf(max)
			let currentMax = room.cardLaid[winner]
			//console.log('#####'+winner+' '+currentMax)
			if(cardInPattern[room.currentRoundPattern].length){//have
				if(botReport) console.log('  S_31: I have card of this pattern')
				if(winner == 1){//we win
					result = cardInPattern[room.currentRoundPattern][0]
					if(botReport){
						console.log('  S_31-1: we are winning, relax and pick MIN')
						console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
					}
				} else {//we lose
					if(botReport) console.log('  S_31-2: we are losing, try to win')
					for(let i of cardInPattern[room.currentRoundPattern]){
						if(i > currentMax){
							result = i
							break
						}
					}
					if(result != -1){//looking for solution
						if(botReport){
							console.log('  S_31-2: win solution match')
							console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
						}
					} else {
						result = cardInPattern[room.currentRoundPattern][0]
						if(botReport){
							console.log('  S_31-2: no match, pick MIN')
							console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
						}
					}
				}
			} else {//without
				if(room.currentRoundPattern == trump){//can't do a thing
					if(botReport){
						console.log('  S_32-1: trump, I don\' have, who\'s winning is meanless')
						console.log('    will throw useless')
					}
				} else {// try trump
					if(winner == 1){//do nothing
						if(botReport){
							console.log('  S_32-2: normal pattern, I don\'t have, partner winning')
							console.log('    will throw useless')
						}
					} else {//try
						if(!room.playerInfo[id].patternWithout[trump]){//I have trump
							if(botReport){
								console.log('  S_32-3: normal pattern, I don\'t have, partner losing, i have trump')
							}
							if(~~(currentMax/13) == trump){
								for(let i of cardInPattern[trump]){
									if(i > currentMax){
										result = i
										break
									}
								}
								if(result != -1){
									if(botReport){
										console.log('  S_32-3.1: my trump will win')
										console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
									}
								} else {
									if(botReport){
										console.log('  S_32-3.1: my trump can\'t win')
										console.log('    will throw useless')
									}
								}
							} else {
								result = cardInPattern[trump][0]
								if(result != -1){
									if(botReport){
										console.log('  S_32-3.2: trump beat normal')
										console.log('    find  '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
									}
								} else {
									if(botReport){
										console.log('  S_32-3.2: should\'t happen')
									}
								}
							}
						} else {//can't do a thing
							if(botReport){
								console.log('  S_32-4: normal pattern, I don\'t have, partner losing, i don\'t have trump')
								console.log('    will throw useless')
							}
						}
					}
				}
			}
			break
		}
	}
	if(result == -1){//throw useless part
		if(botReport) console.log('  S_X1: useless 1')
		if(room.currentRoundPattern != -1){
			//console.log(cardPatternsPic[room.currentRoundPattern])
			//console.log(cardInPattern)
			if(cardInPattern[room.currentRoundPattern].length){
				result = cardInPattern[room.currentRoundPattern][0]
			}
		} else if(botReport) console.log('  S_X1: without pattern')
		let min = 13
		let index = -1
		let patternChoice = []
		if(result == -1) {
			console.log('  S_X2: useless 2')
			for(let k = 0; k < 4; k ++){
				let i = (trump + k + 1) % 4
				if(i == trump && patternChoice.length){
					break
				}
				if(cardInPattern[i].length) patternChoice.push(i)
			}
			//console.log(patternChoice)
			for(let i = 0; i < patternChoice.length; i ++){
				let currentPoint = cardInPattern[patternChoice[i]][0] % 13
				if(currentPoint < min){
					min = currentPoint
					index = i
				} else if(currentPoint == min){
					if(cardInPattern[patternChoice[i]].length > cardInPattern[patternChoice[index]].length){
						min = currentPoint
						index = i
					}
				}
			}
			result = cardInPattern[patternChoice[index]][0]
		}
	} 
	
	if(botReport){
		console.log('bot' + id + ' laying: '+cardPatternsPic[~~(result/13)]+cardPointsText[result%13])
		console.log('')
	}
	room.layCard(id, result, room.playerInfo[id].card.indexOf(result))
}

function bot(room, id){
	//console.log('bot')
	if(room.playerInfo[id].socketId != 'Bot'){
		return
	}
	//console.log('Room '+room.roomId+' bot at ' + id);
	if(botReport){
		console.log('')
		console.log('bot:'+room.playerInfo[id].name+' at ' + id)
	}
	switch(room.currentState){
		case playerState.calling_bid:{
			setTimeout( (room, id) => {
				botCall(room, id)
			}, botWaitingTime, room, id)
			break;
		}
		case playerState.playing:{
			setTimeout( (room, id) => {
				botPlay(room, id)
			}, botWaitingTime, room, id)
			break;
		}
		default:{
			break;
		}
	}
}

serv_io.sockets.on('connection', (socket) => {
	let playerId = playerIdCount ++
	let room
	let name
	let playerSitIndex = -1
	socket.emit('init')
	//console.log('init')
	
	function init(){
		room = 0
		playerSitIndex = -1
	}
	
	socket.on('initDone', (msg) => {
		//console.log('asking...')
		socket.emit('askName', {'playerId': playerId})
	})
	
	socket.on('addUser', (msg) => {
		//console.log('addUser...')
		name = msg
	})
	
	socket.on('findGame', () => {
		//console.log('finding...')
		room = joinRoom(socket, name)
	})
	
	socket.on('addBot', () => {
		if(!room) return
		if(room.playerInfo.length > 3) return
		//console.log('addBot...')
		let botName =  namePool[~~(Math.random() * 52)]
		room.addPlayer('Bot', botName, true)
	})
	
	socket.on('callBid', (callData) => {
		room.callBid(playerSitIndex, callData)
	})
		
	socket.on('getPlayerInfo', () => {
		//console.log('getPlayerInfo')
		if(playerSitIndex == -1){
			for(let i = 0; i < 4; i++){
				if(room.playerInfo[i].socketId == socket['id']){
					playerSitIndex = i
				}
			}
		}
		socket.emit('playerInfo', {'playerInfo': room.playerInfo[playerSitIndex], 'playerSitIndex': playerSitIndex})
	})
	
	socket.on('layCard', (card) => {
		let cardId = room.playerInfo[playerSitIndex].card.indexOf(card)
		if(room.playerInfo[playerSitIndex].card.indexOf(card) == -1){
			socket.emit('console','You can\'t lay this card!')
			return
		} else {
			room.layCard(playerSitIndex, card, cardId)
			/*let id = (playerSitIndex + 1) % 4
			if(room.playerInfo[id].socketId == 'bot'){//bot part
				bot(room, id)
				//bot(room, id)
			}*/
		}
	})
	
	socket.on('leave', () => {
		room.playerLeaves(socket)
		init()
	})
	
	socket.on('test', () => {
	})
	
	socket.on('disconnect', () => {
		if(room){
			room.playerLeaves(socket)
		}
		//console.log(name + " left.")
	})
	
})