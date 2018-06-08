/*-----------------------------------------------------------------------------
A simple Language Understanding (LUIS) bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var cog = require('botbuilder-cognitiveservices');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(connector, function (session, args) {
    session.send('You reached the default message handler. You said \'%s\'.', session.message.text);
});

bot.set('storage', tableStorage);

// Make sure you add code to validate these fields
//console.log(process.env)
var luisAppId = process.env.LuisAppId ;
var luisAPIKey = process.env.LuisAPIKey ;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';
var qnaMakerHost = process.env.qnaMakerHost ;
var qnaMakerEndpointKey = process.env.qnaMakerEndpointKey;
var qnaMakerKbId =  process.env.qnaMakerKbId;
var qnaMakerSubscriptionKey = process.env.qnaMakerSubscriptionKey;

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

// Create a recognizer that gets intents from LUIS, and add it to the bot
var luisrecognizer = new builder.LuisRecognizer(LuisModelUrl);
var qnaRecognizer = new cog.QnAMakerRecognizer({
    knowledgeBaseId: qnaMakerKbId,
    subscriptionKey: qnaMakerSubscriptionKey
});
bot.recognizer(luisrecognizer);
//bot.recognizer(qnarecognizer);


// Add a dialog for each intent that the LUIS app recognizes.
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 
bot.dialog('GreetingDialog',
    (session) => {
        session.send('You reached the Greeting intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Greeting'
})

bot.dialog('HelpDialog',
    (session) => {
        session.send('You reached the Help intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Help'
})

bot.dialog('CancelDialog',
    (session) => {
        session.send('You reached the Cancel intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Cancel'
});

bot.dialog('CreditLimitDialog', [
    function (session, args, next) {
        session.dialogData.profile = args || {}; // Set the profile or create the object.
        if (!session.dialogData.profile.accountType) {
            builder.Prompts.choice(session, "What's your account type?", "silver|gold|platinum", { listStyle: 3 });
        } else {
            next(); // Skip if we already have this info.
        }
    },
    function (session, results, next) {
        if (results.response) {
            // Save account type if we asked for it.
            console.log(results.response);
            session.dialogData.profile.accountType = results.response.entity;
        }
        if (!session.dialogData.profile.location) {
            builder.Prompts.text(session, "What is your location?");
        } else {
            next(); // Skip if we already have this info.
        }
    },
    function (session, results) {
        console.log("in next");
        if (results.response) {
            // Save location if we asked for it.
            session.dialogData.profile.location = results.response;
        }
        //console.log(session.dialogData.profile);
        session.send(`Hello credit limit for ${session.dialogData.profile.accountType} and in ${session.dialogData.profile.location} is $10000`);        
    }
]).triggerAction({
   matches: 'CreditLimit'
});
    

// bot.dialog('CreditLimitDialog',
//     (session) => {
//         session.send('You credit limit is $5000', session.message.text);
//         session.endDialog();
//     }
// ).triggerAction({
//     matches: 'CreditLimit'
// })

// The dialog stack is cleared and this dialog is invoked when the user enters 'help'.
bot.dialog('help', function (session, args, next) {
    session.endDialog("Ok. Our agent will get in touch with you shortly.");
})
.triggerAction({
    matches: /^help$/i,
});

bot.dialog('AzureVMQuestions', function (session, args) {
    var query = session.message.text;
    cog.QnAMakerRecognizer.recognize(query, 
        qnaMakerHost+ '/knowledgebases/' + qnaMakerKbId + '/generateAnswer', 
        'EndpointKey ' + qnaMakerEndpointKey, 'Authorization', 1, 'AzureVMQuestions', (error, results) => {
        session.send(results.answers[0].answer);
    })
}).triggerAction({
    matches: 'AzureVMQuestions'
})

