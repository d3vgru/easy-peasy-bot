/**
 * A Bot for Slack!
 */


/**
 * Define a function for initiating a conversation on installation
 * With custom integrations, we don't have a way to find out who installed us, so we can't message them :(
 */

function onInstallation(bot, installer) {
    if (installer) {
        bot.startPrivateConversation({user: installer}, function (err, convo) {
            if (err) {
                console.log(err);
            } else {
                convo.say('I am a bot that has just joined your team');
                convo.say('You must now /invite me to a channel so that I can be of use!');
            }
        });
    }
}


/**
 * Configure the persistence options
 */

var config = {};
if (process.env.MONGOLAB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGOLAB_URI}),
    };
} else {
    config = {
        json_file_store: ((process.env.TOKEN)?'./db_slack_bot_ci/':'./db_slack_bot_a/'), //use a different name if an app or CI
    };
}

/**
 * Are being run as an app or a custom integration? The initialization will differ, depending
 */

if (process.env.TOKEN || process.env.SLACK_TOKEN) {
    //Treat this as a custom integration
    var customIntegration = require('./lib/custom_integrations');
    var token = (process.env.TOKEN) ? process.env.TOKEN : process.env.SLACK_TOKEN;
    var controller = customIntegration.configure(token, config, onInstallation);
} else if (process.env.CLIENT_ID && process.env.CLIENT_SECRET && process.env.PORT) {
    //Treat this as an app
    var app = require('./lib/apps');
    var controller = app.configure(process.env.PORT, process.env.CLIENT_ID, process.env.CLIENT_SECRET, config, onInstallation);
} else {
    console.log('Error: If this is a custom integration, please specify TOKEN in the environment. If this is an app, please specify CLIENTID, CLIENTSECRET, and PORT in the environment');
    process.exit(1);
}


/**
 * A demonstration for how to handle websocket events. In this case, just log when we have and have not
 * been disconnected from the websocket. In the future, it would be super awesome to be able to specify
 * a reconnect policy, and do reconnections automatically. In the meantime, we aren't going to attempt reconnects,
 * WHICH IS A B0RKED WAY TO HANDLE BEING DISCONNECTED. So we need to fix this.
 *
 * TODO: fixed b0rked reconnect behavior
 */
// Handle events related to the websocket connection to Slack
controller.on('rtm_open', function (bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});


/**
 * Core bot logic goes here!
 */
// BEGIN EDITING HERE!

var Firebase = require('firebase');
var db = new Firebase("https://sorryjb.firebaseio.com/");

var fs = require('fs');
var firebaseConfig = JSON.parse(fs.readFileSync('config/firebase.json'));

// config format: {"token": "<actual firebase token string>"}
db.authWithCustomToken(firebaseConfig.token, function(err, response) {
	if(err) {
		console.log("ERROR: " + JSON.stringify(err));
	} else {
		console.log("Auth Response: " + JSON.stringify(response));
	}
});

var sorryjbChan = 'C19JGEL5B'; // #sorryjb

var userHash = {
	'artax': 'John',
	'cohaagen': 'Ed',
	'edgemar': 'Mark',
	'lordlobo': 'Dan',
	'richter': 'Bryan'
};


controller.on('bot_channel_join', function (bot, message) {
    bot.reply(message, "I'm here!")
});

controller.hears('^S(\\d+)E(\\d+):? ?(.+)$', 'ambient', function (bot, message) {
	// get username
	bot.api.users.info({user: message.user}, function(err, response) {
		if(response) {
			// from response
			var userName = response.user.name;
			var displayName = userName;
			if(userHash[userName])
				displayName = userHash[userName];
			displayName = '[' + displayName + ']';

			// from regex
			var season = message.match[1];
			var episode = message.match[2];
			var desc = message.match[3];
			
			// computed
			var prodCode = 'S' + season + 'E' + episode;
			var recap = prodCode + ': ' + desc;
	
			// 1) save [name, prodCode, desc] to Firebase
			var episodes = db.child("episodes");
			var newEp = episodes.push();
			newEp.set({
				author: userName,
				user: message.user,
				prodCode: prodCode,
				season: season,
				episode: episode,
				synopsis: desc
			});

			// 2) TODO? save to Google Doc
			var appendToDoc = '[' + userName + ']\n' + recap + '\n\n';
			

			// stop processing if message was posted directly to #sorryjb
			if(message.channel == sorryjbChan)
				return;

			// 3) repost message like [user]: SxxEyy: [description]
			bot.say({
				text: displayName + ': ' + recap,
				channel: sorryjbChan
			});
		}
	});
});


/**
 * AN example of what could be:
 * Any un-handled direct mention gets a reaction and a pat response!
 */
//controller.on('direct_message,mention,direct_mention', function (bot, message) {
//    bot.api.reactions.add({
//        timestamp: message.ts,
//        channel: message.channel,
//        name: 'robot_face',
//    }, function (err) {
//        if (err) {
//            console.log(err)
//        }
//        bot.reply(message, 'I heard you loud and clear boss.');
//    });
//});
