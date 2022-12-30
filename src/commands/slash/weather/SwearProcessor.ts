import { APIEmbedField, EmbedBuilder } from "discord.js";

import { WeatherResponse } from "../../../models/WeatherModels";
import { discordBot } from "../../../seabot";
import { capitalize, toTitleCase } from "../../../utils/strings";
import WeatherApi from "./WeatherApi";

export function createEmbed(
  currentWeather: WeatherResponse,
  compact?: boolean
): EmbedBuilder {
  const richEmbed = new EmbedBuilder();
  richEmbed.setTitle(
    toTitleCase(
      `${currentWeather.name} - ${swears.weatherCodeDescription(
        currentWeather.weather[0].id
      )}`
    )
  );
  richEmbed.setThumbnail(
    ` http://openweathermap.org/img/wn/${currentWeather.weather[0].icon}.png`
  );

  const fields: APIEmbedField[] = [];

  fields.push({
    name: `Temperature`,
    value: `${weatherPhrases.temperatureDescription(
      currentWeather.main.temp
    )} (${Math.round(currentWeather.main.temp)}° F)`,
  });

  if (currentWeather.clouds) {
    fields.push({
      name: `Clouds`,
      value: `${weatherPhrases.cloudDescription(currentWeather.clouds.all)} (${
        currentWeather.clouds.all
      }% coverage)`,
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

function randomArrayElement<T>(array: T[]): T {
  return array[Math.round(Math.random() * (array.length - 1))];
}

function getFromArray(
  minimum: number,
  array: [number, string | string[]][]
): string {
  for (const member of array) {
    if (minimum <= member[0]) {
      if (Array.isArray(member[1])) {
        return randomArrayElement<string>(member[1]);
      }

      return member[1];
    }
  }

  throw new Error(`Unable to get response for minimum of ${minimum}`);
}

const swears = {
  weatherCategoryDescription(category: string): string {
    category = category.toLowerCase();
    const categoryDescriptions: {
      [category: string]: string | string[] | undefined;
    } = {
      drizzle: [`${swears.modifiedAdjective} drizzle.`],
      thunderstorm: [`thunderstorm`],
      rain: [`rain`],
      mist: [`mist`],
      smoke: [`smoke`],
      fog: [`fog`],
      clear: [`clear`],
      clouds: [`clouds`],
    };

    const description = categoryDescriptions[category];
    if (!description) return "";
    return Array.isArray(description)
      ? randomArrayElement(description)
      : description;
  },
  weatherCodeDescription(weatherCode: number) {
    const codes: {
      [index: number]: { category: string; description: string | string[] };
    } = {
      200: {
        category: "Thunderstorm",
        description: "thunderstorm with light rain",
      },
      201: { category: "Thunderstorm", description: "thunderstorm with rain" },
      202: {
        category: "Thunderstorm",
        description: "thunderstorm with heavy rain",
      },
      210: { category: "Thunderstorm", description: "light thunderstorm" },
      211: { category: "Thunderstorm", description: "thunderstorm" },
      212: { category: "Thunderstorm", description: "heavy thunderstorm" },
      221: { category: "Thunderstorm", description: "ragged thunderstorm" },
      230: {
        category: "Thunderstorm",
        description: "thunderstorm with light drizzle",
      },
      231: {
        category: "Thunderstorm",
        description: "thunderstorm with drizzle",
      },
      232: {
        category: "Thunderstorm",
        description: "thunderstorm with heavy drizzle",
      },
      300: { category: "Drizzle", description: "light intensity drizzle" },
      301: { category: "Drizzle", description: "drizzle" },
      302: { category: "Drizzle", description: "heavy intensity drizzle" },
      310: { category: "Drizzle", description: "light intensity drizzle rain" },
      311: { category: "Drizzle", description: "drizzle rain" },
      312: { category: "Drizzle", description: "heavy intensity drizzle rain" },
      313: { category: "Drizzle", description: "shower rain and drizzle" },
      314: {
        category: "Drizzle",
        description: "heavy shower rain and drizzle",
      },
      321: { category: "Drizzle", description: "shower drizzle" },
      500: {
        category: "Rain",
        description: `${capitalize(
          swears.modifiedAdjective
        )} rain. Drizzling all over me.`,
      },
      501: { category: "Rain", description: "moderate rain" },
      502: { category: "Rain", description: "heavy intensity rain" },
      503: { category: "Rain", description: "very heavy rain" },
      504: { category: "Rain", description: "extreme rain" },
      511: { category: "Rain", description: "freezing rain" },
      520: { category: "Rain", description: "light intensity shower rain" },
      521: { category: "Rain", description: "shower rain" },
      522: { category: "Rain", description: "heavy intensity shower rain" },
      531: { category: "Rain", description: "ragged shower rain" },
      600: { category: "Snow", description: "light snow" },
      601: { category: "Snow", description: "Snow" },
      602: { category: "Snow", description: "Heavy snow" },
      611: { category: "Snow", description: "Sleet" },
      612: { category: "Snow", description: "Light shower sleet" },
      613: { category: "Snow", description: "Shower sleet" },
      615: { category: "Snow", description: "Light rain and snow" },
      616: { category: "Snow", description: "Rain and snow" },
      620: { category: "Snow", description: "Light shower snow" },
      621: { category: "Snow", description: "Shower snow" },
      622: { category: "Snow", description: "Heavy shower snow" },
      701: { category: "Mist", description: "mist" },
      711: { category: "Smoke", description: "Smoke" },
      721: { category: "Haze", description: "Haze" },
      731: { category: "Dust", description: "sand/ dust whirls" },
      741: { category: "Fog", description: "fog" },
      751: { category: "Sand", description: "sand" },
      761: { category: "Dust", description: "dust" },
      762: { category: "Ash", description: "volcanic ash" },
      771: { category: "Squall", description: "squalls" },
      781: { category: "Tornado", description: "tornado" },
      800: { category: "Clear", description: "clear sky" },
      801: { category: "Clouds", description: "few clouds: 11-25%" },
      802: { category: "Clouds", description: "scattered clouds: 25-50%" },
      803: { category: "Clouds", description: "broken clouds: 51-84%" },
      804: {
        category: "Clouds",
        description: [
          `Oh look it's overcast. It's always ${swears.modifiedAdjective} overcast. I can't remember the last time I saw the sun.`,
          `${capitalize(
            swears.modifiedAdjective
          )} grey. Nothing but grey as far as the eye can see.`,
        ],
      },
    };

    const description = codes[weatherCode].description;

    return Array.isArray(description)
      ? randomArrayElement(description)
      : description;
  },
  get verb(): string {
    const verbs = ["fuck", "shit on"];
    return randomArrayElement(verbs);
  },
  get adverb(): string {
    const adverbs = ["fucking", "shitting", "goddamn"];
    return randomArrayElement(adverbs);
  },
  get modifiedAdjective(): string {
    const adjectives = ["fucking", "shitting", "assing", "crappy"];
    return randomArrayElement(adjectives);
  },
  get noun(): string {
    const nouns = [
      "fuck",
      "shit",
      "ass",
      "monkey balls",
      "clown wank",
      "bullshit",
      "god",
    ];
    return randomArrayElement(nouns);
  },
  get coldSimile(): string {
    const similes = [
      `${swears.modifiedAdjective} fuck`,
      `${swears.modifiedAdjective} shit`,
      `satan's asshole`,
      `a warlock's nuts`,
    ];
    return randomArrayElement(similes);
  },
  get exclamation(): string {
    const exclamations = [
      `What the ${swears.noun}?`,
      `${randomArrayElement(["Oh", "Well"])} ${swears.verb} me.`,
      `Look at this ${swears.noun}!`,
      `Oh my ${swears.modifiedAdjective} ${swears.noun}!`,
      `Son of a ${swears.modifiedAdjective} ${swears.noun}!`,
    ];

    return randomArrayElement(exclamations);
  },
};

const weatherPhrases = {
  temperatureDescription(temperature: number) {
    const temperatures: [number, string | string[]][] = [
      [-20, [`This is way too ${swears.modifiedAdjective} cold.`]],
      [
        -10,
        [
          `It is colder than ${swears.coldSimile}.`,
          `This is too ${swears.modifiedAdjective} cold.`,
        ],
      ],
      [0, [`It's literally below ${swears.modifiedAdjective} zero.`]],
      [15, [`Getting colder than ${swears.coldSimile}.`]],
      [31, [`Just below freezing.`]],
      [32, ["It's literally freezing."]],
      [
        50,
        [
          `It's cold but not cold enough to be fun? ${capitalize(
            swears.adverb
          )} ${swears.noun}.`,
        ],
      ],
      [69, `${capitalize(swears.modifiedAdjective)} near perfect.`],
      [
        70,
        `${discordBot.client.emojis.cache
          .find((x) => x.name === "nice")
          ?.toString()}`,
      ],
      [80, `Too ${swears.adverb} hot.`],
      [90, "Sweltering."],
      [100, `Hot as ${swears.noun}.`],
      [110, "Deadly hot."],
    ];

    return `${swears.exclamation} ${getFromArray(temperature, temperatures)}`;
  },

  cloudDescription(coverage: number): string {
    const cloudCoverNouns: [number, string | string[]][] = [
      [10, [`${capitalize(swears.noun)}. The sun has arrived.`]],
      [25, [`Now we have to deal with the sun? This is ${swears.noun}.`]],
      [50, [`Hide your children. The Radioactive orb is coming.`]],
      [
        85,
        [
          `What the ${swears.noun} are these blue cracks in the ${swears.modifiedAdjective} sky?`,
        ],
      ],
      [
        100,
        [
          `The sky is a featureless grey, as it should be.`,
          `We are shielded from the radioactive orb. We are safe.`,
        ],
      ],
    ];

    return `${getFromArray(coverage, cloudCoverNouns)}`;
  },
};

export { swears, weatherPhrases };
