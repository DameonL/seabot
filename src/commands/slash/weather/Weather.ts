import { EmbedBuilder } from "@discordjs/builders";
import {
  APIEmbedField,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import SlashCommand from "../SlashCommand";
import WeatherApi from "./WeatherApi";

import { WeatherResponse } from "../../../models/WeatherModels";
import { toTitleCase } from "../../../utils/strings";
import { createEmbed as createFuckingEmbed, swears } from "./SwearProcessor";

export default new SlashCommand({
  description: "Get current weather",
  help: "weather [98102 | Seattle]",
  name: "weather",
  builder: new SlashCommandBuilder()
    .setName("weather")
    .setDescription("Get current weather for a location")
    .addStringOption((option) =>
      option
        .setName("location")
        .setDescription("string location or zip code")
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("compact")
        .setDescription("Provides a compact view.")
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("sailor")
        .setDescription(
          `Shows weather in ${swears.modifiedAdjective} sailor mode`
        )
        .setRequired(false)
    ),
  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();
    const location = interaction.options.getString("location");
    if (!location) throw new Error("A location must be provided.");

    const compact = interaction.options.getBoolean("compact") ?? undefined;
    const sailor = interaction.options.getBoolean("sailor") ?? undefined;
    const embedBuilder = sailor ? createFuckingEmbed : defaultEmbedBuilder;
    const response = await WeatherApi.getCurrentWeather(location);
    if (!response) {
      interaction.editReply("That's not a valid location!");
      return;
    }

    const { currentWeather, geoInfo } = response;

    const richEmbed = embedBuilder(currentWeather, compact);
    interaction.editReply({ embeds: [richEmbed] });
  },
});

function defaultEmbedBuilder(
  currentWeather: WeatherResponse,
  compact?: boolean
): EmbedBuilder {
  const richEmbed = new EmbedBuilder();
  richEmbed.setTitle(
    toTitleCase(
      `${currentWeather.name} - ${currentWeather.weather[0].description}`
    )
  );
  richEmbed.setThumbnail(
    ` http://openweathermap.org/img/wn/${currentWeather.weather[0].icon}.png`
  );

  const fields: APIEmbedField[] = [];

  fields.push({
    name: `Temperature`,
    value: `${Math.round(currentWeather.main.temp)}° F`,
  });

  if (currentWeather.clouds) {
    fields.push({
      name: `Clouds`,
      value: `${currentWeather.clouds.all}% coverage`,
    });
  }

  fields.push({
    name: `Humidity`,
    value: `${currentWeather.main.humidity}% humidity.`,
  });

  fields.push({
    name: `Wind`,
    value: `${WeatherApi.getWindDirection(currentWeather.wind.deg)} @ ${
      currentWeather.wind.speed
    } mph`,
  });

  if (compact) {
    richEmbed.setDescription(
      fields.map((field) => `**${field.name}:** ${field.value}`).join("\n")
    );
  } else {
    richEmbed.addFields(fields);
  }

  return richEmbed;
}
