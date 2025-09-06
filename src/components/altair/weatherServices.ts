// Weather API services
export class WeatherService {
  static async getCurrentWeather(city: string) {
    // Weather API call logic
    console.log(`Fetching weather for ${city}`);
    return {
      city,
      temperature: 22,
      condition: 'Sunny',
      humidity: 65
    };
  }

  static async getForecast(city: string, days: number = 5) {
    // Weather forecast logic
    console.log(`Fetching ${days}-day forecast for ${city}`);
    return [];
  }
}