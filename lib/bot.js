import Slack from 'slack';
import SlackBot from 'slackbots';
import env from 'node-env-file';
import _ from 'lodash';
import exists from 'node-file-exists';

if (exists('./.env')) {
  env('./.env');
}

const BOT_NAME_MAIN = 'gem-me-bot';
const SLACK_TOKEN_GEM = process.env.SLACK_TOKEN;
const SLACK_TOKEN_TIL = process.env.TIL_TOKEN;

const TYPES = [
  {
    name: 'GEM',
    reaction: 'gem',
    channel: '#-gems',
    bot: BOT_NAME_MAIN,
    token: SLACK_TOKEN_GEM,
  },
  {
    name: 'TIL',
    reaction: 'lightbulb',
    channel: '#til',
    bot: 'til-bot',
    token: SLACK_TOKEN_TIL,
  },
];

let users = [];
const bot = new SlackBot({ token: SLACK_TOKEN_GEM, name: BOT_NAME_MAIN });
const slack = new Slack({ token: SLACK_TOKEN_GEM });

const getUser = (userMap, id) => users[_.findIndex(userMap, (o) => o.id === id)];

const gemMessage = (type, {
  channel, ts, gemUserId, minerUserId,
}) => {
  const gemUser = getUser(users, gemUserId);
  const minerUser = getUser(users, minerUserId);
  console.log(`A ${type.name} was found!`);

  slack.conversations.history({ token: SLACK_TOKEN_GEM, channel }, (err, data) => {
    _.forEach(data, (messages) => {
      _.forEach(messages, (message) => {
        let text = '';
        let count = 0;
        if (message.reactions) {
          for (let i = 0; i < message.reactions.length; i++) {
            if (message.reactions[i].name === type.reaction) {
              count = message.reactions[i].count; // How many times?
            }
          }
          if (message.ts === ts && message.user === gemUserId && gemUser.name !== 'gem-me-bot' && count === 1) {
            text = `${minerUser.name}: "${message.text}" \n- @${gemUser.name}`;
            slack.chat.postMessage({
              token: type.token, channel: type.channel, text, as_user: true, username: type.bot,
            }, () => {
              console.log(`sent a ${type.name} message to ${type.channel} channel.`);
            });
          }
        }
      });
    });
  });
};

bot.on('start', () => {
  console.log('Gem-bot started!');
  slack.users.list({ token: SLACK_TOKEN_GEM }, (err, data) => {
    users = _.map(data.members, (member) => ({
      name: member.name,
      id: member.id,
    }));
  });
});

// respond to the `reaction_added` event.
bot.on('message', ({
  item, type, item_user, user, reaction,
}) => {
  if (type !== 'reaction_added') return;

  if (item.type === 'message') {
    const details = {
      channel: item.channel, ts: item.ts, gemUserId: item_user, minerUserId: user,
    };
    const which = TYPES.find((_type) => _type.reaction === reaction);
    if (which) {
      gemMessage(which, details);
    }
  }
});
