import SlashCommand from "./SlashCommand";
import databaseCommands from "./database";
import helpCommands from "./help";
import mtgCommands from "./mtg";
import reportCommands from "./report";
import rjCommands from "./rj";
import roleCommands from "./role";
import utilityCommands from "./utility";
import weatherCommands from "./weather";
import eventCommands from "./event";

const commands: SlashCommand[] = [
  ...databaseCommands,
  ...helpCommands,
  ...mtgCommands,
  ...reportCommands,
  ...rjCommands,
  ...roleCommands,
  ...utilityCommands,
  ...weatherCommands,
  ...eventCommands,
];

export default commands;
