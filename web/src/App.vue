<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { searchHotels, type HotelOffer } from "./api";

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

const resultCaption = computed(() => {
  if (runId.value === null) return "";
  return `Снимок №${runId.value}: найдено ${offers.value.length}`;
});

function formatPrice(value: number | null, currency: string): string {
  if (value === null) return "Нет цены";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

async function submitSearch() {
  loading.value = true;
  error.value = "";
  try {
    const response = await searchHotels(form);
    offers.value = response.offers;
    runId.value = response.runId;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "Неизвестная ошибка";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="page-shell">
    <header class="hero">
      <p class="eyebrow">Первый прототип</p>
      <h1>HotelScout</h1>
      <p class="hero-copy">
        Проверка публично наблюдаемых цен гостиниц через Google Hotels и SerpApi.
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
      <article v-for="offer in offers" :key="offer.propertyToken ?? offer.name" class="hotel-card">
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
        <div class="price-block">
          <strong>{{ formatPrice(offer.nightlyPrice, offer.currency) }}</strong>
          <span>за ночь</span>
          <span v-if="offer.freeCancellation" class="positive">Бесплатная отмена</span>
        </div>
      </article>
    </section>
  </main>
</template>
