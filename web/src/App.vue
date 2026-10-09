<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import {
  getHotelHistory,
  searchHotels,
  type HotelHistoryPoint,
  type HotelOffer,
  type HotelSearchRequest,
} from "./api";

function isoDate(offset: number): string {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
}

const form = reactive({
  query: "Hotels in Novosibirsk, Russia",
  checkIn: isoDate(1),
  checkOut: isoDate(2),
  adults: 2,
  children: 0,
  currency: "RUB",
  country: "ru",
  language: "ru",
});

const offers = ref<HotelOffer[]>([]);
const runId = ref<number | null>(null);
const loading = ref(false);
const error = ref("");
const lastSearch = ref<HotelSearchRequest | null>(null);
const selectedHotel = ref<HotelOffer | null>(null);
const history = ref<HotelHistoryPoint[]>([]);
const historyLoading = ref(false);
const historyError = ref("");
const historySection = ref<HTMLElement | null>(null);

const resultCaption = computed(() => {
  if (runId.value === null) return "";
  return `Снимок №${runId.value}: найдено ${offers.value.length}`;
});

const historyStayCaption = computed(() => {
  if (!lastSearch.value) return "";
  return `${lastSearch.value.checkIn} — ${lastSearch.value.checkOut}, гостей: ${
    lastSearch.value.adults + lastSearch.value.children
  }`;
});

const chart = computed(() => {
  if (!history.value.length) return null;

  const width = 720;
  const height = 240;
  const padding = 32;
  const prices = history.value.map((point) => point.nightlyPrice);
  const times = history.value.map((point) => new Date(point.observedAt).getTime());
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const flatPrices = maxPrice === minPrice;
  const priceRange = maxPrice - minPrice || 1;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeRange = maxTime - minTime || 1;

  const points = history.value.map((point, index) => ({
    ...point,
    x:
      history.value.length === 1
        ? width / 2
        : padding + ((times[index]! - minTime) / timeRange) * (width - padding * 2),
    y:
      flatPrices
        ? height / 2
        : height -
          padding -
          ((point.nightlyPrice - minPrice) / priceRange) * (height - padding * 2),
  }));

  return {
    width,
    height,
    minPrice,
    maxPrice,
    points,
    polyline: points.map((point) => `${point.x},${point.y}`).join(" "),
  };
});

function formatPrice(value: number | null, currency: string): string {
  if (value === null) return "Нет цены";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatObservedAt(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

async function submitSearch() {
  loading.value = true;
  error.value = "";
  try {
    const response = await searchHotels(form);
    offers.value = response.offers;
    runId.value = response.runId;
    lastSearch.value = { ...form };
    selectedHotel.value = null;
    history.value = [];
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "Неизвестная ошибка";
  } finally {
    loading.value = false;
  }
}

async function showHistory(offer: HotelOffer) {
  if (!lastSearch.value) return;

  selectedHotel.value = offer;
  historyLoading.value = true;
  historyError.value = "";
  history.value = [];

  await nextTick();
  historySection.value?.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const response = await getHotelHistory(offer, lastSearch.value);
    history.value = response.points;
  } catch (reason) {
    historyError.value =
      reason instanceof Error ? reason.message : "Не удалось получить историю";
  } finally {
    historyLoading.value = false;
  }
}
</script>

<template>
  <main class="page-shell">
    <header class="hero">
      <p class="eyebrow">Мониторинг гостиничных цен</p>
      <h1>HotelScout</h1>
      <p class="hero-copy">
        Сравнение актуальных предложений и накопленной истории цен гостиниц.
      </p>
    </header>

    <section class="panel">
      <form class="search-form" @submit.prevent="submitSearch">
        <label class="field field-wide">
          <span>Город или поисковый запрос</span>
          <input v-model.trim="form.query" required minlength="2" />
        </label>

        <label class="field">
          <span>Заезд</span>
          <input v-model="form.checkIn" type="date" required />
        </label>

        <label class="field">
          <span>Выезд</span>
          <input v-model="form.checkOut" type="date" required />
        </label>

        <label class="field">
          <span>Взрослых</span>
          <input v-model.number="form.adults" type="number" min="1" max="6" required />
        </label>

        <label class="field">
          <span>Детей</span>
          <input v-model.number="form.children" type="number" min="0" max="4" required />
        </label>

        <button class="primary-button" type="submit" :disabled="loading">
          {{ loading ? "Получаем данные…" : "Найти гостиницы" }}
        </button>
      </form>

      <p v-if="error" class="message error-message">{{ error }}</p>
      <p v-if="resultCaption" class="message result-message">{{ resultCaption }}</p>
    </section>

    <section v-if="offers.length" class="results" aria-live="polite">
      <article
        v-for="offer in offers"
        :key="offer.propertyToken ?? offer.name"
        class="hotel-card"
        :class="{ selected: selectedHotel?.propertyToken === offer.propertyToken }"
      >
        <div>
          <p class="hotel-meta">
            <span v-if="offer.hotelClass">{{ offer.hotelClass }}★</span>
            <span v-if="offer.rating">Оценка {{ offer.rating }}</span>
            <span v-if="offer.reviews">{{ offer.reviews }} отзывов</span>
          </p>
          <h2>{{ offer.name }}</h2>
          <p v-if="offer.sourcePrices.length" class="sources">
            Источники:
            {{ offer.sourcePrices.map((item) => item.source).filter(Boolean).join(", ") }}
          </p>
        </div>
        <div class="hotel-actions">
          <div class="price-block">
            <strong>{{ formatPrice(offer.nightlyPrice, offer.currency) }}</strong>
            <span>за ночь</span>
            <span v-if="offer.freeCancellation" class="positive">Бесплатная отмена</span>
          </div>
          <button class="secondary-button" type="button" @click="showHistory(offer)">
            Показать историю
          </button>
        </div>
      </article>
    </section>

    <section v-if="selectedHotel" ref="historySection" class="history-panel">
      <div class="history-heading">
        <div>
          <p class="section-label">История наблюдений</p>
          <h2>{{ selectedHotel.name }}</h2>
        </div>
        <p>{{ historyStayCaption }}</p>
      </div>

      <p v-if="historyLoading" class="history-state">Загружаем историю…</p>
      <p v-else-if="historyError" class="history-state error-message">{{ historyError }}</p>
      <p v-else-if="!history.length" class="history-state">
        Для этих условий пока нет сохранённых наблюдений.
      </p>

      <div v-else-if="chart" class="history-content">
        <div class="chart-summary">
          <div>
            <span>Наблюдений</span>
            <strong>{{ history.length }}</strong>
          </div>
          <div>
            <span>Минимум</span>
            <strong>{{ formatPrice(chart.minPrice, history[0]!.currency) }}</strong>
          </div>
          <div>
            <span>Максимум</span>
            <strong>{{ formatPrice(chart.maxPrice, history[0]!.currency) }}</strong>
          </div>
        </div>

        <div class="chart-wrap">
          <svg
            class="price-chart"
            :viewBox="`0 0 ${chart.width} ${chart.height}`"
            role="img"
            :aria-label="`График цены ${selectedHotel.name}`"
          >
            <line x1="32" y1="208" x2="688" y2="208" class="chart-axis" />
            <line x1="32" y1="32" x2="32" y2="208" class="chart-axis" />
            <polyline
              v-if="chart.points.length > 1"
              :points="chart.polyline"
              class="chart-line"
            />
            <circle
              v-for="point in chart.points"
              :key="point.runId"
              :cx="point.x"
              :cy="point.y"
              r="6"
              class="chart-dot"
            >
              <title>
                {{ formatObservedAt(point.observedAt) }} —
                {{ formatPrice(point.nightlyPrice, point.currency) }}
              </title>
            </circle>
          </svg>
        </div>

        <ol class="history-list">
          <li v-for="point in [...history].reverse()" :key="point.runId">
            <span>{{ formatObservedAt(point.observedAt) }}</span>
            <strong>{{ formatPrice(point.nightlyPrice, point.currency) }}</strong>
            <small>Снимок №{{ point.runId }}</small>
          </li>
        </ol>
      </div>
    </section>
  </main>
</template>
