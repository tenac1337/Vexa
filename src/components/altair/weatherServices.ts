import { WEATHERSTACK_ACCESS_KEY, WEATHERSTACK_API_BASE_URL } from './constants';
import { WeatherData } from './types';

export async function fetchWeatherData(city: string, units: 'm' | 's' | 'f' = 'm'): Promise<WeatherData> {
  const apiUrl = `${WEATHERSTACK_API_BASE_URL}/current?access_key=${WEATHERSTACK_ACCESS_KEY}&query=${encodeURIComponent(city)}&units=${units}`;
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) { 
      return { 
        success: false, 
        error: `Network error fetching weather from Weatherstack for '${city}'. Status: ${response.status} ${response.statusText}`, 
        details: `URL: ${apiUrl}` 
      }; 
    }
    const data = await response.json();
    if (data.success === false || data.error) { 
      const apiError = data.error || { info: "Unknown Weatherstack API error." }; 
      console.error("Weatherstack API Error:", apiError); 
      return { 
        success: false, 
        error: `Weatherstack API error for '${city}': ${apiError.info || 'Failed to fetch weather data.'}`, 
        code: apiError.code, 
        type: apiError.type, 
        details: `Query: ${city}, Units: ${units}` 
      }; 
    }
    if (!data.location || !data.current) { 
      return { 
        success: false, 
        error: `Incomplete data received from Weatherstack for '${city}'. Location or current weather missing.`, 
        details: `Query: ${city}, Units: ${units}` 
      };
    }
    const { location, current } = data;
    const unitSymbol = units === 'f' ? '°F' : (units === 's' ? 'K' : '°C');
    const speedUnit = units === 'f' ? 'mph' : (units === 's' ? 'm/s' : 'km/h');
    const summary = `Current weather in ${location.name}, ${location.country}: ${current.temperature}${unitSymbol}, ${current.weather_descriptions ? current.weather_descriptions.join(', ') : 'N/A'}. Wind: ${current.wind_speed} ${speedUnit} from ${current.wind_dir}. Humidity: ${current.humidity}%. Feels like: ${current.feelslike}${unitSymbol}.`;
    return { 
      success: true, 
      location: `${location.name}, ${location.region ? location.region + ', ' : ''}${location.country}`, 
      temperature: `${current.temperature}${unitSymbol}`, 
      weather_descriptions: current.weather_descriptions || ["N/A"], 
      wind_speed: `${current.wind_speed} ${speedUnit}`, 
      wind_dir: current.wind_dir, 
      pressure: current.pressure, 
      precip: current.precip, 
      humidity: `${current.humidity}%`, 
      cloudcover: `${current.cloudcover}%`, 
      feelslike: `${current.feelslike}${unitSymbol}`, 
      visibility: current.visibility, 
      uv_index: current.uv_index, 
      api_response_current: current, 
      summary: summary 
    };
  } catch (err: any) { 
    console.error(`Error in fetchWeatherData (Weatherstack) for city "${city}":`, err); 
    return { 
      success: false, 
      error: `An unexpected error occurred while fetching weather via Weatherstack for '${city}': ${err.message || "Unknown client-side error"}`, 
      details: `Query: ${city}, Units: ${units}` 
    }; 
  }
} 