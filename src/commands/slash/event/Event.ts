import {
  ActionRowBuilder,
  ButtonBuilder,
  ModalActionRowComponentBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
} from "@discordjs/builders";

import SlashCommand from "../SlashCommand";

import {
  ChatInputCommandInteraction,
  CommandInteraction,
  GuildScheduledEventEntityType,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputStyle,
} from "discord.js";
import moment from "moment";
import { minutesToMilliseconds } from "../../../utils/Time/conversion";

interface EventUnderConstruction {
  name: string;
  description: string;
  image: string;
  location: string;
  startTime: Date;
  duration: moment.Duration;
}

interface UserEventMap {
  [userId: string]: EventUnderConstruction
}

const eventsInProgress: UserEventMap = {};

type GuildEventAction = "create" | "edit";
const eventActions: GuildEventAction[] = ["create", "edit"];
interface StartedInteraction {}
const eventTypes = Object.keys(GuildScheduledEventEntityType)
  .filter((key) => !isNaN(Number(key)))
  .map((key) => Number(key));

export default new SlashCommand({
  name: "event",
  help: "Create or edit an event",
  description: "asdf",
  builder: () =>
    new SlashCommandBuilder()
      .setName("event")
      .setDescription("Create a server event")
      .addStringOption((option) => {
        option
          .setName("action")
          .setDescription("Create a new event, or edit an existing event");
        option.addChoices(
          ...eventActions.map((eventAction) => {
            return { name: eventAction, value: eventAction };
          })
        );
        option.setRequired(true);
        return option;
      }),
  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild || !interaction.channel) return;

    const eventAction: GuildEventAction = interaction.options.getString(
      "action"
    ) as GuildEventAction;

    const defaultStartTime = new Date();
    defaultStartTime.setDate(defaultStartTime.getDate() + 1);
    const defaultDuration = moment.duration(1, "hour");
    /*    const collector = interaction.channel.createMessageComponentCollector();
    collector.on("collect", async (interaction) => {
      console.log(interaction.customId);
    });
*/
    var newEvent: EventUnderConstruction = interaction.user.id in eventsInProgress ? eventsInProgress[interaction.user.id] : {
      name: "New Event",
      description: "Your event description",
      image: "",
      startTime: defaultStartTime,
      duration: defaultDuration,
      location: "Event Location",
    };

    eventsInProgress[interaction.user.id] = newEvent;

    await showEventModal(newEvent, interaction);
  },
});

async function showEventModal(
  event: EventUnderConstruction,
  interaction: ChatInputCommandInteraction
) {
  const modalId = "createServerEventModal";
  const modal = new ModalBuilder();
  modal.setTitle("Create a New Event");
  modal.setCustomId(modalId);

  const nameInput =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Name")
        .setCustomId(`${modalId}NameInput`)
        .setStyle(TextInputStyle.Short)
        .setValue(event.name)
    );

  const descriptionInput =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Description")
        .setCustomId(`${modalId}DescriptionInput`)
        .setStyle(TextInputStyle.Paragraph)
        .setValue(event.description)
    );

  const dateInput =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Date and Time (format: DD/MM/YY HH:MM AM/PM)")
        .setCustomId(`${modalId}StartTime`)
        .setStyle(TextInputStyle.Short)
        .setValue(
          event.startTime.toLocaleString("en-us", {
            day: "2-digit",
            month: "2-digit",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        )
    );

  const components = [nameInput, descriptionInput, dateInput];
  modal.addComponents(components);

  await interaction.showModal(modal);
  let submission: ModalSubmitInteraction | undefined;
  try {
    submission = await interaction.awaitModalSubmit({
      time: minutesToMilliseconds(10),
      filter: (modalInteraction) =>
        modalInteraction.user.id === interaction.user.id,
    });
  } catch {
    await submission?.reply({
      content: "Event creation timed out.",
      ephemeral: true,
    });

    return;
  }

  const startTime = submission.fields.getTextInputValue(`${modalId}StartTime`);
  if (!/\d\d?\/\d\d?\/\d{2,4},?\s+\d\d?:\d\d\s+(am|pm)/i.test(startTime)) {
    await submission.reply({
      content: "Invalid date format.",
      ephemeral: true,
    });
    return;
  }

  event.name = submission.fields.getTextInputValue(`${modalId}NameInput`);
  event.description = submission.fields.getTextInputValue(
    `${modalId}DescriptionInput`
  );
  event.startTime = new Date(startTime);

  await submission.reply({
    content: "Event created successfully!",
    ephemeral: true,
  });
}
