import { Events } from "discord.js";
import { discordBot } from "../server";

let started = false;
let messagesSent = 0;
let reactions = 0;

function registerStatListeners() {
  discordBot.client.addListener(Events.MessageCreate, () => {
    messagesSent++;
  });
  discordBot.client.addListener(Events.MessageReactionAdd, () => {
    reactions++;
  });
}

const StatMonitor = {
  start: () => {
    if (started) return;

    registerStatListeners();
    started = true;
  },
  get messagesSent() {
    return messagesSent;
  },
  get userCount() {
    let count = 0;
    for (const _ of discordBot.client.users.cache) {
      count++;
    }

    return count;
  },
  get reactions() {
    return reactions;
  },
};

export default StatMonitor;
