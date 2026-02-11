let currentTempC = null;
let currentUnit = "C";
let currentFeelsLikeC = null;
let recentSearches = JSON.parse(localStorage.getItem("recent")) || [];
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// ELEMENTS
const wearEl = document.querySelector(".wear-suggestion");
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

const celsiusBtn = document.getElementById("celsiusBtn");
const fahrenheitBtn = document.getElementById("fahrenheitBtn");

const weatherContainer = document.querySelector(".weather");
const feelsLikeEl = document.querySelector(".feels-like");

// CACHE HELPERS
function getCachedWeather(key) {
  const cached = localStorage.getItem(key);
  if (!cached) return null;

  const parsed = JSON.parse(cached);
  return Date.now() - parsed.timestamp > CACHE_DURATION ? null : parsed.data;
}

function setCachedWeather(key, data) {
  localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
}

// UNIT TOGGLE
celsiusBtn.addEventListener("click", () => setUnit("C"));
fahrenheitBtn.addEventListener("click", () => setUnit("F"));

searchBtn.addEventListener("click", getWeather);
cityInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") getWeather();
});

currentUnit = localStorage.getItem("unit") || "C";

// SET UNIT
function setUnit(unit) {
  currentUnit = unit;
  localStorage.setItem("unit", unit);
  updateTemperature();
  updateFeelsLike();

  celsiusBtn.classList.toggle("active", unit === "C");
  fahrenheitBtn.classList.toggle("active", unit === "F");
}

// LOAD WEATHER BY COORDS (GEOLOCATION)
async function loadWeatherByCoords(lat, lon) {
  loadingEl.classList.remove("hidden");

  try {
    const cacheKey = `weather_${lat}_${lon}`;
    const cachedData = getCachedWeather(cacheKey);
    if (cachedData) {
      updateUI(cachedData, cachedData.city || "Your Location", cachedData.country || "");
      loadingEl.classList.add("hidden");
      return;
    }

   const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode,relativehumidity_2m&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&timezone=auto`
    );


    if (!weatherRes.ok) throw new Error("Weather data unavailable");

    const data = await weatherRes.json();

    // current_weather exists, create fallback for apparent_temperature
    if (!data.current_weather.apparent_temperature) {
      data.current_weather.apparent_temperature = data.current_weather.temperature;
    }

    // Set city/country fallback for geolocation
    const locationName = data.timezone?.split("/")[1]?.replace("_", " ") || "Your Location";
    data.city = locationName;
    data.country = "";

    setCachedWeather(cacheKey, data);

    updateUI(data, data.city, data.country);

  } catch (err) {
    showError("Location access denied");
  } finally {
    loadingEl.classList.add("hidden");
  }
}


// SEARCH BY CITY NAME
async function getWeather() {
  const city = cityInput.value.trim();
  if (!city) return;

  loadingEl.classList.remove("hidden");
  try {
    // Use geocoding API
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
    );
    if (!geoRes.ok) throw new Error("Location not found");

    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) throw new Error("City not found");

    const { latitude, longitude, name, country } = geoData.results[0];

    const cacheKey = `weather_${latitude}_${longitude}`;
    const cachedData = getCachedWeather(cacheKey);
    if (cachedData) {
      updateUI(cachedData, name, country);
      loadingEl.classList.add("hidden");
      return;
    }

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,weathercode,relativehumidity_2m&daily=temperature_2m_max,temperature_2m_min,weathercode,sunrise,sunset&timezone=auto`
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
    loadingEl.classList.add("hidden");
  }
}

// UPDATE UI
function updateUI(data, city, country) {
  const weatherCode = data.current_weather.weathercode;

  animateWeatherUpdate(() => {
    cityEl.textContent = country ? `${city}, ${country}` : city;

    currentTempC = data.current_weather.temperature;
    currentFeelsLikeC = data.current_weather.apparent_temperature || currentTempC;

    updateTemperature();
    updateFeelsLike();

    descEl.textContent = getWeatherDescription(weatherCode);
    const hourIndex = 0;
      humidityEl.textContent =
      data.hourly?.relativehumidity_2m?.[hourIndex] ?? "--";
    windEl.textContent = Math.round(data.current_weather.windspeed || 0);

    const wear = getWearSuggestion(currentTempC, weatherCode);
    document.querySelector(".wear-icon").textContent = wear.icon;
    document.querySelector(".wear-text").textContent = "What to wear: " + wear.text;

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

  if (!recentSearches.includes(city)) {
    recentSearches.unshift(city);
    recentSearches = recentSearches.slice(0, 5);
    localStorage.setItem("recent", JSON.stringify(recentSearches));
  }

  document.querySelector(".recent-searches").classList.toggle(recentSearches.length > 0);
  document.querySelector(".hourly").classList.remove("hidden");

  renderRecent();
  renderHourlyForecast(data.hourly);
  renderDailyForecast(data.daily);
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
  return map[code] || "Unknown";
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

// BACKGROUND
function setBackgroundImage(code) {
  let bg = "assets/images/default.jpg";
  if (code === 0) bg = "assets/images/sunny.jpg";
  else if (code <= 2) bg = "assets/images/overcast.jpg";
  else if (code <= 3) bg = "assets/images/cloudy.jpg";
  else if (code === 45 || code === 48) bg = "assets/images/fog.jpg";
  else if (code >= 51 && code <= 65) bg = "assets/images/drizzle.jpg";
  else if (code >= 71 && code <= 75) bg = "assets/images/snow.jpg";
  else if (code >= 80 && code <= 82) bg = "assets/images/rain.jpg";
  else if (code >= 95) bg = "assets/images/thunder.jpg";

  const img = new Image();
  img.src = bg;
  img.onload = () => {
    document.body.classList.add("bg-transition");
    document.body.style.backgroundImage = `url("${bg}")`;
    setTimeout(() => document.body.classList.remove("bg-transition"), 800);
  };
}

// UPDATE FUNCTIONS
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
    el.textContent = `${Math.round(start + (end - start) * progress)}${unit}`;
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
  const val = currentUnit === "C" ? Math.round(currentFeelsLikeC) : Math.round(currentFeelsLikeC * 9 / 5 + 32);
  feelsLikeEl.textContent = val;
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

// HOURLY FORECAST
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

//WEAR SUGGESTION
function getWearSuggestion(tempC, weatherCode){
  if (tempC === null) return {text: "--", icon: "❓"};

   let icon = "👕";
   let text = "";

   if (tempC <= 0) { text = "Heavy coat, scarf, gloves"; icon = "🧥🧣🧤"; }
    else if (tempC <= 10) { text = "Coat or jacket"; icon = "🧥"; }
    else if (tempC <= 20) { text = "Sweater or light jacket"; icon = "🧶🧥"; }
    else if (tempC <= 30) { text = "T-shirt and pants/shorts"; icon = "👕👖"; }
    else { text = "Shorts and tank top"; icon = "🩳👕"; }


  //Rain-Snow
    if ([45,48,51,53,55,61,63,65,80,81,82].includes   (weatherCode)) {
      text += ", bring an umbrella or raincoat"; icon = "☔🧥"; 
      } else if ([71,73,75].includes(weatherCode)) {
      text += ", wear warm boots"; icon = "🥾🧥"; 
    }

  //sunny
  if (weatherCode === 0) { text += ", sunglasses recommended"; icon += "🕶️"; }

  return { text, icon };
}



// DAILY FORECAST
function renderDailyForecast(daily) {
  if (!daily) return;
  dailyGrid.innerHTML = "";
  for (let i = 0; i < daily.time.length; i++) {
    const date = new Date(daily.time[i]);
    const dayName = date.toLocaleDateString([], { weekday: "short" });
    const min = Math.round(daily.temperature_2m_min[i]);
    const max = Math.round(daily.temperature_2m_max[i]);
    const icon = getWeatherIcon(daily.weathercode[i]);
    const dayEl = document.createElement("div");
    dayEl.className = "day";
    dayEl.innerHTML = `<div>${dayName}</div><img src="${icon}" alt=""><div>${min}° / ${max}°</div>`;
    dailyGrid.appendChild(dayEl);
  }
}

// ON LOAD GEOLOCATION
window.addEventListener("load", () => {
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      pos => loadWeatherByCoords(pos.coords.latitude, pos.coords.longitude),
      () => console.log("Geolocation denied")
    );
  }
});

// INITIAL RENDER
renderRecent();
