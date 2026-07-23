export const ru = {
  common: {
    back: "Назад",
    retry: "Повторить",
    close: "Закрыть",
    cancel: "Отмена",
    seeAll: "Смотреть все",
    loading: "Загрузка",
  },
  search: {
    placeholder: "Найти заведение, кухню или блюдо",
    recent: "Недавние запросы",
    popular: "Популярные запросы",
    clearHistory: "Очистить историю",
    resultsCount: (count: number) => `Найдено ${count} заведений`,
    filters: "Фильтры",
    filterCuisine: "Кухня",
    filterRating: "Рейтинг",
    filterOpenNow: "Открыто сейчас",
    filterDistance: "Расстояние",
    emptyTitle: "Ничего не нашлось",
    emptyDescription:
      "Попробуйте изменить запрос или сбросить фильтры — так найдётся больше заведений",
    emptyResetFilters: "Сбросить фильтры",
    errorTitle: "Не получилось загрузить",
    errorDescription:
      "Проверьте соединение с интернетом и попробуйте ещё раз",
    loadingTitle: "Ищем заведения…",
    startTypingTitle: "Начните вводить запрос",
    startTypingDescription: "Например: «суши», «Fusion» или «терраса»",
  },
  restaurant: {
    openNow: "Открыто",
    closedNow: "Закрыто",
    closesAt: (time: string) => `Открыто до ${time}`,
    opensAt: (time: string) => `Закрыто до ${time}`,
    cuisineAndPrice: (cuisine: string, price: string) => `${cuisine} · ${price}`,
    reviewsCount: (count: number) => {
      const mod10 = count % 10;
      const mod100 = count % 100;
      let word = "отзывов";
      if (mod100 < 11 || mod100 > 14) {
        if (mod10 === 1) word = "отзыв";
        else if (mod10 >= 2 && mod10 <= 4) word = "отзыва";
      }
      return `${count} ${word}`;
    },
    photosCount: (count: number) => `${count} фото`,
    about: "О заведении",
    workingHours: "Часы работы",
    address: "Адрес",
    tables: "Столики",
    tableFor: (seats: number) => `На ${seats} ${seats === 1 ? "гостя" : "гостей"}`,
    bookTable: "Забронировать столик",
    bookingUnavailable: "Бронирование временно недоступно",
    showOnMap: "Показать на карте",
    photos: "Фотографии",
    photoOf: (index: number, total: number) => `Фото ${index} из ${total}`,
    previousPhoto: "Предыдущее фото",
    nextPhoto: "Следующее фото",
    tabOverview: "Обзор",
    tabPhotos: "Фото",
    photoAllFilter: "Все",
    menuHighlights: "Популярное в меню",
    viewMenu: "Посмотреть меню",
    contacts: "Контакты",
    phoneLabel: "Телефон",
    everydayHours: (opensAt: string, closesAt: string) => `Ежедневно с ${opensAt} до ${closesAt}`,
  },
  nav: {
    overview: "Обзор",
    search: "Поиск",
    bookings: "Бронь",
    favorites: "Избранные",
    profile: "Профиль",
  },
  weekdays: {
    mon: "Понедельник",
    tue: "Вторник",
    wed: "Среда",
    thu: "Четверг",
    fri: "Пятница",
    sat: "Суббота",
    sun: "Воскресенье",
  },
  a11y: {
    closeButton: "Закрыть",
    backButton: "Назад",
    searchClearButton: "Очистить поле поиска",
    favoriteButton: "Добавить в избранное",
    galleryImage: (index: number) => `Изображение ${index}`,
    openFilters: "Открыть фильтры",
    shareButton: "Поделиться",
  },
} as const;

export type Dictionary = typeof ru;
