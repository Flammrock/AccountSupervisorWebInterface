// WEB INTERFACE

const Discord = require('discord.js');
const mysql = require("mysql");



const TOKEN = 'NjkzODI1MzM0ODM1MTUwOTE4.Xob0gA.ttUiIXzN_Ez7YcsUySDvoAklyxA';
const DATABASE_URI = process.env.DATABASE_URL;
const DATABASE_PARSE = DATABASE_URI.match(/mysql:\/\/([^:]+):([^@]+)@([^\/]+)\/([^\?]+)\??/);

console.log(DATABASE_PARSE);

const PREFIX = '+';

const DATABASE = {};


function query(guildId,SQL,fn) {
	
	var connection = mysql.createConnection(DATABASE[guildId]);
	connection.connect((err) => {
		if (err) {connection.end();console.log(err);return;};
		if (SQL) {
			connection.query(SQL,(err,rows) => {
				if (err) {console.log(err);connection.end();return;};
				try {
					fn(err,rows);
					connection.end();return;
				} catch (e) {connection.end();console.log(e);return;}
			});
		} else {
			console.log('Mysql: Connected!');
			connection.end();
		}
	});
	connection.on('error', function() {connection.end();});
	
}
function escape_mysql(s) {return s.replace(/'/g,"''");}
function tryConnect(args,callback) {
	var connection = mysql.createConnection({
		host:       args[0],
		user:       args[1],
		password:   args[2],
		database:   args[3]
	});
	connection.connect((err) => {
		if (err) {connection.end();callback(false);return;};
		connection.end();
		callback(true);
	});
	connection.on('error', function() {connection.end();callback(false);});
}
function getDatabaseInfo(bot,guildId,callback) {
	if (typeof DATABASE[guildId]!=='undefined') {callback(0);return;}
	var guild = bot.guilds.cache.find(r=>r.id==guildId);
	if (!guild)  {callback(2);return;}
	var configChannel = guild.channels.cache.find(r=>r.name=='accountsupervisor-database-config');
	configChannel.messages.fetch()
	.then(function(messages){
		messages = messages.filter(m => m.author.id == bot.user.id);
		messages = messages.filter(m => m.content.includes(TOKENINIT));
		messages.each(function(item){
			var m = item.content.match(/HOST: ([^\n]+)\n|USERNAME: ([^\n]+)\n|PASSWORD: ([^\n]+)\n|DATABASE: ([^\n]+)\n/g);
			if (m==null) {
				callback(1);
				return;
			}
			m = m.map(function(m){
				return m.match(/HOST: ([^\n]+)\n|USERNAME: ([^\n]+)\n|PASSWORD: ([^\n]+)\n|DATABASE: ([^\n]+)\n/);
			});
			DATABASE[msg.guild.id+''] = {
				host:       m[0][1],
				user:       m[1][2],
				password:   m[2][3],
				database:   m[3][4]
			};
			tryConnect([m[0][1],m[1][2],m[2][3],m[3][4]],function(r){
				if (!r) {
					callback(1);
					return;
				}
				console.log(`Logged in Remote MySQL Server!`);
				callback(0);
			});
		});
	})
	.catch(function(){
		callback(1);
	});
}


//////////////////////////////////////
//          INTERFACE WEB           //
//////////////////////////////////////

	
const port = process.env.PORT || 80;
var path = require('path');
const url = require('url'); 
var express = require('express');
var session = require('express-session');
const fetch = require('node-fetch');
const btoa = require('btoa');
var app = express();
app.enable('trust proxy');
app.use(session({
	secret: 'b50cb7e9-9a67-406b-8bc3-01d65208e710',
	resave: true,
	name: "accountsupervisorwebinterface",
	proxy : true,
	saveUninitialized: true,
	cookie: {
		secure: true,
		maxAge: 6000000
	}
}));
app.set('view engine', 'ejs');
app.set('views', __dirname);
app.use(express.static(__dirname));





const CLIENT_ID = '693825334835150918';
const CLIENT_SECRET = 'd4Yjr0dIU7XC7miDfUHAagRB7aBztE8d';
const redirect = encodeURIComponent('https://accountsupervisorwebinterface.herokuapp.com/api/discord/callback');

const catchAsync = fn => ((req, res, next) => {
	const routePromise = fn(req, res, next);
	if (routePromise.catch) {
		routePromise.catch(err => next(err));
	}
});

app.get('/api/discord/login', (req, res) => {
  res.redirect(`https://discordapp.com/api/oauth2/authorize?client_id=${CLIENT_ID}&scope=identify%20guilds&response_type=code&redirect_uri=${redirect}`);
});

app.get('/api/discord/callback', catchAsync(async (req, res) => {
	try {
		if (req.session.pathn) {
			if (typeof req.session.pathn === 'string') {
				var path = req.session.pathn;
				req.session.pathn = null;
				delete req.session.pathn;
				req.session.save(function(err) {
					if(!err) {
						res.redirect(path);
					} else {
						res.status(200).send(err.toString());
					}
				});
				return;
			}
		}
		var code = req.query.code;
		var creds = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
		var response = await fetch(`https://discordapp.com/api/oauth2/token?grant_type=authorization_code&code=${code}&redirect_uri=${redirect}`,
		{
			method: 'POST',
			headers: {
				Authorization: `Basic ${creds}`,
			},
		});
		var json = await response.json();
		var response = await fetch(`http://discordapp.com/api/users/@me`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${json.access_token}`,
			},
		});
		var response2 = await fetch(`http://discordapp.com/api/users/@me/guilds`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${json.access_token}`,
			},
		});
		var user = await response.json();
		var guilds = await response2.json();
		user = user || {};
		user.guilds = guilds || {};
		req.session.user = user;
		var path = '/';
		if (req.session.path) {
			if (typeof req.session.path === 'string') path = req.session.path;
			req.session.path = null;
			delete req.session.path;
		}
		req.session.save(function(err) {
			if(!err) {
				res.redirect(path);
			} else {
				res.status(200).send(err.toString());
			}
		});
	} catch(e) {res.status(200).send(e.toString());}
}));


app.get('/api/guild/:guildId/shop/:shopId/item/:itemId/bank/:bankId', (req, res) => {
	try {
	const bot = new Discord.Client();
	bot.on('ready', () => {
	getDatabaseInfo(bot,req.params.guildId,function(err){
	if (!err) {
	if (req.session.user) {
		var bankid = escape_mysql(decodeURIComponent(req.params.bankId));
		var shopid = escape_mysql(decodeURIComponent(req.params.shopId));
		var itemid = escape_mysql(decodeURIComponent(req.params.itemId));
		
			var user = req.session.user;
			var guilds = [];
			bot.guilds.cache.forEach(guild => {
				guilds.push(guild);
			});
			var isin = false;
			for (var i = 0; i < guilds.length; i++) {
				if (guilds[i].id==req.params.guildId) {
					isin = true;
					break;
				}
			}
			if (isin) {
				query(req.params.guildId,'SELECT * FROM shop WHERE name = \''+escape_mysql('name_'+req.params.guildId+'_')+shopid+'\'',function(err,rows){
					if (rows.length==0) {
						res.status(200).send(JSON.stringify({error:3,message:'This Shop doesn\'t exist!'}));
						return;
					} else {
						try {
							var d = JSON.parse(rows[0].data);
							d.web = typeof d.web !== 'undefined' ? d.web : true;
							if (d.web) {
								query(req.params.guildId,'SELECT * FROM items',function(err,rows) {
									if (rows.length!=0) {
										var shopItems = {};
										for (var i = 0; i < rows.length; i++) {
											var data = JSON.parse(rows[i].data);
											for (var j = 0; j < data.shops.length; j++) {
												if (data.shops[j]==shopid) {
													shopItems[escape_mysql(rows[i].name.substring(rows[i].name.indexOf('_')+1).substring(rows[i].name.substring(rows[i].name.indexOf('_')+1).indexOf('_')+1))] = data;
													break;
												}
											}
										}
										if (typeof shopItems[itemid] !== 'undefined') {
											var data = shopItems[itemid];
											query(req.params.guildId,'SELECT * FROM users WHERE name=\''+escape_mysql('name_'+req.params.guildId+'_')+escape_mysql(user.id)+'\'',function(err,rows){
												if (rows.length==0) {
													res.status(200).send(JSON.stringify({error:8,message:'Not Enought Money!'}));
													return;
												}
												var userdata = JSON.parse(rows[0].data);
												userdata.bank = userdata.bank || {};
												if (typeof userdata.bank[bankid] === 'undefined') {
													res.status(200).send(JSON.stringify({error:8,message:'Not Enought Money!'}));
												} else {
													if ((parseFloat(userdata.bank[bankid]) || 0.0) < Math.abs(parseFloat(data.price) || 0.0)) {
														res.status(200).send(JSON.stringify({error:8,message:'Not Enought Money!'}));
													} else {
														userdata.inventory = userdata.inventory || {};
														userdata.inventory.items = userdata.inventory.items || {};
														userdata.inventory.itemstype = userdata.inventory.itemstype || {};
														
														var can = false;
														for (var t = 0; t < d.needWeb.length; t++) {
															for (var p in userdata.inventory.items) {
																if (userdata.inventory.items.hasOwnProperty(p)) {
																	if (p==escape_mysql(d.needWeb[t])) {
																		can = true;
																		break;
																	}
																}
															}
														}
														if (d.needWeb.length==0) can = true;
														var cantype = false;
														for (var t = 0; t < d.needWebType.length; t++) {
															for (var p in userdata.inventory.itemstype) {
																if (userdata.inventory.itemstype.hasOwnProperty(p)) {
																	if (p==d.needWebType[t]) {
																		cantype = true;
																		break;
																	}
																}
															}
														}
														if (d.needWebType.length==0) cantype = true;
																
														if (!can) {
															res.status(200).send(JSON.stringify({error:9,message:'You must have one of this Items: '+d.needWeb.join(', ')}));
															return;
														}
														if (!cantype) {
															res.status(200).send(JSON.stringify({error:9,message:'You must have one of this Type Items: '+d.needWebType.join(', ')}));
															return;
														}
														
														userdata.bank[bankid] = (parseFloat(userdata.bank[bankid]) || 0.0) - Math.abs(parseFloat(data.price) || 0.0);
														if (typeof userdata.inventory.items[itemid] === 'undefined') {
															userdata.inventory.items[itemid] = 1
														} else {
															userdata.inventory.items[itemid] = (parseInt(userdata.inventory.items[itemid]) || 0) + 1;
														}
														query(req.params.guildId,'UPDATE users SET data = \''+escape_mysql(JSON.stringify(userdata))+'\' WHERE name=\''+escape_mysql('name_'+req.params.guildId+'_')+escape_mysql(user.id)+'\'',function(err,rows){
															res.status(200).send(JSON.stringify({success:0,message:user.username+', you have successfully acquired the '+itemid+' item'}));
														});
													}
												}
											})
											
										} else {
											res.status(200).send(JSON.stringify({error:7,message:'This Item is not in this Shop!'}));
										}
									} else {
										res.status(200).send(JSON.stringify({error:6,message:'Not Item in this Shop!'}));
									}
								});
							} else {
								res.status(200).send(JSON.stringify({error:5,message:'This Shop in not a Web Shop!'}));
							}
						} catch (e) {
							res.status(200).send(JSON.stringify({error:4,message:e.toString()}));
						}
					}
				});
			} else {
				res.status(200).send(JSON.stringify({error:2,message:'Bot not in this Server!'}));
			}
		
	} else {
		res.status(200).send(JSON.stringify({error:1,message:'Not Connected!'}));
	}
	} else {
		if (err==1) {
			res.status(200).send(JSON.stringify({error:1,message:'Error When Initialize...Can\'t find configuration in #accountsupervisor-database-config<br />-Please use `'+PREFIX+'init'+'` to reinit the configuration!'}));
		} else {
			res.status(200).send(JSON.stringify({error:1,message:'Sorry, the Bot isn\'t in this server!'}));
		}
	}
	});
	});
	bot.login(TOKEN);
	} catch (e) {console.log(e.toString());}
});

app.get('/guild/:guildId/shop/:shopId', (req, res) => {
	const bot = new Discord.Client();
	bot.on('ready', () => {
	getDatabaseInfo(bot,req.params.guildId,function(err){
	if (!err) {
	if (req.session.user) {
		
			var user = req.session.user;
			var guilds = [];
			bot.guilds.cache.forEach(guild => {
				guilds.push(guild);
			});
			var isin = false;
			var guildname = null;
			for (var i = 0; i < guilds.length; i++) {
				if (guilds[i].id==req.params.guildId) {
					isin = true;
					guildname = guilds[i].name;
					break;
				}
			}
			if (isin) {
				query(req.params.guildId,'SELECT * FROM shop WHERE name = \''+escape_mysql('name_'+req.params.guildId+'_')+escape_mysql(req.params.shopId)+'\'',function(err,rows){
					if (rows.length==0) {
						res.status(200).sendFile(path.join(__dirname, 'noshop.html'));
					} else {
						try {
							var d = JSON.parse(rows[0].data);
							d.web = typeof d.web !== 'undefined' ? d.web : true;
							if (d.web) {
								query(req.params.guildId,'SELECT * FROM items',function(err,rows) {
									if (rows.length==0) {
										res.render('shop.ejs', {
											user: req.session.user,
											shopName: req.params.shopId,
											guildId: req.params.guildId,
											guildName: guildname,
											shopItems: {}
										});
									} else {
										var rows2 = {};
										for (var i = 0; i < rows.length; i++) {
											var data = JSON.parse(rows[i].data);
											for (var j = 0; j < data.shops.length; j++) {
												if (data.shops[j]==req.params.shopId) {
													rows2[rows[i].name.substring(rows[i].name.indexOf('_')+1).substring(rows[i].name.substring(rows[i].name.indexOf('_')+1).indexOf('_')+1)] = data;
													break;
												}
											}
										}
										res.render('shop.ejs', {
											user: req.session.user,
											shopName: req.params.shopId,
											guildId: req.params.guildId,
											guildName: guildname,
											shopItems: rows2
										});
									}
								});
							} else {
								res.status(200).sendFile(path.join(__dirname, 'nowebshop.html'));
							}
						} catch (e) {
							res.status(200).send(e.toString());
						}
					}
				});
			} else {
				var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
				req.session.pathn = fullUrl;
				req.session.save(function(err) {
					if(!err) {
						res.redirect(`https://discordapp.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot&permissions=8&guild_id=${req.params.guildId}&redirect_uri=${redirect}`);
					} else {
						res.status(200).send(err.toString());
					}
				});
			}
		
	} else {
		req.session.path = req.protocol + '://' + req.get('host') + req.originalUrl;
		req.session.save(function(err) {
			if(!err) {
				res.redirect('/');
			} else {
				res.status(200).send(err.toString());
			}
		});
	}
	} else {
		if (err==1) {
			res.status(200).send(JSON.stringify({error:1,message:'Error When Initialize...Can\'t find configuration in #accountsupervisor-database-config<br />-Please use `'+PREFIX+'init'+'` to reinit the configuration!'}));
		} else {
			res.status(200).send(JSON.stringify({error:1,message:'Sorry, the Bot isn\'t in this server!'}));
		}
	}
	});
	});
	bot.login(TOKEN);
});


app.get('/guild/:guildId', (req, res) => {
	if (req.session.user) {
		const bot = new Discord.Client();
		bot.on('ready', () => {
			var user = req.session.user;
			var guilds = [];
			bot.guilds.cache.forEach(guild => {
				guilds.push(guild);
			});
			var isin = false;
			for (var i = 0; i < guilds.length; i++) {
				if (guilds[i].id==req.params.guildId) {
					isin = true;
					break;
				}
			}
			if (isin) {
				res.status(200).send('OK 200');
			} else {
				var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
				req.session.pathn = fullUrl;
				req.session.save(function(err) {
					if(!err) {
						res.redirect(`https://discordapp.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=bot&permissions=8&guild_id=${req.params.guildId}&redirect_uri=${redirect}`);
					} else {
						res.status(200).send(err.toString());
					}
				});
			}
		});
		bot.login(TOKEN);
	} else {
		req.session.path = req.protocol + '://' + req.get('host') + req.originalUrl;
		req.session.save(function(err) {
			if(!err) {
				res.redirect('/');
			} else {
				res.status(200).send(err.toString());
			}
		});
	}
});


app.get('/', catchAsync(async (req, res) => {
	try {
		const bot = new Discord.Client();
		bot.on('ready', () => {
			var guilds = [];
			bot.guilds.cache.forEach(guild => {
				guilds.push({
					id: guild.id,
					name: guild.name,
					icon: guild.icon
				});
			});
			if (req.session.user) {
				res.render('index.ejs', {
					user: req.session.user,
					guilds: guilds
				});
			} else {
				res.status(200).sendFile(path.join(__dirname, 'login.html'));
			}
		});
		bot.login(TOKEN);
	} catch(e) {res.status(200).send(e.toString());}
}));


var server = app.listen(port, function () {
	var host = server.address().address
	var port = server.address().port
	   
	console.log("Example app listening at http://%s:%s", host, port)
});
	




