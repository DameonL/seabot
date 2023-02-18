import eventmonkey from "eventmonkey";
import SlashCommand from "../SlashCommand";

export default new SlashCommand({
  name: "seavent-edit",
  description: "Edit a server event",
  ...eventmonkey.commands.edit,
});
