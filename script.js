let currentTempC = null;
let currentUnit = "C";
let currentFeelsLikeC = null;
let recentSearches = JSON.parse(localStorage.getItem("recent")) || [];

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

celsiusBtn.addEventListener("click", () => setUnit("C"));
fahrenheitBtn.addEventListener("click", () => setUnit("F"));

searchBtn.addEventListener("click", getWeather);
cityInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") getWeather();
});

async function loadWeatherByCoords(lat, lon) {
  loadingEl.style.display = "block";


  try {
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
  );

  if (!weatherRes.ok) throw new Error("Weather data unavailable");

  const data = await weatherRes.json();

  updateUI(data, "Your Location", "");
  } catch (err){
    showError("Location access denied");
  }finally{
    loadingEl.style.display = "none";
  }
}

async function getWeather() {
  const city = cityInput.value.trim();
  if (!city) return;

  loadingEl.style.display = "block"; //show loading
  try {
    //geocoding
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`
    );

    if (!geoRes.ok) throw new Error("Location not found");

    const geoData = await geoRes.json();
    if (!geoData.results) throw new Error("City not found");

    const { latitude, longitude, name, country } = geoData.results[0];

   
   

    //Weather data
   const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code&daily=sunrise,sunset&timezone=auto,temperature_2m_max,temperature_2m_min,weather_code`
    );


    if (!weatherRes.ok) throw new Error("Weather data unavailable");

    const weatherData = await weatherRes.json();
    updateUI(weatherData, name, country);

  } catch (error) {
    showError(error.message);
  }finally {
    loadingEl.style.display="none"; //hide loading
  }
}

function updateUI(data, city, country) {
  const weatherCode = data.current.weather_code;

  animateWeatherUpdate(() => {
    cityEl.textContent = `${city}, ${country}`;
    
    currentTempC = data.current.temperature_2m;
    currentFeelsLikeC = data.current.apparent_temperature;

    updateTemperature();
    updateFeelsLike();
    
    descEl.textContent = getWeatherDescription(weatherCode);
    humidityEl.textContent = data.current.relative_humidity_2m;
    windEl.textContent = Math.round(data.current.wind_speed_10m);

    updateIcon(getWeatherIcon(weatherCode), descEl.textContent);

    setBackgroundImage(weatherCode);

    if (data.daily?.sunrise && data.daily?.sunset) {
      sunriseEl.textContent = formatTime(data.daily.sunrise[0]);
      sunsetEl.textContent = formatTime(data.daily.sunset[0]);
    }else {
      sunriseEl.textContent = "--";
      sunsetEl.textContent = "--";
    }
  });

  document.querySelector(".recent-searches").classList.add("hidden");
  document.querySelector(".hourly").classList.remove("hidden");

  if (!recentSearches.includes(city)){
    recentSearches.unshift(city);
    recentSearches = recentSearches.slice(0 ,5);
    localStorage.setItem("recent", JSON.stringify(recentSearches));
  }
  renderRecent();
  renderHourlyForecast(data.hourly);
  renderDailyForecast(data.daily);

  weatherContainer.scrollIntoView({
    behaviour: "smooth"
  });
}

function showError(message) {
  cityEl.textContent = "Error";
  tempEl.textContent = "-- °C";
  feelsLikeEl.textContent = "--";
  descEl.textContent = message;
  humidityEl.textContent = "--";
  windEl.textContent = "--";
  iconEl.src = "";
}

function getWeatherDescription(code) {
  const map = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Rain showers",
    95: "Thunderstorm"
  };

  return map[code] || "Unknown Weather";
}

function getWeatherIcon(weatherCode) {
  if (weatherCode === 0) return "assets/icons/clear.png";
  if (weatherCode <= 2) return "assets/icons/overcast.png";
  if (weatherCode === 3) return "assets/icons/cloudy.png";
  if (weatherCode === 45 || weatherCode === 48) return "assets/icons/fog.png";
  if (weatherCode >= 51 && weatherCode <= 55) return "assets/icons/drizzle.png";
  if (weatherCode >= 61 && weatherCode <= 65) return "assets/icons/rain.png";
  if (weatherCode >= 71 && weatherCode <= 75) return "assets/icons/snow.png";
  if (weatherCode >= 80 && weatherCode <= 82) return "assets/icons/rain.png";
  if (weatherCode >= 95) return "assets/icons/thunder.png";

  return "assets/icons/unknown.png";
}

//Weather Background
function setBackgroundImage(weatherCode) {
  let bg = "assets/backgrounds/default.jpg";

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

    setTimeout(() => {
      document.body.classList.remove("bg-transition");
    }, 800);
  };
};


// function updateTemperature(){
//   if (currentTempC === null) return;

//   if (currentUnit === "C") {
//     tempEl.textContent = `${Math.round(currentTempC)} °C`;
//   } else {
//     const tempF = currentTempC * 9 / 5 + 32;
//     tempEl.textContent = `${Math.round(tempF)}`;
//   }
// }

currentUnit = localStorage.getItem("unit") || "C";

function setUnit(unit) {
  currentUnit = unit;
  localStorage.setItem("unit", unit);
  updateTemperature();
  updateFeelsLike();

  celsiusBtn.classList.toggle("active", unit === "C");
  fahrenheitBtn.classList.toggle("active", unit === "F");
}

function animateWeatherUpdate(callback){
  weatherContainer.classList.add("fade-out");

  setTimeout(() => {
    callback();
    weatherContainer.classList.remove("fade-out");
    weatherContainer.classList.add("fade-in");
  }, 300);
}

function animateNumber(el, start, end, unit = ""){
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

  const target =
    currentUnit === "C"
      ? Math.round(currentTempC)
      : Math.round(currentTempC * 9 / 5 + 32);

  const current = parseInt(tempEl.textContent) || target;

  animateNumber(tempEl, current, target, `°${currentUnit}`);
}

function updateIcon(src, alt){
  iconEl.classList.add("fade");

  setTimeout(() => {
    iconEl.src = src;
    iconEl.alt = alt;
    iconEl.classList.remove("fade");
  }, 200);
}

function updateFeelsLike(){
  if(currentFeelsLikeC === null) return;

  if(currentUnit === "C") {
    feelsLikeEl.textContent = Math.round(currentFeelsLikeC);
  } else {
    const feelsLikeF = currentFeelsLikeC * 9 / 5 + 32;
    feelsLikeEl.textContent = Math.round(feelsLikeF);
  }
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderRecent() {
  recentListEL.innerHTML = "";
  recentSearches.forEach(city => {
    const li = document.createElement("li");
    li.textContent = city;
    li.onclick = () => {
      cityInput.value = city;
      getWeather();
    };
    recentListEL.appendChild(li);
  });
}

renderRecent();

function renderHourlyForecast(hourly) {
  hourlyGrid.innerHTML = "";

  const now = new Date().getHours();

  for (let i = 0; i < hourly.time.length; i++) {
    const hourDate = new Date(hourly.time[i]);
    const hour = hourDate.getHours();

    if (hour >= now && hour < now + 12) {
      const hourEl = document.createElement("div");
      hourEl.className = "hour";

      hourEl.innerHTML = `
        <div>${hour}:00</div>
        <img src="${getWeatherIcon(hourly.weather_code[i])}" alt="">
        <div>${Math.round(hourly.temperature_2m[i])}°</div>
      `;

      hourlyGrid.appendChild(hourEl);
    }
  }
}

function renderDailyForecast(daily){
  dailyGrid.innerHTML = "";

  for (let i = 0; i < daily.time.length; i++){
    const date = new Date(daily.time[i]);

    const dayName = date.toLocaleDateString([], {
      weekday: "short"
    });

    const max = Math.round(daily.temperature_2m_max[i]);
    const min = Math.round(daily.temperature_2m_min[i]);

    const icon = getWeatherIcon(daily.weather_code[i]);

    const dayEl = document.createElement("div");
    dayEl.className = "day";

    dayEl.innerHTML = `
      <div>${dayName}</div>
      <img src="${icon}" alt="">
      <div>${min}° / ${max}°</div>
      `;

      dailyGrid.appendChild(dayEl);
  }
}

window.addEventListener("load", () => {
  if("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        loadWeatherByCoords(
          pos.coords.latitude,
          pos.coords.longitude
        );
      },
      () => {
        console.log("Geolocation denied");
      }
    );
  }
});


