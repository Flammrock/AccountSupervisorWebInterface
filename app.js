// WEB INTERFACE

const Discord = require('discord.js');
const mysql = require("mysql");
const bot = new Discord.Client();


const TOKEN = 'NjkzODI1MzM0ODM1MTUwOTE4.XoC3CQ.meL6PnRHcv91pS2xnyRytJ3oiZE';
const DATABASE_URI = process.env.DATABASE_URL;
const DATABASE_PARSE = DATABASE_URI.match(/mysql:\/\/([^:]+):([^@]+)@([^\/]+)\/([^\?]+)\??/);

console.log(DATABASE_PARSE);

const PREFIX = '+';

const DATABASE = {
	host:       DATABASE_PARSE[3],
	user:       DATABASE_PARSE[1],
	password:   DATABASE_PARSE[2],
	database:   DATABASE_PARSE[4]
};


function query(SQL,fn) {
	
	var connection = mysql.createConnection(DATABASE);
	connection.connect((err) => {
		if (err) {connection.end();return;};
		if (SQL) {
			connection.query(SQL,(err,rows) => {
				if (err) {console.log(err);connection.end();return;};
				try {
					fn(err,rows);
					connection.end();return;
				} catch (e) {connection.end();return;}
			});
		} else {
			console.log('Mysql: Connected!');
			connection.end();
		}
	});
	connection.on('error', function() {connection.end();});
	
}
function escape_mysql(s) {return s.replace(/'/g,"''");}
query();

/*
connection.query(`CREATE TABLE users (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(50),
  data text,
  PRIMARY KEY (id)
) DEFAULT CHARSET=utf8 AUTO_INCREMENT=0;`, (err,rows) => {
  if(err) throw err;

  console.log('TABLE CREATED!');
});*/
/*
connection.query(`CREATE TABLE bank (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(50),
  data text,
  PRIMARY KEY (id)
) DEFAULT CHARSET=utf8 AUTO_INCREMENT=0;`, (err,rows) => {
  if(err) throw err;

  console.log('TABLE CREATED!');
});*/


//////////////////////////////////////
//           COMMAND BOT            //
//////////////////////////////////////
class Command {
	
	constructor(name,_fn) {
		this.name = name || '';
		this._fn = _fn || function(){};
		Command.List[this.name] = this;
	}
	
	static isExist(name) {
		return typeof Command.List[name] !== 'undefined';
	}
	
	static execute(msg,data) {
		Command.List[data.name]._fn(msg,data.args);
	}
	
	
}
Command.List = {};

class ParserCommand {
	
	constructor(data) {
		this.rawdata = data || '';
		this.parse();
	}
	
	parse() {
		this.name = "";
		this.args = [];
		var i1 = this.rawdata.indexOf(' ');
		if (i1 > 0) {
			this.name = this.rawdata.substring(1,i1);
			this.args = this.rawdata.substring(i1+1).match(/"[^"]*"|[^ ]+/g);
			if (this.args == null) this.args = [];
		} else {
			this.name = this.rawdata.substring(1);
		}
	}
	
}



// ADMIN
new Command('ping', function(msg,args) {
	if (!msg.member.roles.find(r => r.name === "BankAdmin") && !msg.member.hasPermission("ADMINISTRATOR")) {
		msg.delete(0);
		msg.author.send('Sorry, you don\'t have the permissions :cold_sweat:\nAnd i\'ve decided to delete your message.');
		return;
    }
	msg.channel.send('pong');
});



// BANK

// ADMIN
new Command('bank_create', function(msg,args) {
	if (args.length < 2) return;
	// ARGS :
	//    - Bank Name
	//    - Amount Money On First Registration
	query('SELECT * FROM bank WHERE name=\''+escape_mysql(args[0])+'\'',function(err,rows){
		if (rows.length > 0) {
			msg.reply('Sorry, `'+args[0]+'` Bank is already created :cold_sweat:');
			return;
		}
		query('INSERT INTO bank(name,data) VALUES (\''+escape_mysql(args[0])+'\',\''+escape_mysql(args[1])+'\')',function(err,rows){
			msg.reply('`'+args[0]+'` Bank created with success!');
		});
	});
});
// ADMIN
new Command('bank_delete', function(msg,args) {
	if (args.length < 1) return;
	// ARGS :
	//     - Bank Name
	query('SELECT * FROM bank WHERE name=\''+escape_mysql(args[0])+'\'',function(err,rows){
		if (rows.length==0) {
			msg.reply('Sorry, Bank `'+args[0]+'` doesn\'t exist :cold_sweat:');
			return;
		}
		query('DELETE FROM bank WHERE name=\''+escape_mysql(args[0])+'\'',function(err,rows){
			msg.reply('`'+args[0]+'` Bank deleted with success!');
		});
		query('SELECT * FROM users',function(err,rows){
			for (var i = 0; i < rows.length; i++) {
				try {
					var data = JSON.parse(rows[i].data);
					if (typeof data.bank !== 'undefined') {
						if (typeof data.bank[escape_mysql(args[0])] !== 'undefined') {
							data.bank[escape_mysql(args[0])] = null;
							delete data.bank[escape_mysql(args[0])];
							query('UPDATE users SET data = \''+escape_mysql(JSON.stringify(data))+'\' WHERE name=\''+escape_mysql(rows[i].name)+'\'',function(err,rows){});
						}
					}
				} catch (e) {}
			}
		});
	});
});
// ADMIN
new Command('bank_add_user', function(msg,args) {
	if (args.length < 2) return;
	// ARGS :
	//     - Bank Name
	//     - User ID
	var id = args[1].match(/<@!?(\d+)>/);
	if (id==null) {
		msg.reply('Sorry, User '+args[1]+' doesn\'t exist :cold_sweat:\nPlease use the `@` to select a user :smile:');
		return;
	}
	id = id[1];
	query('SELECT * FROM bank WHERE name=\''+escape_mysql(args[0])+'\'',function(err,rows1){
		if (rows1.length==0) {
			msg.reply('Sorry, Bank `'+args[0]+'` doesn\'t exist :cold_sweat:');
			return;
		}
		query('SELECT * FROM users WHERE name=\''+escape_mysql(id)+'\'',function(err,rows){
			if (rows.length==0) {
				var obj = {
					bank: {}
				};
				try {
					obj.bank[escape_mysql(args[0])] = parseFloat(JSON.parse(rows1[0].data).moneyOnStart) || 0.0;
				} catch (e) {
					obj.bank[escape_mysql(args[0])] = 0.0;
				}
				query('INSERT INTO users(name,data) VALUES (\''+escape_mysql(id)+'\',\''+escape_mysql(JSON.stringify(obj))+'\')',function(err,rows){
					msg.reply('User '+args[1]+' added in `'+args[0]+'` Bank with Success!');
				});
			} else {
				var obj = JSON.parse(rows[0].data);
				obj.bank = obj.bank || {};
				try {
					if (typeof obj.bank[escape_mysql(args[0])] !== 'undefined') {
						 obj.bank[escape_mysql(args[0])] = (parseFloat(obj.bank[escape_mysql(args[0])]) || 0.0) + (parseFloat(JSON.parse(rows1[0].data).moneyOnStart) || 0.0);
					} else {
						obj.bank[escape_mysql(args[0])] = parseFloat(JSON.parse(rows1[0].data).moneyOnStart) || 0.0;
					}
				} catch (e) {
					obj.bank[escape_mysql(args[0])] = 0.0;
				}
				query('UPDATE users SET data = \''+escape_mysql(JSON.stringify(obj))+'\' WHERE name=\''+escape_mysql(id)+'\'',function(err,rows){
					msg.reply('User '+args[1]+' added in `'+args[0]+'` Bank with Success!');
				});
			}
		});
	});
});
// ADMIN
new Command('bank_remove_user', function(msg,args) {
	if (args.length < 2) return;
	// ARGS :
	//     - Bank Name
	//     - User ID
	var id = args[1].match(/<@!?(\d+)>/);
	if (id==null) {
		msg.reply('Sorry, User '+args[1]+' doesn\'t exist :cold_sweat:\nPlease use the `@` to select a user :smile:');
		return;
	}
	id = id[1];
	query('SELECT * FROM bank WHERE name=\''+escape_mysql(args[0])+'\'',function(err,rows1){
		if (rows1.length==0) {
			msg.reply('Sorry, `'+args[0]+'` Bank doesn\'t exist :cold_sweat:');
			return;
		}
		query('SELECT * FROM users WHERE name=\''+escape_mysql(id)+'\'',function(err,rows){
			if (rows.length > 0) {
				var obj = JSON.parse(rows[0].data);
				obj.bank = obj.bank || {};
				try {
					if (typeof obj.bank[escape_mysql(args[0])] !== 'undefined') {
						obj.bank[escape_mysql(args[0])] = null;
						delete obj.bank[escape_mysql(args[0])];
					}
				} catch (e) {}
				query('UPDATE users SET data = \''+escape_mysql(JSON.stringify(obj))+'\' WHERE name=\''+escape_mysql(id)+'\'',function(err,rows){
					msg.reply('User '+args[1]+' removed in `'+args[0]+'` Bank with Success!');
				});
			}
		});
	});
});
// ADMIN
new Command('bank_give_money_user', function(msg,args,t) {
	if (args.length < 3) return;
	// ARGS :
	//     - Bank Name
	//     - User ID
	//     - Amount Money
	var id = args[1].match(/<@!?(\d+)>/);
	if (id==null) {
		msg.reply('Sorry, User '+args[1]+' doesn\'t exist :cold_sweat:\nPlease use the `@` to select a user :smile:');
		return;
	}
	id = id[1];
	var f = function() {
		msg.reply('`'+((typeof t !== 'undefined')?(parseFloat(args[2])||0.0):Math.abs((parseFloat(args[2])||0.0)))+'` Money '+((typeof t !== 'undefined')?'set':(parseFloat(args[2]) || 0.0)<0?'removed':'added')+' to the '+args[1]+'\'s account in the `'+args[0]+'` Bank with Success!');	
	}
	query('SELECT * FROM bank WHERE name=\''+escape_mysql(args[0])+'\'',function(err,rows1){
		if (rows1.length==0) {
			msg.reply('Sorry, `'+args[0]+'` Bank doesn\'t exist :cold_sweat:');
			return;
		}
		query('SELECT * FROM users WHERE name=\''+escape_mysql(id)+'\'',function(err,rows){
			if (rows.length > 0) {
				var obj = JSON.parse(rows[0].data);
				obj.bank = obj.bank || {};
				try {
					if (typeof obj.bank[escape_mysql(args[0])] !== 'undefined' && typeof t === 'undefined') {
						obj.bank[escape_mysql(args[0])] = (parseFloat(obj.bank[escape_mysql(args[0])]) || 0.0) + (parseFloat(args[2]) || 0.0);
					} else {
						obj.bank[escape_mysql(args[0])] = parseFloat(args[2]) || 0.0;
					}
				} catch (e) {
					obj.bank[escape_mysql(args[0])] = parseFloat(args[2]) || 0.0;
				}
				query('UPDATE users SET data = \''+escape_mysql(JSON.stringify(obj))+'\' WHERE name=\''+escape_mysql(id)+'\'',function(err,rows){
					f();
				});
			} else {
				var obj = {bank:{}};
				obj.bank[escape_mysql(args[0])] = (parseFloat(args[2]) || 0.0);
				query('INSERT INTO users(name,data) VALUES (\''+escape_mysql(id)+'\',\''+escape_mysql(JSON.stringify(obj))+'\')',function(err,rows){
					f();
				});
			}
		});
	});
});
// ADMIN
new Command('bank_remove_money_user', function(msg,args) {
	if (args.length < 3) return;
	// ARGS :
	//     - Bank Name
	//     - User ID
	//     - Amount Money
	args[2] = (parseFloat(args[2]) || 0.0)*-1;
	Command.List['bank_give_money_user']._fn(msg,args);
});
// ADMIN
new Command('bank_set_money_user', function(msg,args) {
	if (args.length < 3) return;
	// ARGS :
	//     - Bank Name
	//     - User ID
	//     - Amount Money
	Command.List['bank_give_money_user']._fn(msg,args,true);
});
// ADMIN
new Command('bank_get_money_user', function(msg,args) {
	if (args.length < 2) return;
	// ARGS :
	//     - Bank Name
	//     - User ID
	var id = args[1].match(/<@!?(\d+)>/);
	if (id==null) {
		msg.reply('Sorry, User '+args[1]+' doesn\'t exist :cold_sweat:\nPlease use the `@` to select a user :smile:');
		return;
	}
	id = id[1];
	query('SELECT * FROM bank WHERE name=\''+escape_mysql(args[0])+'\'',function(err,rows1){
		if (rows1.length==0) {
			msg.reply('Sorry, `'+args[0]+'` Bank doesn\'t exist :cold_sweat:');
			return;
		}
		query('SELECT * FROM users WHERE name=\''+escape_mysql(id)+'\'',function(err,rows){
			if (rows.length > 0) {
				var obj = JSON.parse(rows[0].data);
				obj.bank = obj.bank || {};
				try {
					if (typeof obj.bank[escape_mysql(args[0])] !== 'undefined') {
						msg.reply('User '+args[1]+' have `'+obj.bank[escape_mysql(args[0])]+'` Money Left in his `'+args[0]+'` Bank account!');
						return;
					} else {}
				} catch (e) {}
			}
			msg.reply('User '+args[1]+' don\'t have a `'+args[0]+'` Bank account!');
		});
	});
});

// CITOYEN
new Command('give_money', function(msg,args) {
	if (args.length < 4) return;
	// ARGS :
	//     - Bank Name
	//     - User ID
	//     - User Bank Name
	//     - Amount Money
	var id_currentuser = msg.member.user.id+'';
	var id_user = args[1].match(/<@!?(\d+)>/);
	if (id_user==null) {
		msg.reply('Sorry, User '+args[1]+' doesn\'t exist :cold_sweat:\nPlease use the `@` to select a user :smile:');
		return;
	}
	id_user = id_user[1];
	if (id_currentuser == id_user) {
		msg.reply('Sorry, you can\'t give yourself your own money :upside_down:');
		return;
	}
	query('SELECT * FROM bank WHERE name=\''+escape_mysql(args[0])+'\'',function(err,rows1){
		if (rows1.length==0) {
			msg.reply('Sorry, `'+args[0]+'` Bank  doesn\'t exist :cold_sweat:');
			return;
		}
		query('SELECT * FROM users WHERE name=\''+escape_mysql(id_currentuser)+'\'',function(err,rowsu){
			if (rowsu.length > 0) {
				var obju = JSON.parse(rowsu[0].data);
				obju.bank = obju.bank || {};
				if (typeof obju.bank[escape_mysql(args[0])] !== 'undefined') {
					if ((parseFloat(obju.bank[escape_mysql(args[0])])||0) < Math.abs((parseFloat(args[3])||0))) {
						msg.reply('Sorry, you don\'t have enought money in your `'+args[0]+'` Bank account!');
						return;
					}
					query('SELECT * FROM users WHERE name=\''+escape_mysql(id_user)+'\'',function(err,rows){
						if (rows.length > 0) {
							var obj = JSON.parse(rows[0].data);
							obj.bank = obj.bank || {};
							if (typeof obj.bank[escape_mysql(args[2])] !== 'undefined') {
								obju.bank[escape_mysql(args[0])] = (parseFloat(obju.bank[escape_mysql(args[0])])||0) - Math.abs((parseFloat(args[3])||0));
								obj.bank[escape_mysql(args[2])] = (parseFloat(obj.bank[escape_mysql(args[2])])||0) + Math.abs((parseFloat(args[3])||0));
								query('UPDATE users SET data = \''+escape_mysql(JSON.stringify(obju))+'\' WHERE name=\''+escape_mysql(id_currentuser)+'\'',function(err,rows){
									query('UPDATE users SET data = \''+escape_mysql(JSON.stringify(obj))+'\' WHERE name=\''+escape_mysql(id_user)+'\'',function(err,rows){
										msg.reply('You give `'+args[3]+'` Money to '+args[1]+'!\n{ <@'+id_currentuser+'>\'s `'+args[0]+'` Bank account ----> '+args[1]+'\'s `'+args[2]+'` Bank account }');
									});
								});
								return;
							}
						}
						msg.reply('Sorry, '+args[1]+' don\'t have a `'+args[0]+'` Bank account!');
					});
					return;
				}
			}
			msg.reply('Sorry, you don\'t have a `'+args[0]+'` Bank account!');
		});
	});
});
// CITOYEN
new Command('bank_create_account', function(msg,args) {
	if (args.length < 1) return;
	// ARGS :
	//     - Bank Name
	var id = msg.member.user.id+'';
	var f = function() {
		msg.reply('Your `'+args[0]+'` Bank account is created with Success!');
	};
	query('SELECT * FROM bank WHERE name=\''+escape_mysql(args[0])+'\'',function(err,rows1){
		if (rows1.length==0) {
			msg.reply('Sorry, `'+args[0]+'` Bank doesn\'t exist :cold_sweat:');
			return;
		}
		query('SELECT * FROM users WHERE name=\''+escape_mysql(msg.member.user.id+'')+'\'',function(err,rows){
			if (rows.length!=0) {
				var obj = JSON.parse(rows[0].data);
				obj.bank = obj.bank || {};
				if (typeof obj.bank[escape_mysql(args[0])] === 'undefined') {
					try {
						obj.bank[escape_mysql(args[0])] = parseFloat(JSON.parse(rows1[0].data).moneyOnStart) || 0.0;
					} catch (e) {
						obj.bank[escape_mysql(args[0])] = 0.0;
					}
					query('UPDATE users SET data = \''+escape_mysql(JSON.stringify(obj))+'\' WHERE name=\''+escape_mysql(id)+'\'',function(err,rows){
						f();
					});
				} else {
					msg.reply('Sorry, you have already a `'+args[0]+'` Bank account :cold_sweat:');
				}
			} else {
				var obj = {bank:{}};
				try {
					obj.bank[escape_mysql(args[0])] = parseFloat(JSON.parse(rows1[0].data).moneyOnStart) || 0.0;
				} catch (e) {
					obj.bank[escape_mysql(args[0])] = 0.0;
				}
				query('INSERT INTO users(name,data) VALUES (\''+escape_mysql(id)+'\',\''+escape_mysql(JSON.stringify(obj))+'\')',function(err,rows){
					f();
				});
			}
		});
	});
});
// CITOYEN
new Command('bank_delete_account', function(msg,args) {
	if (args.length < 1) return;
	// ARGS :
	//     - Bank Name
	var id = msg.member.user.id+'';
	query('SELECT * FROM bank WHERE name=\''+escape_mysql(args[0])+'\'',function(err,rows){
		if (rows.length==0) {
			msg.reply('Sorry, `'+args[0]+'` Bank doesn\'t exist :cold_sweat:');
			return;
		}
		query('SELECT * FROM users WHERE name=\''+escape_mysql(msg.member.user.id+'')+'\'',function(err,rows){
			if (rows.length!=0) {
				var obj = JSON.parse(rows[0].data);
				obj.bank = obj.bank || {};
				if (typeof obj.bank[escape_mysql(args[0])] !== 'undefined') {
					obj.bank[escape_mysql(args[0])] = null;
					delete obj.bank[escape_mysql(args[0])];
					query('UPDATE users SET data = \''+escape_mysql(JSON.stringify(obj))+'\' WHERE name=\''+escape_mysql(id)+'\'',function(err,rows){
						msg.reply('Your `'+args[0]+'` Bank account is deleted with Success!');
					});
					return;
				}
			}
			msg.reply('Sorry, you don\'t have a `'+args[0]+'` Bank account :cold_sweat:');
		});
	});
});
// CITOYEN
new Command('get_money', function(msg,args) {
	if (args.length < 1) return;
	// ARGS :
	//     - Bank Name
	var f = function(money) {
		msg.reply('You have `'+money+'` Money left in your `'+args[0]+'` Bank account!');
	};
	query('SELECT * FROM bank WHERE name=\''+escape_mysql(args[0])+'\'',function(err,rows){
		if (rows.length==0) {
			msg.reply('Sorry, `'+args[0]+'` Bank doesn\'t exist :cold_sweat:');
			return;
		}
		query('SELECT * FROM users WHERE name=\''+escape_mysql(msg.member.user.id+'')+'\'',function(err,rows){
			if (rows.length==0) {
				msg.reply('Sorry, you don\'t have a `'+args[0]+'` Bank account yet!\nPlease create a bank account with the command:\n        `+bank_create_account '+args[0]+'`');
				return;
			} else {
				var obj = JSON.parse(rows[0].data);
				obj.bank = obj.bank || {};
				var money = 0.0;
				try {
					if (typeof obj.bank[escape_mysql(args[0])] !== 'undefined') {
						money = parseFloat(obj.bank[escape_mysql(args[0])]) || 0.0;
					} else {
						msg.reply('Sorry, you don\'t have a `'+args[0]+'` Bank account yet!\nPlease create a bank account with the command:\n        `+bank_create_account '+args[0]+'`');
						return;
					}
				} catch (e) {}
				f(money);
			}
		});
	});
});



// SHOP

// ADMIN
new Command('shop_create', function(msg,args) {
	// ARGS :
	//    - Shop Name
	//    - Salons Available
	//    - File HTML
});
// ADMIN
new Command('shop_delete', function(msg,args) {
	// ARGS :
	//     - Shop Name
});
// ADMIN
new Command('shop_update_salons', function(msg,args) {
	// ARGS :
	//    - Shop Name
	//    - Salons Available
});
// ADMIN
new Command('shop_update_file', function(msg,args) {
	// ARGS :
	//    - Shop Name
	//    - File HTML
});

// CITOYEN
new Command('item_pay', function(msg,args) {
	// ARGS :
	//     - Shop Name
	//     - Item ID
});
// THIEF
new Command('item_steal', function(msg,args) {
	// ARGS :
	//     - Shop Name
	//     - Item ID
});





/*
new Command('bank_create', function(msg,args) {
	//msg.channel.send('wesh comment ça va?');
});
new Command('bank_create', function(msg,args) {
	//msg.channel.send('wesh comment ça va?');
});*/

new Command('list_command', function(msg,args) {
	msg.channel.send(Object.keys(Command.List).join(', '));
});



//////////////////////////////////////
//          INTERFACE WEB           //
//////////////////////////////////////

	
const port = process.env.PORT || 80;
var path = require('path');
var express = require('express');
var app = express();


const CLIENT_ID = '693825334835150918';
const CLIENT_SECRET = 'd4Yjr0dIU7XC7miDfUHAagRB7aBztE8d';
const redirect = encodeURIComponent('https://accountsupervisorwebinterface.herokuapp.com/api/discord/callback');

app.get('/api/discord/login', (req, res) => {
  res.redirect(`https://discordapp.com/api/oauth2/authorize?client_id=${CLIENT_ID}&scope=identify&response_type=code&redirect_uri=${redirect}`);
});

app.get('/api/discord/callback', (req, res) => {
	try {
  const code = req.query.code;
  const creds = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const response = await fetch(`https://discordapp.com/api/oauth2/token?grant_type=authorization_code&code=${code}&redirect_uri=${redirect}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
      },
    });
  const json = await response.json();
  res.redirect(`/?token=${json.access_token}`);
	} catch(e) {res.status(200).send('Unknow error');}
});

app.get('/', function (req, res) {
	res.status(200).sendFile(path.join(__dirname, 'index.html'));
});


var server = app.listen(port, function () {
	var host = server.address().address
	var port = server.address().port
	   
	console.log("Example app listening at http://%s:%s", host, port)
});
	




