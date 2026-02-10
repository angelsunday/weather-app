let currentTempC = null;
let currentUnit = localStorage.getItem("unit") || "C";
let currentFeelsLikeC = null;
let recentSearches = JSON.parse(localStorage.getItem("recent")) || [];
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// ELEMENTS
const dailyGrid = document.querySelector(".daily-grid");
const hourlyGrid = document.querySelector(".hourly-grid");
const recentListEL = document.querySelector(".recent-list");
const sunriseEl = document.querySelector(".sunrise");
const sunsetEl = document.querySelector(".sunset");
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");

const cityEl = document.querySelector(".city");
const tempEl = document.querySelector(".temp");
const descEl = document.querySelector(".description");
const humidityEl = document.querySelector(".humidity");
const windEl = document.querySelector(".wind");
const iconEl = document.querySelector(".weather-icon");
const loadingEl = document.querySelector(".loading");
const feelsLikeEl = document.querySelector(".feels-like");

const celsiusBtn = document.getElementById("celsiusBtn");
const fahrenheitBtn = document.getElementById("fahrenheitBtn");
const weatherContainer = document.querySelector(".weather");

celsiusBtn.addEventListener("click", () => setUnit("C"));
fahrenheitBtn.addEventListener("click", () => setUnit("F"));
searchBtn.addEventListener("click", getWeather);
cityInput.addEventListener("keypress", (e) => { if (e.key === "Enter") getWeather(); });

async function getWeather() {
  const city = cityInput.value.trim();
  if (!city) return;

  loadingEl.style.display = "block";

  try {
    // Geocoding
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`);
    if (!geoRes.ok) throw new Error("Location not found");

    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) throw new Error("City not found");

    const { latitude, longitude, name, country } = geoData.results[0];

    // Weather data
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,weather_code&daily=sunrise,sunset&timezone=auto`
    );
    if (!weatherRes.ok) throw new Error("Weather data unavailable");

    const data = await weatherRes.json();
    data.city = name;
    data.country = country;

    setCachedWeather(cacheKey, data);
    updateUI(data, name, country);

  } catch (error) {
    showError(error.message);
  } finally {
    loadingEl.style.display = "none";
  }
}

// UPDATE UI
function updateUI(data, city, country) {
  const weatherCode = data.current_weather.weathercode;
  animateWeatherUpdate(() => {
    cityEl.textContent = `${city}, ${country}`;

    currentTempC = data.current_weather.temperature;
    currentFeelsLikeC = data.current_weather.apparent_temperature || currentTempC;

    updateTemperature();
    updateFeelsLike();

    descEl.textContent = getWeatherDescription(weatherCode);
    humidityEl.textContent = `${data.current_weather.relativehumidity || "--"}%`;
    windEl.textContent = `${Math.round(data.current_weather.windspeed || 0)} km/h`;

    updateIcon(getWeatherIcon(weatherCode), descEl.textContent);
    setBackgroundImage(weatherCode);

    if (data.daily?.sunrise && data.daily?.sunset) {
      sunriseEl.textContent = formatTime(data.daily.sunrise[0]);
      sunsetEl.textContent = formatTime(data.daily.sunset[0]);
    } else {
      sunriseEl.textContent = "--";
      sunsetEl.textContent = "--";
    }
  });

  document.querySelector(".recent-searches").classList.add("hidden");
  document.querySelector(".hourly").classList.remove("hidden");

  if (!recentSearches.includes(city)) {
    recentSearches.unshift(city);
    recentSearches = recentSearches.slice(0, 5);
    localStorage.setItem("recent", JSON.stringify(recentSearches));
  }

  renderRecent();
  renderHourlyForecast(data.hourly);
}

function showError(message) {
  cityEl.textContent = "Error";
  tempEl.textContent = "-- °C";
  feelsLikeEl.textContent = "--°";
  descEl.textContent = message;
  humidityEl.textContent = "--%";
  windEl.textContent = "-- km/h";
  iconEl.src = "";
}

// WEATHER DESCRIPTIONS & ICONS
function getWeatherDescription(code) {
  const map = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Cloudy",
    45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
    55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    80: "Rain showers", 95: "Thunderstorm"
  };
  return map[code] || "Unknown Weather";
}

function getWeatherIcon(code) {
  if (code === 0) return "assets/icons/clear.png";
  if (code <= 2) return "assets/icons/overcast.png";
  if (code === 3) return "assets/icons/cloudy.png";
  if (code === 45 || code === 48) return "assets/icons/fog.png";
  if (code >= 51 && code <= 55) return "assets/icons/drizzle.png";
  if (code >= 61 && code <= 65) return "assets/icons/rain.png";
  if (code >= 71 && code <= 75) return "assets/icons/snow.png";
  if (code >= 80 && code <= 82) return "assets/icons/rain.png";
  if (code >= 95) return "assets/icons/thunder.png";
  return "assets/icons/unknown.png";
}

function setBackgroundImage(weatherCode) {
  let bg = "assets/images/default.jpg";

  if (weatherCode === 0) bg = "assets/images/sunny.jpg";
  else if (weatherCode <= 2) bg = "assets/images/overcast.jpg";
  else if (weatherCode <= 3) bg = "assets/images/cloudy.jpg";
  else if (weatherCode === 45 || weatherCode === 48) bg = "assets/images/fog.jpg";
  else if (weatherCode >= 51 && weatherCode <= 65) bg = "assets/images/drizzle.jpg";
  else if (weatherCode >= 71 && weatherCode <= 75) bg = "assets/images/snow.jpg";
  else if (weatherCode >= 80 && weatherCode <= 82) bg = "assets/images/rain.jpg";
  else if (weatherCode >= 95) bg = "assets/images/thunder.jpg";

  const img = new Image();
  img.src = bg;
  img.onload = () => {
    document.body.classList.add("bg-transition");
    document.body.style.backgroundImage = `url("${bg}")`;
    setTimeout(() => document.body.classList.remove("bg-fade"), 800);
  };
}

function setUnit(unit) {
  currentUnit = unit;
  localStorage.setItem("unit", unit);
  updateTemperature();
  updateFeelsLike();
  celsiusBtn.classList.toggle("active", unit === "C");
  fahrenheitBtn.classList.toggle("active", unit === "F");
}

function animateWeatherUpdate(callback) {
  weatherContainer.classList.add("fade-out");
  setTimeout(() => {
    callback();
    weatherContainer.classList.remove("fade-out");
    weatherContainer.classList.add("fade-in");
  }, 300);
}

function animateNumber(el, start, end, unit = "") {
  const duration = 400;
  const startTime = performance.now();
  function update(time) {
    const progress = Math.min((time - startTime) / duration, 1);
    const value = Math.round(start + (end - start) * progress);
    el.textContent = `${value}${unit}`;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function updateTemperature() {
  if (currentTempC === null) return;
  const target = currentUnit === "C" ? Math.round(currentTempC) : Math.round(currentTempC * 9 / 5 + 32);
  const current = parseInt(tempEl.textContent) || target;
  animateNumber(tempEl, current, target, `°${currentUnit}`);
}

function updateFeelsLike() {
  if (currentFeelsLikeC === null) return;
  const value = currentUnit === "C" ? Math.round(currentFeelsLikeC) : Math.round(currentFeelsLikeC * 9 / 5 + 32);
  feelsLikeEl.textContent = `${value}°`;
}

function updateIcon(src, alt) {
  iconEl.classList.add("fade");
  setTimeout(() => {
    iconEl.src = src;
    iconEl.alt = alt;
    iconEl.classList.remove("fade");
  }, 200);
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function showError(msg) {
  cityEl.textContent = "Error";
  tempEl.textContent = "-- °C";
  feelsLikeEl.textContent = "--";
  descEl.textContent = msg;
  humidityEl.textContent = "--";
  windEl.textContent = "--";
  iconEl.src = "";
}

// RECENT SEARCHES
function renderRecent() {
  recentListEL.innerHTML = "";
  recentSearches.forEach(city => {
    const li = document.createElement("li");
    li.textContent = city;
    li.onclick = () => { cityInput.value = city; getWeather(); };
    recentListEL.appendChild(li);
  });
}

function renderHourlyForecast(hourly) {
  hourlyGrid.innerHTML = "";
  const now = new Date().getHours();
  if (!hourly) return;
  for (let i = 0; i < hourly.time.length; i++) {
    const hourDate = new Date(hourly.time[i]);
    const hour = hourDate.getHours();
    if (hour >= now && hour < now + 12) {
      const hourEl = document.createElement("div");
      hourEl.className = "hour";
      hourEl.innerHTML = `
        <div>${hour}:00</div>
        <img src="${getWeatherIcon(hourly.weathercode[i])}" alt="">
        <div>${Math.round(hourly.temperature_2m[i])}°</div>
      `;
      hourlyGrid.appendChild(hourEl);
    }
  }
}

renderRecent();
