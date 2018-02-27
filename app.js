var express = require('express');
var cfenv = require('cfenv');
var redis = require('redis');

const APP_ID = "Your App ID";
const APP_SECRET = "Your App Secret";
const APP_WEBHOOK_SECRET = "Your Webhook Secret";

const redisHost = "Your Redis host";
const redisPort = "Your Redis port";
const redisSecret = "Your Redis secret";

const url = "Watson Language translator URL";
const username = "Your Watson Language translator username";
const password = "Your Watson Language translator password";

// ---------------------------------------------------------
// Initialize Redis
// ---------------------------------------------------------
var redisClient = redis.createClient(redisPort, redisHost);
redisClient.on('connect', function() {
    console.log('connected to redis');
    redisClient.auth(redisSecret,function(err,reply) {
      console.log(reply);
    });
});

// ---------------------------------------------------------
// Initialize Watson Workspace
// ---------------------------------------------------------
const wwsdk = require('watsonworkspace-sdk');
const ww = new wwsdk(APP_ID,APP_SECRET);
const wwui = require('watsonworkspace-sdk').UI; //for ui elements

// ---------------------------------------------------------
// Initialize Bot framework
// ---------------------------------------------------------
const botFramework = require('watsonworkspace-bot');
botFramework.level('debug');
botFramework.startServer(8080);

const bot = botFramework.create(APP_ID, APP_SECRET, APP_WEBHOOK_SECRET) // bot settings defined by process.env
bot.authenticate()

// ---------------------------------------------------------
// Initialize Watson Language Translator
// ---------------------------------------------------------
var LanguageTranslatorV2 = require('watson-developer-cloud/language-translator/v2');
var language_translator = new LanguageTranslatorV2({
  username: username,
  password: password,
  url: url
});

// ---------------------------------------------------------
// App body
// ---------------------------------------------------------
var textBreak = "\r\n";

//////////////////////////////////////////
// Action: Translate incoming messages
//////////////////////////////////////////
bot.on('message-created', (message) => {
  ww.authenticate()
    .then(token => {
      redisClient.get(message.userId+"@"+message.spaceId,function(err,reply) {
        console.log("Translation status: "+reply);
        if (reply != "disable") {
          if (reply == "es-en") { 
            let origin = "es"; 
            let destiny = "en";
            translateText(message.content, origin, destiny, function(error, result) {
              if (result!=null) {
                console.log("Translation result is: "+result);
                ww.sendMessage(message.spaceId, {
                  "type": "generic",
                  "version": "1",

                  "color": "#36a64f",
                  "text": result,

                  "actor": {
                    "name": message.userName
                  }
                })
                .catch(error => console.log(error))
              } else {
                console.log('Error received by translation function');
              }
            });
          };
          if (reply == "en-es") { 
            let origin = "en"; 
            let destiny = "es";
            translateText(message.content, origin, destiny, function(error, result) {
              if (result!=null) {
                console.log("Translation result is: "+result);
                ww.sendMessage(message.spaceId, {
                  "type": "generic",
                  "version": "1",

                  "color": "#36a64f",
                  "text": result,

                  "actor": {
                    "name": message.userName
                  }
                })
                .catch(error => console.log(error))
              } else {
                console.log('Error received by translation function');
              }
            });
          };
        }
      })
    })
})

//////////////////////////////////////////
// Action: Translation menu
//////////////////////////////////////////
bot.on(`actionSelected:/translator`, (message, annotation, params) => {
  redisClient.get(message.userId+"@"+message.spaceId,function(err,reply) {
   console.log(err);
   console.log(reply);
   let subtitle = "*Status:* Translation is disabled";
   if (reply != "disable") {
      if (reply == "es-en") { subtitle = "*Status:* Translating from Spanish to English" };
      if (reply == "en-es") { subtitle = "*Status:* Translating from English to Spanish" };
   }
    ww.authenticate()
    .then(token => {
      const buttons = [wwui.button('/translator-en-es', 'Translate from en to es'),wwui.button('/translator-es-en', 'Translate from es to en'),wwui.button('/translator-disable', 'Disable translation')];
      const dialog = wwui.generic('Watson Workspace auto-translator', subtitle, buttons);
      ww.sendTargetedMessage(message.userId, annotation, dialog);
    })
    .catch(error => console.log(error))
  });
})


//////////////////////////////////////////
// Action: Enable translation from spanish to english
//////////////////////////////////////////
bot.on(`actionSelected:/translator-es-en`, (message, annotation, params) => {
  redisClient.set(message.userId+"@"+message.spaceId,"es-en");
  let subtitle = "*Status:* Translating from Spanish to English";

  ww.authenticate()
  .then(token => {
      const buttons = [wwui.button('/translator-en-es', 'Translate from en to es'),wwui.button('/translator-disable', 'Disable translation')];
      const dialog = wwui.generic('Watson Workspace auto-translator', subtitle, buttons);
      ww.sendTargetedMessage(message.userId, annotation, dialog);
    })
  .catch(error => console.log(error))
})

//////////////////////////////////////////
// Action: Enable translation from english to spanish
//////////////////////////////////////////
bot.on(`actionSelected:/translator-en-es`, (message, annotation, params) => {
  redisClient.set(message.userId+"@"+message.spaceId,"en-es");
  let subtitle = "*Status:* Translating from English to Spanish";
  ww.authenticate()
  .then(token => {
      const buttons = [wwui.button('/translator-es-en', 'Translate from es to en'),wwui.button('/translator-disable', 'Disable translation')];
      const dialog = wwui.generic('Watson Workspace auto-translator', subtitle, buttons);
      ww.sendTargetedMessage(message.userId, annotation, dialog);
    })
  .catch(error => console.log(error))
})

//////////////////////////////////////////
// Action: Disable translation
//////////////////////////////////////////
bot.on(`actionSelected:/translator-disable`, (message, annotation, params) => {
  redisClient.set(message.userId+"@"+message.spaceId,"disable");
  let subtitle = "*Status:* Translation is disabled";
  ww.authenticate()
  .then(token => {
    const buttons = [wwui.button('/translator-es-en', 'Translate from es to en'),wwui.button('/translator-en-es', 'Translate from en to es')];
    const dialog = wwui.generic('Watson Workspace auto-translator', subtitle, buttons);
    ww.sendTargetedMessage(message.userId, annotation, dialog);
  })
  .catch(error => console.log(error))
})

//***************************************
// Function: Translate
//***************************************
function translateText(textToTranslate, origin, destiny, callback) {
  language_translator.translate(
  {
    text: textToTranslate,
    source: origin,
    target: destiny
  },
  function(err, translation) {
    if (err) {
      console.log('error:', err);
      callback("error",null);
    } else {
      let translatedText = translation.translations[0].translation;
      callback(null,translatedText);
    }
  })
}
