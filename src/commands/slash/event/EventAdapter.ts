import eventmonkey, { EventMonkeyConfiguration } from "eventmonkey";
import { discordBot } from "../../../server";
import {
  daysToMilliseconds,
  minutesToMilliseconds,
} from "../../../utils/Time/conversion";
import SlashCommand from "../SlashCommand";

const announcement = {
  channel: "announcements",
  beforeStart: minutesToMilliseconds(30),
  onStart: true,
};

let configuration: EventMonkeyConfiguration = {
  commandName: "seavent",
  eventTypes: [
    {
      name: "Meetup",
      discussionChannel: "meetups",
      announcement,
    },
    {
      name: "Happening",
      discussionChannel: "happenings",
      announcement,
    },
    {
      name: "Hangout",
      discussionChannel: "hangouts",
      voiceChannel: "Hangout",
      announcement,
    },
    {
      name: "Lecture",
      discussionChannel: "lectures",
      stageChannel: "Lecture",
      announcement,
    },
  ],
  editingTimeout: minutesToMilliseconds(30),
  closeThreadsAfter: daysToMilliseconds(1),
  timeZone: {
    name: "PST",
    utcOffset: -8,
  },
};

export const waitForClientThenConfigure = async () => {
  if (discordBot && discordBot.client && discordBot.client.isReady()) {
    if (discordBot.client.user) {
      configuration = {
        ...configuration,
        discordClient: discordBot.client,
      };

      await eventmonkey.configure(configuration);
      return;
    }
  }

  setTimeout(waitForClientThenConfigure, 500);
};

eventmonkey.configure({ ...configuration, discordClient: undefined as any });
waitForClientThenConfigure();

export default new SlashCommand({
  name: "seavent",
  description: "Create a server event",
  builder: eventmonkey.command.builder,
  execute: eventmonkey.command.execute,
});
