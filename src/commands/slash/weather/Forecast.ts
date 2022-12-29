import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import moment from "moment";
import { each } from "underscore";

import {
  ForecastResponse,
  WeeklyForecastResponse,
} from "../../../models/WeatherModels";
import SlashCommand from "../SlashCommand";
import WeatherApi from "./WeatherApi";

export default new SlashCommand({
  description: "Get weather forecast in 3-hour intervals",
  help: "forecast [98102 | Seattle] {optional: `weekly`}",
  name: "forecast",
  builder: new SlashCommandBuilder()
    .setName("forecast")
    .setDescription("Get weather forecast in 3-hour intervals")
    .addStringOption((option) =>
      option
        .setName("location")
        .setDescription("string location or zip code")
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("weekly")
        .setDescription("get weekly forecast instead of 3-hour intervals")
    ),
  execute: async (interaction) => {
    const location = interaction.options.getString("location");
    const weekly = interaction.options.getBoolean("weekly") ?? false;
    if (location) {
      await interaction.deferReply();
      const result = await WeatherApi.getWeatherForecast(location);
      if (!result) {
        await interaction.editReply(`Failed to get weather for ${location}`);
        return;
      }
      const { forecast, geoInfo } = result;
      const geoString = (
        geoInfo
          ? [geoInfo.name, geoInfo?.state || null, geoInfo.country]
          : [forecast?.city?.name ?? null, forecast?.city?.country || null]
      )
        .filter((val) => !!val)
        .join(", "); // remove nulls and create string;
      const title = `${weekly ? `Weekly f` : `F`}orecast for ${geoString}`;
      const embed = weekly
        ? buildWeeklyEmbed(forecast as WeeklyForecastResponse, title)
        : buildForecastEmbed(forecast as ForecastResponse, title);
      interaction.editReply({ embeds: [embed] });
      return;
    }

    interaction.reply("You must specify a valid location for the forecast.");
  },
});

function buildForecastEmbed(
  weather: ForecastResponse,
  title: string
): EmbedBuilder {
  const richEmbed = new EmbedBuilder().setTitle(title);
  let { list } = weather;
  each(list.slice(0, 5), (record) => {
    const time = moment.unix(record.dt).utcOffset(-8).format("HH:mm");
    const weather = `${record.main.temp}° F - ${record.weather[0].description}, ${record.main.humidity}% humidity`;
    richEmbed.addFields({
      name: time,
      value: weather,
      inline: false,
    });
  });
  return richEmbed;
}

function buildWeeklyEmbed(
  response: WeeklyForecastResponse,
  title: string
): EmbedBuilder {
  const richEmbed = new EmbedBuilder().setTitle(title);
  let { list } = response;
  each(list.slice(0, 7), (record) => {
    const date = moment
      .unix(record.dt)
      .utcOffset(-8)
      .format("dddd MMMM Do, YYYY");
    const weather = `
              Low ${record.temp.min}° - High ${record.temp.max}°
              ${record.weather[0].description}
              Sunrise: ${moment.unix(record.sunrise).format("HH:mm")}
              Sunset: ${moment.unix(record.sunset).format("HH:mm")}
          `;
    richEmbed.addFields([
      {
        name: date,
        value: weather,
        inline: false,
      },
    ]);
  });
  return richEmbed;
}
