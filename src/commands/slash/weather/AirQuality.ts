import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Command } from "../../Command";
import WeatherApi from "./WeatherApi";

export default new Command({
    description: 'Get current air quality',
    help: 'aqi 98102',
    name: 'aqi',
    slashCommandDescription: () => {
        return new SlashCommandBuilder()
            .setName('aqi')
            .setDescription('Get current air quality for a location')
            .addNumberOption(option => option.setName('location').setDescription('location zip code').setRequired(true))
    },
    executeSlashCommand: async (interaction) => {
        const location = interaction.options.getNumber('location');
        const isZip = location?.toString().length == 5;
        if (location && isZip) {
          const airQuality = await WeatherApi.getAirQualityByZip(location.toString());
          if (airQuality?.[0]) {
            const forecast = (
              await WeatherApi.getAirQualityForecastByZip(location.toString())
            )?.filter((f) => f.DateForecast === airQuality[0].DateObserved
            )?.[0];
            const embed = new EmbedBuilder({
              title: `Air quality for ${airQuality[0].ReportingArea}, ${airQuality[0].StateCode}`,
              fields: [
                {
                  name: "Observed at:",
                  value: `${airQuality[0].DateObserved}, ${airQuality[0].HourObserved}:00`,
                  inline: false,
                },
                ...airQuality.map((f) => {
                  return {
                    name: `${f.ParameterName}`,
                    value: `**${f.AQI}** - ${f.Category.Name}`,
                    inline: true,
                  };
                }),
                {
                  name: "Description",
                  value: forecast?.Discussion
                    ? `${forecast.Discussion}`
                    : `No forecast description`,
                },
              ],
            });
            interaction.reply({ embeds: [embed] });
          }
        }
    }
});
