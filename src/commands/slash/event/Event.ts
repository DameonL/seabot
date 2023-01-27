import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ModalActionRowComponentBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
} from "@discordjs/builders";

import SlashCommand from "../SlashCommand";

import {
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  CommandInteraction,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  InteractionCollector,
  InteractionReplyOptions,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputStyle,
} from "discord.js";
import { minutesToMilliseconds } from "../../../utils/Time/conversion";
import { discordBot } from "../../../server";

interface EventUnderConstruction {
  name: string;
  description: string;
  image: string;
  entityMetadata: { location: string };
  scheduledStartTime: Date;
  duration: number;
  privacyLevel: GuildScheduledEventPrivacyLevel;
}

interface UserEventMap {
  [userId: string]: EventUnderConstruction;
}

const eventsInProgress: UserEventMap = {};
const embedId = "eventSubmissionEmbed";

type GuildEventAction = "create" | "edit";
const eventActions: GuildEventAction[] = ["create", "edit"];

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
    const defaultDuration = 1;

    var newEvent: EventUnderConstruction =
      interaction.user.id in eventsInProgress
        ? eventsInProgress[interaction.user.id]
        : {
            name: "New Event",
            description: "Your event description",
            image: "",
            scheduledStartTime: defaultStartTime,
            duration: defaultDuration,
            entityMetadata: { location: "Event Location" },
            privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
          };

    eventsInProgress[interaction.user.id] = newEvent;

    await showEventModal(newEvent, interaction);
  },
});

async function showEventModal(
  event: EventUnderConstruction,
  interactionToReply: ChatInputCommandInteraction | ButtonInteraction
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
          event.scheduledStartTime
            .toLocaleString("en-us", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
            .replace(",", "")
            .replace(" ", " ")
        )
    );

  const durationInput =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Duration (in hours)")
        .setCustomId(`${modalId}Duration`)
        .setStyle(TextInputStyle.Short)
        .setValue(`${event.duration.toString()}`)
    );

  const components = [nameInput, descriptionInput, dateInput, durationInput];
  modal.addComponents(components);

  await interactionToReply.showModal(modal);
  const submission = await interactionToReply.awaitModalSubmit({
    time: minutesToMilliseconds(10),
    filter: (submitInteraction, collected) => {
      if (
        submitInteraction.user.id === interactionToReply.user.id &&
        submitInteraction.customId === modalId
      ) {
        return true;
      }

      return false;
    },
  });

  event.name = submission.fields.getTextInputValue(`${modalId}NameInput`);
  event.description = submission.fields.getTextInputValue(
    `${modalId}DescriptionInput`
  );

  const startTime = submission.fields.getTextInputValue(`${modalId}StartTime`);
  if (!/\d\d?\/\d\d?\/\d{2,4}\s+\d\d?:\d\d\s+(am|pm)/i.test(startTime)) {
    await submission.reply({
      content: "Invalid date format.",
      ephemeral: true,
    });

    eventsInProgress[submission.user.id] = event;
    return;
  }

  event.scheduledStartTime = new Date(Date.parse(startTime));

  const duration = Number(
    submission.fields.getTextInputValue(`${modalId}Duration`)
  );
  if (isNaN(duration)) {
    await submission.reply({
      content: "Invalid duration format.",
      ephemeral: true,
    });

    eventsInProgress[submission.user.id] = event;
    return;
  }

  event.duration = duration;

  var submissionEmbed = createSubmissionEmbed();
  const submissionReply = await submission.reply(submissionEmbed);

  waitForSubmission(submission, embedId, event, interactionToReply);
}

function waitForSubmission(
  submission: ModalSubmitInteraction,
  embedId: string,
  event: EventUnderConstruction,
  commandInteraction: ChatInputCommandInteraction | ButtonInteraction
) {
  if (!submission.channel) return;

  const submissionCollector =
    submission.channel.createMessageComponentCollector({
      filter: (submissionInteraction) =>
        submissionInteraction.user.id === submission.user.id &&
        submissionInteraction.customId.startsWith(embedId),
      time: minutesToMilliseconds(5),
    });

  submissionCollector.on(
    "collect",
    async (submissionInteraction: ButtonInteraction) =>
      await submissionReceived(
        submissionInteraction,
        embedId,
        event,
        submissionCollector,
        submission,
        commandInteraction
      )
  );

  submissionCollector.on("end", (collected, reason) => {
    if (reason === "time") {
      submission.editReply({
        content:
          "Sorry, your event editing timed out! You can continue from where you left off when ready.",
        embeds: [],
        components: [],
      });
    }
  });
}

async function submissionReceived(
  submissionInteraction: ButtonInteraction,
  embedId: string,
  event: EventUnderConstruction,
  submissionCollector: any,
  modalSubmission: ModalSubmitInteraction,
  commandInteraction: ChatInputCommandInteraction | ButtonInteraction
) {
  if (submissionInteraction.customId === `${embedId}Edit`) {
    await modalSubmission.deleteReply();
    submissionCollector.stop();
    await showEventModal(event, submissionInteraction);
  } else if (submissionInteraction.customId === `${embedId}Save`) {
    await submissionInteraction.update({
      content: "Saved for later!",
      embeds: [],
      components: [],
    });
    eventsInProgress[submissionInteraction.user.id] = event;

    submissionCollector.stop();
  } else if (submissionInteraction.customId === `${embedId}AddImage`) {
    await modalSubmission.editReply({
      content: "Adding image...",
      embeds: [],
      components: [],
    });

    const imageResponse = await submissionInteraction.reply({
      content: `Hi ${submissionInteraction.user.username}, just reply to this message with your image!`,
      fetchReply: true,
    });

    let replies = await imageResponse.channel.awaitMessages({
      filter: (replyInteraction) =>
        replyInteraction.reference?.messageId === imageResponse.id,
      time: minutesToMilliseconds(1),
      max: 1,
    });

    if (!replies.at(0)) {
      imageResponse.edit("Sorry, you took too long! Please try again.");
      setTimeout(() => imageResponse.delete(), minutesToMilliseconds(1));
      const submissionEmbed = createSubmissionEmbed();
      await modalSubmission.editReply(submissionEmbed);
      return;
    }

    if (replies.at(0)?.attachments.at(0)?.url) {
      event.image = replies.at(0)?.attachments.at(0)?.url as string;
      await replies.at(0)?.delete();
      await imageResponse.delete();
      const submissionEmbed = createSubmissionEmbed();
      submissionEmbed.content = "Image added!";
      await modalSubmission.editReply(submissionEmbed);
    }
  } else if (submissionInteraction.customId === `${embedId}Finish`) {
    const scheduledEndTime = new Date(event.scheduledStartTime);
    scheduledEndTime.setHours(scheduledEndTime.getHours() + event.duration);
    submissionInteraction.guild?.scheduledEvents.create({
      ...event,
      scheduledEndTime,
      entityType: GuildScheduledEventEntityType.External,
    });
    await submissionInteraction.update({
      content: "Event created successfully!",
      embeds: [],
      components: [],
    });
    delete eventsInProgress[submissionInteraction.user.id];

    submissionCollector.stop();
  }
}

function createSubmissionEmbed(): InteractionReplyOptions {
  const submissionEmbed = new EmbedBuilder().setTitle("Creating an event...");
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("Edit")
      .setCustomId(`${embedId}Edit`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Add An Image")
      .setCustomId(`${embedId}AddImage`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Save For Later")
      .setCustomId(`${embedId}Save`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Finish")
      .setCustomId(`${embedId}Finish`)
      .setStyle(ButtonStyle.Primary),
  ]);

  return {
    embeds: [submissionEmbed],
    components: [buttonRow],
    ephemeral: true,
    fetchReply: true,
  };
}
