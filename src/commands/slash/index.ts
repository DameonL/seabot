import SlashCommand from "./SlashCommand";
import databaseCommands from "./database";
import helpCommands from "./help";
import mtgCommands from "./mtg";
import reportCommands from "./report";
import rjCommands from "./rj";
import roleCommands from "./role";
import utilityCommands from "./utility";
import weatherCommands from "./weather";

import { discordBot } from "../../server";
import registerEventCommand from "./event/Event";

const commands: SlashCommand[] = [
  ...databaseCommands,
  ...helpCommands,
  ...mtgCommands,
  ...reportCommands,
  ...rjCommands,
  ...roleCommands,
  ...utilityCommands,
  ...weatherCommands,
];

const waitForClientThenRegisterEventCommand = () => {
  if (discordBot && discordBot.client) {
    if (discordBot.client.user) {
      registerEventCommand(discordBot.client, process.env.botToken as string, [
        { name: "Meetup", channelId: "1069270901251657849" },
        { name: "Hangout", channelId: "1069679271309758614" },
      ]);

      return;
    }
  }

  setTimeout(waitForClientThenRegisterEventCommand, 500);
};

waitForClientThenRegisterEventCommand();


export default commands;
