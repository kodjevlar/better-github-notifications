'use strict';
const fetch = require('node-fetch');
const slack = require('slack');
const btoa = require('btoa');
const cron = require('node-cron');

const username = process.env.USERNAME;
const password = process.env.TOKEN;
let freq = 0;
let lastSuccessFulCheck = new Date('2000-01-01');

async function check() {
  console.log('Checking if there is anything new since', lastSuccessFulCheck);

  const options = {
    headers: {
      'Authorization': 'Basic ' + btoa(username + ':' + password),
      'If-Modified-Since': lastSuccessFulCheck.toUTCString()
    }
  };

  const res = await fetch('https://api.github.com/notifications', options);

  let json = null;

  if (res.status !== 304) {
    json = await res.json();
  }

  lastSuccessFulCheck = new Date();

  return {
    freq: res.headers.get('X-Poll-Interval'),
    json
  };
}

// Slack to the rescue!
function notify(not) {
  const payload = {
    token: process.env.SLACK_TOKEN,
    text: `New stuff in ${not.subject.type} - ${not.subject.title} (${not.subject.url})`,
    channel: process.env.SLACK_USER,
    username: process.env.BOT_NAME
  };

  console.log('Posting to Slack', payload.text);

  return new Promise(function(resolve, reject) {
    slack.chat.postMessage(payload, function(err, data) {
      if (err) {
        return reject(err);
      }

      resolve(data);
    });
  });
}

function postAsMe(msg, channel) {
  const payload = {
    token: process.env.SLACK_TOKEN,
    text: msg,
    channel,
    as_user: true
  };

  console.log('Posting to Slack as me', payload.text);

  return new Promise(function(resolve, reject) {
    slack.chat.postMessage(payload, function(err, data) {
      if (err) {
        return reject(err);
      }

      resolve(data);
    });
  });
}

async function run() {
  let result;

  try {
    result = await check();
    freq = result.freq;

    console.log('I should poll with ', result.freq, 'sec interval...');

    if (!result.json) {
      console.log('Nothing new since last time');
    } else {
      result.json.forEach(function(notification) {
        notify(notification);
      });
    }
  } catch (err) {
    console.log('Something went wrong when polling: ', err);
  }

  setTimeout(run, freq * 1000);
}

(async function standup() {
  console.log('Scheduling standup');

  // 1 hour time scew
  cron.schedule('0 0 8 * * 0-5', async function() {
    console.log('Posting standup');
    await postAsMe('standup!', '#qwerty');
  });
})();

setTimeout(run, freq * 1000);
console.log('Github notifier started...');
