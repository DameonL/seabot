import { editEventCommand } from "@solarweb/eventmonkey";
import SlashCommand from "../SlashCommand";

export default new SlashCommand({
  name: "seavent-edit",
  description: "Edit a server event",
  ...editEventCommand,
});
