import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ModalActionRowComponentBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
} from "@discordjs/builders";

import SlashCommand from "../SlashCommand";

import { randomUUID } from "crypto";
import {
  ButtonInteraction,
  ButtonStyle,
  Channel,
  ChannelType,
  ChatInputCommandInteraction,
  Embed,
  ForumChannel,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  InteractionCollector,
  Message,
  ModalBuilder,
  ModalSubmitInteraction,
  TextChannel,
  TextInputStyle,
  ThreadChannel,
  User,
} from "discord.js";
import { minutesToMilliseconds } from "../../../utils/Time/conversion";
import { discordBot } from "../../../server";

interface EventUnderConstruction {
  author: User;
  name: string;
  description: string;
  image: string;
  entityMetadata: { location: string };
  scheduledStartTime: Date;
  duration: number;
  privacyLevel: GuildScheduledEventPrivacyLevel;
  id: string;
  submissionCollector?: InteractionCollector<ButtonInteraction>;
  channelId: string;
}

interface UserEventMap {
  [userId: string]: EventUnderConstruction;
}

const eventsInProgress: UserEventMap = {};
const editingTimeoutInMinutes = 30; // No real reason to be too restrictive on this.

type GuildEventAction = "create" | "edit";
const eventActions: GuildEventAction[] = ["create", "edit"];
const eventTypes = [
  { name: "Meetup", channelId: "1069270901251657849" },
  { name: "Hangout", channelId: "1069679271309758614" },
];

const waitForClient = () => {
  if (discordBot && discordBot.client) {
    const channelToWatch = discordBot.client.channels.cache.get(
      eventTypes[0].channelId
    ) as ForumChannel;
    if (channelToWatch) {
      listenForButtons(channelToWatch);
      return;
    }
  }

  setTimeout(waitForClient, 500);
};

waitForClient();

export default new SlashCommand({
  name: "event",
  help: "Create or edit an event",
  description: "Create or edit an event",
  builder: () =>
    new SlashCommandBuilder()
      .setName("event")
      .setDescription("Create or edit an event")
      .addStringOption((option) => {
        option.setName("type").setDescription("The type of event to schedule");
        option.addChoices(
          ...eventTypes.map((eventType) => {
            return { name: eventType.name, value: eventType.channelId };
          })
        );
        option.setRequired(true);
        return option;
      })
      .addStringOption((option) => {
        option
          .setName("action")
          .setDescription("Create a new meetup, or edit an existing meetup");
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

    const channelId = interaction.options.getString("type") ?? "";

    const defaultStartTime = new Date();
    defaultStartTime.setDate(defaultStartTime.getDate() + 1);
    const defaultDuration = 1;

    var newEvent: EventUnderConstruction =
      interaction.user.id in eventsInProgress
        ? eventsInProgress[interaction.user.id]
        : {
            name: "New Meetup",
            description: "Your meetup description",
            image: "",
            scheduledStartTime: defaultStartTime,
            duration: defaultDuration,
            entityMetadata: { location: "Meetup Location" },
            privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
            id: randomUUID(),
            channelId,
            author: interaction.user,
          };

    eventsInProgress[interaction.user.id] = newEvent;

    await showEventModal(newEvent, interaction);
  },
});

async function showEventModal(
  event: EventUnderConstruction,
  interactionToReply: ChatInputCommandInteraction | ButtonInteraction
) {
  const modal = new ModalBuilder();
  modal.setTitle("Create a New Meetup");
  modal.setCustomId(event.id);

  const nameInput =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Name")
        .setCustomId(`${event.id}_name`)
        .setStyle(TextInputStyle.Short)
        .setValue(event.name)
    );

  const locationInput =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Location")
        .setCustomId(`${event.id}_entityMetadata.location`)
        .setStyle(TextInputStyle.Short)
        .setValue(event.entityMetadata.location)
    );

  const descriptionInput =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Description")
        .setCustomId(`${event.id}_description`)
        .setStyle(TextInputStyle.Paragraph)
        .setValue(event.description)
    );

  const dateInput =
    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
      new TextInputBuilder()
        .setLabel("Date and Time (format: DD/MM/YY HH:MM AM/PM)")
        .setCustomId(`${event.id}_scheduledStartTime`)
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
        .setCustomId(`${event.id}_duration`)
        .setStyle(TextInputStyle.Short)
        .setValue(`${event.duration.toString()}`)
    );

  const components = [
    nameInput,
    locationInput,
    descriptionInput,
    dateInput,
    durationInput,
  ];
  modal.addComponents(components);

  await interactionToReply.showModal(modal);
  const modalSubmission = await interactionToReply.awaitModalSubmit({
    time: minutesToMilliseconds(editingTimeoutInMinutes),
    filter: (submitInteraction, collected) => {
      if (
        submitInteraction.user.id === interactionToReply.user.id &&
        submitInteraction.customId === event.id
      ) {
        return true;
      }

      return false;
    },
  });

  event.name = modalSubmission.fields.getTextInputValue(`${event.id}_name`);
  event.entityMetadata.location = modalSubmission.fields.getTextInputValue(
    `${event.id}_entityMetadata.location`
  );
  event.description = modalSubmission.fields.getTextInputValue(
    `${event.id}_description`
  );

  const startTime = modalSubmission.fields.getTextInputValue(
    `${event.id}_scheduledStartTime`
  );
  if (!/\d\d?\/\d\d?\/\d{2,4}\s+\d\d?:\d\d\s+(am|pm)/i.test(startTime)) {
    await modalSubmission.reply({
      content: "Invalid date format.",
      ephemeral: true,
    });

    eventsInProgress[modalSubmission.user.id] = event;
    return;
  }

  event.scheduledStartTime = new Date(Date.parse(startTime));

  const duration = Number(
    modalSubmission.fields.getTextInputValue(`${event.id}_duration`)
  );
  if (isNaN(duration)) {
    await modalSubmission.reply({
      content: "Invalid duration format.",
      ephemeral: true,
    });

    eventsInProgress[modalSubmission.user.id] = event;
    return;
  }

  event.duration = duration;

  let submissionEmbed = createSubmissionEmbed(event, "");
  await modalSubmission.reply(submissionEmbed);
  event.submissionCollector?.stop();
  event.submissionCollector = undefined;
  event.submissionCollector = getEmbedSubmissionCollector(
    event,
    modalSubmission
  );
}

async function listenForButtons(channel: ForumChannel) {
  for (const thread of channel.threads.cache.values()) {
    listenToThread(thread);
  }
}

async function listenToThread(thread: ThreadChannel) {
  const collector = thread.createMessageComponentCollector({
    filter: (submissionInteraction) =>
      (discordBot.client.user &&
        submissionInteraction.customId.startsWith(
          discordBot.client.user.id
        )) == true,
  }) as InteractionCollector<ButtonInteraction>;

  collector.on("collect", (interaction: ButtonInteraction) => {
    const buttonId = interaction.customId.match(/(?<=_button_).*$/i)?.[0];
    if (!buttonId) throw new Error("Unable to get button ID from customId");

    const handler = buttonHandlers[buttonId];
    if (!handler) throw new Error(`No handler for button ID ${buttonId}`);

    handler(interaction);
  });
}

function getEmbedSubmissionCollector(
  event: EventUnderConstruction,
  modalSubmission: ModalSubmitInteraction
): InteractionCollector<ButtonInteraction> {
  if (!modalSubmission.channel)
    throw new Error("This command needs to be triggered in a channel.");

  if (event.submissionCollector) return event.submissionCollector;

  const submissionCollector =
    modalSubmission.channel.createMessageComponentCollector({
      filter: (submissionInteraction) =>
        submissionInteraction.user.id === modalSubmission.user.id &&
        submissionInteraction.customId.startsWith(event.id),
      time: minutesToMilliseconds(editingTimeoutInMinutes),
    }) as InteractionCollector<ButtonInteraction>;

  submissionCollector.on(
    "collect",
    async (submissionInteraction: ButtonInteraction) => {
      const handlerName = submissionInteraction.customId.replace(
        `${event.id}_button_`,
        ""
      );
      const handler = buttonHandlerMap[handlerName];
      await handler(event, submissionInteraction, modalSubmission);
    }
  );

  submissionCollector.on("end", (collected, reason) => {
    if (reason === "time") {
      modalSubmission.editReply({
        content:
          "Sorry, your event editing timed out! You can continue from where you left off when ready.",
        embeds: [],
        components: [],
      });
    }
  });

  return submissionCollector;
}

const buttonHandlers: {
  [handlerName: string]: (interaction: ButtonInteraction) => void | Promise<void>
} = {
  attending: (interaction: ButtonInteraction) => {
    const attendingEmbed = interaction.message.embeds[1];
    const attendingField = attendingEmbed.fields.find(x => x.name === "Attending");
    if (!attendingField) throw new Error("Unable to find attending field.");

    const userString = `${interaction.user.username} (${interaction.user.id})`;

    let attendees = attendingField.value;
    if (attendees.includes(userString)) {
      interaction.reply({content: "It looks like you're already attending!", ephemeral: true});
      return;
    }

    attendees = `${attendees}\n${userString}`;
    attendingField.value = attendees;
    interaction.reply({content: "Congratulations, you're going!", ephemeral: true});
    interaction.message.edit({ embeds: [interaction.message.embeds[0], attendingEmbed]});
  },
  notAttending: (interaction: ButtonInteraction) => {
    const attendingEmbed = interaction.message.embeds[1];
    const attendingField = attendingEmbed.fields.find(x => x.name === "Attending");
    if (!attendingField) throw new Error("Unable to find attending field.");

    const userString = `${interaction.user.username} (${interaction.user.id})`;

    let attendees = attendingField.value;
    if (!attendees.includes(userString)) {
      interaction.reply({content: "Sorry, I don't see that you're attending!", ephemeral: true});
      return;
    }

    const attendeeArray = attendees.split("\n");
    attendeeArray.splice(attendeeArray.indexOf(userString), 1);

    attendees = attendeeArray.join("\n");
    attendingField.value = attendees;

    interaction.reply({content: "Sorry you can't make it!", ephemeral: true});
    interaction.message.edit({ embeds: [interaction.message.embeds[0], attendingEmbed]});
  }

}

const buttonHandlerMap: {
  [handlerName: string]: (
    event: EventUnderConstruction,
    submissionInteraction: ButtonInteraction,
    modalSubmission: ModalSubmitInteraction
  ) => void;
} = {
  edit: async (
    event: EventUnderConstruction,
    submissionInteraction: ButtonInteraction,
    modalSubmission: ModalSubmitInteraction
  ) => {
    await modalSubmission.deleteReply();
    await showEventModal(event, submissionInteraction);
  },
  addImage: async (
    event: EventUnderConstruction,
    submissionInteraction: ButtonInteraction,
    modalSubmission: ModalSubmitInteraction
  ) => {
    await modalSubmission.editReply({
      content: "Adding image...",
      embeds: [],
      components: [],
    });

    const imageResponse = await submissionInteraction.reply({
      content: `Hi ${submissionInteraction.user.toString()}, just reply to this message with your image!`,
      fetchReply: true,
    });

    let replies = await imageResponse.channel.awaitMessages({
      filter: (replyInteraction) =>
        replyInteraction.reference?.messageId === imageResponse.id,
      time: minutesToMilliseconds(10),
      max: 1,
    });

    if (!replies.at(0)) {
      imageResponse.edit("Sorry, you took too long! Please try again.");
      setTimeout(() => imageResponse.delete(), minutesToMilliseconds(1));
      const submissionEmbed = createSubmissionEmbed(event, "");
      await modalSubmission.editReply(submissionEmbed);
      return;
    }

    if (replies.at(0)?.attachments.at(0)?.url) {
      event.image = replies.at(0)?.attachments.at(0)?.url as string;
      await replies.at(0)?.delete();
      await imageResponse.delete();
      const submissionEmbed = createSubmissionEmbed(event, "Image added!");
      await modalSubmission.editReply(submissionEmbed);
    }
  },
  save: async (
    event: EventUnderConstruction,
    submissionInteraction: ButtonInteraction,
    modalSubmission: ModalSubmitInteraction
  ) => {
    await submissionInteraction.update({
      content: `Saved for later! You can continue from where you left off with "/meetup create". Don't wait too long, or you will have to start over again!`,
      embeds: [],
      components: [],
    });
    eventsInProgress[submissionInteraction.user.id] = event;
    getEmbedSubmissionCollector(event, modalSubmission)?.stop();
  },
  finish: async (
    event: EventUnderConstruction,
    submissionInteraction: ButtonInteraction,
    modalSubmission: ModalSubmitInteraction
  ) => {
    if (!submissionInteraction.deferred) submissionInteraction.deferUpdate();

    await modalSubmission.editReply({
      content: "Creating event...",
      embeds: [],
      components: [],
    });
    //    await createGuildScheduledEvent(event, submissionInteraction);
    await createForumChannelEvent(event, submissionInteraction);

    await modalSubmission.editReply({
      content: "Event created successfully!",
      embeds: [],
      components: [],
    });
    delete eventsInProgress[submissionInteraction.user.id];
    getEmbedSubmissionCollector(event, modalSubmission)?.stop();
  },
  cancel: async (
    event: EventUnderConstruction,
    submissionInteraction: ButtonInteraction,
    modalSubmission: ModalSubmitInteraction
  ) => {
    await modalSubmission.editReply({
      content: "Cancelled event.",
      embeds: [],
      components: [],
    });
    delete eventsInProgress[submissionInteraction.user.id];
    getEmbedSubmissionCollector(event, modalSubmission)?.stop();
  },
};

async function createGuildScheduledEvent(
  event: EventUnderConstruction,
  submissionInteraction: ButtonInteraction
) {
  const scheduledEndTime = new Date(event.scheduledStartTime);
  scheduledEndTime.setHours(scheduledEndTime.getHours() + event.duration);
  await submissionInteraction.guild?.scheduledEvents.create({
    ...event,
    scheduledEndTime,
    entityType: GuildScheduledEventEntityType.External,
  });
}

async function createForumChannelEvent(
  event: EventUnderConstruction,
  submissionInteraction: ButtonInteraction
) {
  const scheduledEndTime = new Date(event.scheduledStartTime);
  scheduledEndTime.setHours(scheduledEndTime.getHours() + event.duration);
  const targetChannel = submissionInteraction.guild?.channels.cache.get(
    event.channelId
  ) as ForumChannel;

  if (targetChannel.type !== ChannelType.GuildForum)
    throw new Error(
      `Channel with ID ${event.channelId} is of type ${targetChannel.type}, but expected a forum channel!`
    );

  if (!targetChannel)
    throw new Error(`Unable to resolve ID ${event.channelId} to a channel.`);

  const threadChannel = await targetChannel.threads.create({
    name: `${event.scheduledStartTime
      .toLocaleString()
      .replace(/(?<=\d?\d:\d\d):\d\d/, " ")} - ${event.name}`,
    message: {
      embeds: [createPreviewEmbed(event), createAttendeesEmbed(event)],
      components: [createAttendanceButtons(event)],
    },
  });

  threadChannel.messages.cache.at(0)?.pin();
  listenToThread(threadChannel);
}

function createAttendanceButtons(
  event: EventUnderConstruction
): ActionRowBuilder<ButtonBuilder> {
  const buttonRow = new ActionRowBuilder<ButtonBuilder>();
  buttonRow.addComponents([
    new ButtonBuilder()
      .setLabel("Attending")
      .setStyle(ButtonStyle.Success)
      .setCustomId(
        `${discordBot.client.user?.id}_${event.id}_button_attending`
      ),
    new ButtonBuilder()
      .setLabel("Not Attending")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(
        `${discordBot.client.user?.id}_${event.id}_button_notAttending`
      ),
  ]);
  return buttonRow;
}

function createSubmissionEmbed(
  event: EventUnderConstruction,
  content: string
): {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
  ephemeral: boolean;
  fetchReply: boolean;
  content: string;
} {
  const submissionEmbed = new EmbedBuilder().setTitle("Creating an event...");
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("Edit")
      .setCustomId(`${event.id}_button_edit`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel(event.image === "" ? "Add An Image" : "Change Image")
      .setCustomId(`${event.id}_button_addImage`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Save For Later")
      .setCustomId(`${event.id}_button_save`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Finish")
      .setCustomId(`${event.id}_button_finish`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setLabel("Cancel")
      .setCustomId(`${event.id}_button_cancel`)
      .setStyle(ButtonStyle.Danger),
  ]);

  return {
    embeds: [submissionEmbed, createPreviewEmbed(event)],
    components: [buttonRow],
    ephemeral: true,
    fetchReply: true,
    content,
  };
}

function createPreviewEmbed(event: EventUnderConstruction): EmbedBuilder {
  const previewEmbed = new EmbedBuilder().setTitle(
    `${event.scheduledStartTime
      .toLocaleString()
      .replace(/(?<=\d?\d:\d\d):\d\d/, " ")} - ${event.name}`
  );
  if (event.image !== "") {
    previewEmbed.setThumbnail(event.image);
  }
  previewEmbed.setDescription(event.description);
  previewEmbed.addFields([
    {
      name: "Location",
      value: event.entityMetadata.location,
      inline: true,
    },
    { name: "Duration", value: `${event.duration} hours`, inline: true },
  ]);
  previewEmbed.setAuthor({
    name: `${event.author.username} (${event.author.id})`,
    iconURL: event.author.avatarURL() ?? "",
  });
//  previewEmbed.setFooter({ text: event.id });
  return previewEmbed;
}

function createAttendeesEmbed(event: EventUnderConstruction): EmbedBuilder {
  const attendeesEmbed = new EmbedBuilder();
  attendeesEmbed.addFields([
    {
      name: "Attending",
      value: `${event.author.username} (${event.author.id})`,
    },
  ]);
  return attendeesEmbed;
}