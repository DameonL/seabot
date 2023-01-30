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
    ChatInputCommandInteraction,
    GuildScheduledEventEntityType,
    GuildScheduledEventPrivacyLevel,
    InteractionCollector,
    ModalBuilder,
    ModalSubmitInteraction,
    TextInputStyle,
} from "discord.js";
import { minutesToMilliseconds } from "../../../utils/Time/conversion";

interface EventUnderConstruction {
    name: string;
    description: string;
    image: string;
    entityMetadata: { location: string };
    scheduledStartTime: Date;
    duration: number;
    privacyLevel: GuildScheduledEventPrivacyLevel;
    embedId: string;
    submissionCollector?: InteractionCollector<ButtonInteraction>;
}

interface UserEventMap {
    [userId: string]: EventUnderConstruction;
}

const eventsInProgress: UserEventMap = {};
const editingTimeoutInMinutes = 30; // No real reason to be too restrictive on this.

type GuildEventAction = "create" | "edit";
const eventActions: GuildEventAction[] = ["create", "edit"];

const eventTypes = Object.keys(GuildScheduledEventEntityType)
    .filter((key) => !isNaN(Number(key)))
    .map((key) => Number(key));

export default new SlashCommand({
    name: "meetup",
    help: "Create or edit a meetup",
    description: "asdf",
    builder: () =>
        new SlashCommandBuilder()
            .setName("meetup")
            .setDescription("Create a meetup")
            .addStringOption((option) => {
                option
                    .setName("action")
                    .setDescription(
                        "Create a new meetup, or edit an existing meetup"
                    );
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
                      name: "New Meetup",
                      description: "Your meetup description",
                      image: "",
                      scheduledStartTime: defaultStartTime,
                      duration: defaultDuration,
                      entityMetadata: { location: "Meetup Location" },
                      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
                      embedId: randomUUID(),
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
    modal.setCustomId(event.embedId);

    const nameInput =
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setLabel("Name")
                .setCustomId(`${event.embedId}_name`)
                .setStyle(TextInputStyle.Short)
                .setValue(event.name)
        );

    const locationInput =
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setLabel("Location")
                .setCustomId(`${event.embedId}_entityMetadata.location`)
                .setStyle(TextInputStyle.Short)
                .setValue(event.entityMetadata.location)
        );

    const descriptionInput =
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setLabel("Description")
                .setCustomId(`${event.embedId}_description`)
                .setStyle(TextInputStyle.Paragraph)
                .setValue(event.description)
        );

    const dateInput =
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
                .setLabel("Date and Time (format: DD/MM/YY HH:MM AM/PM)")
                .setCustomId(`${event.embedId}_scheduledStartTime`)
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
                .setCustomId(`${event.embedId}_duration`)
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
                submitInteraction.customId === event.embedId
            ) {
                return true;
            }

            return false;
        },
    });

    event.name = modalSubmission.fields.getTextInputValue(
        `${event.embedId}_name`
    );
    event.entityMetadata.location = modalSubmission.fields.getTextInputValue(
        `${event.embedId}_entityMetadata.location`
    );
    event.description = modalSubmission.fields.getTextInputValue(
        `${event.embedId}_description`
    );

    const startTime = modalSubmission.fields.getTextInputValue(
        `${event.embedId}_scheduledStartTime`
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
        modalSubmission.fields.getTextInputValue(`${event.embedId}_duration`)
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
                submissionInteraction.customId.startsWith(event.embedId),
            time: minutesToMilliseconds(editingTimeoutInMinutes),
        }) as InteractionCollector<ButtonInteraction>;

    submissionCollector.on(
        "collect",
        async (submissionInteraction: ButtonInteraction) => {
            const handlerName = submissionInteraction.customId.replace(
                `${event.embedId}_button_`,
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
            const submissionEmbed = createSubmissionEmbed(
                event,
                "Image added!"
            );
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
        if (!submissionInteraction.deferred)
            submissionInteraction.deferUpdate();

        await modalSubmission.editReply({
            content: "Creating event...",
            embeds: [],
            components: [],
        });
        const scheduledEndTime = new Date(event.scheduledStartTime);
        scheduledEndTime.setHours(scheduledEndTime.getHours() + event.duration);
        await submissionInteraction.guild?.scheduledEvents.create({
            ...event,
            scheduledEndTime,
            entityType: GuildScheduledEventEntityType.External,
        });
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
            .setCustomId(`${event.embedId}_button_edit`)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setLabel(event.image === "" ? "Add An Image" : "Change Image")
            .setCustomId(`${event.embedId}_button_addImage`)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setLabel("Save For Later")
            .setCustomId(`${event.embedId}_button_save`)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setLabel("Finish")
            .setCustomId(`${event.embedId}_button_finish`)
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setLabel("Cancel")
            .setCustomId(`${event.embedId}_button_cancel`)
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
            .replace(/(?<=\d?\d:\d\d):\d\d/, "")} - ${event.name}`
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
    return previewEmbed;
}
