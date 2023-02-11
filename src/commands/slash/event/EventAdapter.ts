import {
  configure,
  eventCommand,
  EventMonkeyConfiguration,
} from "@solarweb/eventmonkey";
import { discordBot } from "../../../server";
import SlashCommand from "../SlashCommand";

let configuration:
  | EventMonkeyConfiguration
  | Omit<EventMonkeyConfiguration, "discordClient"> = {
  commandName: "seavent",
  eventTypes: [
    { name: "Meetup", channelId: "1069270901251657849" },
    { name: "Happening", channelId: "1069679271309758614" },
  ],
  editingTimeoutInMinutes: 30,
  roleIds: {
    allowed: [
    ],
    denied: [
      "1073396252894564403"
    ]
  }
};

const waitForClientThenConfigure = () => {
  if (discordBot && discordBot.client) {
    if (discordBot.client.user) {
      configuration = {
        ...configuration,
        discordClient: discordBot.client,
      };

      configure(configuration);
      return;
    }
  }

  setTimeout(waitForClientThenConfigure, 500);
};

configure({ ...configuration, discordClient: undefined as any });
waitForClientThenConfigure();

export default new SlashCommand({
  name: "seavent",
  description: "Create a server event",
  ...eventCommand,
});
