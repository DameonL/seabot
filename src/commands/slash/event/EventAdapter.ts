import eventmonkey, {
  EventMonkeyConfiguration,
} from "eventmonkey";
import { discordBot } from "../../../server";
import {
  daysToMilliseconds,
  minutesToMilliseconds,
} from "../../../utils/Time/conversion";
import SlashCommand from "../SlashCommand";

let configuration: EventMonkeyConfiguration = {
  commandName: "seavent",
  eventTypes: [
    {
      name: "Meetup",
      channel: "meetups",
      announcement: {
        channel: "general",
        beforeStart: minutesToMilliseconds(30),
        onStart: true,
      },
    },
    { name: "Happening", channel: "happenings" },
  ],
  editingTimeout: minutesToMilliseconds(30),
  closeThreadsAfter: daysToMilliseconds(1),
  roles: {
    allowed: [],
    denied: ["1073396252894564403"],
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
  ...eventmonkey.commands.create,
});
