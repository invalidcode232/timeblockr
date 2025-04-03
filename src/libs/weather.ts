import OpenWeatherAPI from 'openweather-api-node';

class WeatherClient {
    client: OpenWeatherAPI;

    constructor() {
        this.client = new OpenWeatherAPI({
            key: process.env.OPENWEATHER_API_KEY,
            units: 'metric',
            locationName: 'Hong Kong',
        });
    }

    getWeather = async () => {
        const weatherData = await this.client.getCurrent();

        return weatherData.weather;
    };

    static getConditionFromId = (conditionId: number) => {
        if (conditionId >= 200) {
            return 'thunderstorm';
        } else if (conditionId >= 300) {
            return 'drizzle';
        } else if (conditionId >= 500) {
            return 'rain';
        } else if (conditionId >= 600) {
            return 'snow';
        } else if (conditionId >= 700) {
            return 'mist';
        } else if (conditionId == 800) {
            return 'clear';
        } else {
            return 'cloudy';
        }
    };
}

export default WeatherClient;
