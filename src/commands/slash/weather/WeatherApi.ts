import fetch from "node-fetch";
import { URLSearchParams } from "url";

import {
  AirQualityCurrentResponse,
  AirQualityForecastResponse,
  Coord,
  ForecastResponse,
  GeocodeResponse,
  WeatherResponse,
  WeeklyForecastResponse,
} from "../../../models/WeatherModels";
import { Endpoints, Environment } from "../../../utils/constants";

const windDirections = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];


export default class WeatherApi {
  public static getWindDirection(windDegrees: number): string {
    const windAngle = Math.floor(windDegrees / 22.5 + 0.5) % 16;
    return windDirections[windAngle];
  }
  public static async getAirQualityByZip(zip: string) {
    const queryString = this.buildQueryStringForAirQuality(zip);
    const uri = `${Endpoints.airQualityCurrentByZipURL}?${queryString}`;
    return await this.callAPI<AirQualityCurrentResponse>(uri);
  }

  public static async getAirQualityForecastByZip(zip: string) {
    const queryString = this.buildQueryStringForAirQuality(zip);
    const uri = `${Endpoints.airQualityForecastByZipURL}?${queryString}`;
    return await this.callAPI<AirQualityForecastResponse>(uri);
  }

  public static async getCurrentWeather(location: string) {
    const queryString = this.isZip(location)
      ? this.buildQueryStringForZip(location)
      : this.buildQueryStringForLocation(location);

    const uri = `${Endpoints.currentWeatherURL}?${queryString}`;
    const currentWeather = await WeatherApi.callAPI<WeatherResponse>(uri);

    // The weather API encountered an error.
    if (!currentWeather) {
      return undefined;
    }

    const geoInfo = (
      await WeatherApi.reverseGeoByCoord(currentWeather?.coord)
    )?.[0];

    return { currentWeather, geoInfo };
  }

  public static async getWeatherForecast(location: string, weekly = false) {
    const queryString = this.isZip(location)
      ? this.buildQueryStringForZip(location)
      : this.buildQueryStringForLocation(location);

    const uri = `${
      weekly ? Endpoints.weeklyForecastURL : Endpoints.dailyForecastURL
    }?${queryString}`;
    const forecast = await (weekly
      ? WeatherApi.callAPI<WeeklyForecastResponse>(uri)
      : WeatherApi.callAPI<ForecastResponse>(uri));
    if (!forecast?.city?.coord) {
      return;
    }
    const geoInfo = (await this.reverseGeoByCoord(forecast?.city.coord))?.[0];

    return { forecast, geoInfo };
  }

  private static async reverseGeoByCoord(coords: Coord) {
    const queryString = WeatherApi.buildQueryStringForCoords(coords);
    const uri = `${Endpoints.geocodingReverseURL}?${queryString}`;
    return await WeatherApi.callAPI<GeocodeResponse[]>(uri);
  }

  private static isZip(location: string) {
    return !isNaN(parseInt(location));
  }

  private static buildQueryStringForAirQuality(location: string) {
    return new URLSearchParams({
      format: "application/json",
      zipCode: location,
      distance: "50",
      API_KEY: Environment.airQualityAPIKey,
    });
  }

  private static buildQueryStringForLocation(location: string) {
    return new URLSearchParams({
      q: `${location}`,
      units: "imperial",
      appid: Environment.weatherAPIKey,
    });
  }

  private static buildQueryStringForZip(zip: string) {
    return new URLSearchParams({
      zip: `${zip}`,
      units: "imperial",
      appid: Environment.weatherAPIKey,
    });
  }

  private static buildQueryStringForCoords(coords: Coord, limit: number = 1) {
    return new URLSearchParams({
      lat: `${coords.lat}`,
      lon: `${coords.lon}`,
      limit: `${limit}`,
      appid: Environment.weatherAPIKey,
    });
  }

  private static async callAPI<T>(uri: string) {
    const result = await fetch(uri, {
      headers: {
        "User-Agent": "SEABot discord bot",
      },
      method: "GET",
    });
    const data = await result.json();
    // bad response
    if ("cod" in data && data.cod == "404") {
      return null;
    }
    return data as T;
  }
}
