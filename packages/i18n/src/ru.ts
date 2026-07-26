/**
 * Русская форма слова «гость» для числа. Живёт здесь, а не в компоненте:
 * склонение — часть словаря, а не разметки.
 */
function guestsWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return "гостей";
  if (mod10 === 1) return "гость";
  if (mod10 >= 2 && mod10 <= 4) return "гостя";
  return "гостей";
}

export const ru = {
  common: {
    back: "Назад",
    retry: "Повторить",
    close: "Закрыть",
    cancel: "Отмена",
    seeAll: "Смотреть все",
    loading: "Загрузка",
  },
  /**
   * Главный экран (Explore). Переехало сюда из
   * apps/mobile/src/components/explore/copy.ts без изменения формулировок.
   *
   * Макет на английском («Popular Restaurants», «Chef's Picks», «Restaurant,
   * cuisine, or dish»), интерфейс приложения русский, поэтому заголовки
   * секций переведены, а «Гастрогид» оставлен именем собственным.
   */
  explore: {
    searchPlaceholder: "Заведение, кухня или блюдо",

    popularTitle: "Популярные заведения",
    popularLoading: "Загружаем заведения…",
    popularEmptyTitle: "Пока нечего показать",
    popularEmptyDescription: "Загляните в поиск — там есть весь каталог",
    popularEmptyAction: "Открыть поиск",
    popularErrorTitle: "Заведения не загрузились",
    popularErrorDescription: "Проверьте соединение и попробуйте ещё раз",

    chefsPicksTitle: "Выбор шефа",
    gastroguideTitle: "Гастрогид",
    eventsTitle: "События",
    eventsLoading: "Загружаем события…",
    /** Пустая секция — это НОРМАЛЬНЫЙ ответ /events: возвращаются только
     * опубликованные и ещё не прошедшие события активных заведений, и сегодня
     * на тестовом бэкенде их ноль. Формулировка объясняет причину, а не
     * извиняется за поломку. */
    eventsEmptyTitle: "Ближайших событий нет",
    eventsEmptyDescription:
      "Заведения пока не анонсировали ужины, бранчи и вечеринки. Появятся — покажем здесь",
    eventsErrorTitle: "События не загрузились",
    eventsErrorDescription: "Проверьте соединение и попробуйте ещё раз",
    /** Метка карточки для скринридера: «Ужин с шефом, 28 июля, 19:00, Дастархан». */
    eventCard: (title: string, when: string, restaurant: string) =>
      restaurant ? `${title}, ${when}, ${restaurant}` : `${title}, ${when}`,

    /** Строка под названием заведения на карточке: «Сегодня · 2 гостя». */
    todayGuests: (guests: number) => `Сегодня · ${guests} ${guestsWord(guests)}`,
    slotsUnavailable: "Сегодня свободного времени нет",
    slotsFailed: "Время не загрузилось",

    favoriteAdd: (name: string) => `Добавить «${name}» в избранное`,
    favoriteRemove: (name: string) => `Убрать «${name}» из избранного`,
    bookAt: (name: string, time: string) => `Забронировать в «${name}» на ${time}`,
    heroBanner: (index: number, total: number) => `Баннер ${index} из ${total}`,
    sectionSeeAll: (section: string) => `${section}: смотреть все`,
  },
  /**
   * Экран поиска, он же каталог. Подсказок «Недавние/Популярные запросы»
   * больше нет: в API нет истории поиска и нет популярных запросов, а три
   * зашитые фразы («Грузинская кухня», «Паназиатская кухня», «Веранда»)
   * давали ноль результатов на живом каталоге. Пустой запрос показывает
   * реальный список заведений, поэтому строки startTyping* тоже удалены —
   * состояния «начните вводить» на экране больше не существует.
   */
  search: {
    placeholder: "Найти заведение, кухню или блюдо",
    resultsCount: (count: number) => {
      const mod10 = count % 10;
      const mod100 = count % 100;
      let word = "заведений";
      if (mod100 < 11 || mod100 > 14) {
        if (mod10 === 1) word = "заведение";
        else if (mod10 >= 2 && mod10 <= 4) word = "заведения";
      }
      return `${count} ${word}`;
    },
    /** Ряды чипов подписей не имеют — в словаре остаются только те строки,
     * которые действительно рисуются на экране. */
    filterOpenNow: "Открыто сейчас",
    /** Фильтр выключен по умолчанию: 17 заведений из 24 онлайн-бронь не
     * принимают, и спрятать их молча — это враньё умолчанием. Каталог
     * показывает всех, а гость сам решает, сузить ли список. */
    filterOnlineBookable: "Бронь онлайн",
    /** Вторая строка заголовка списка: сколько из показанных заведений
     * реально можно забронировать в приложении. Ставится только когда таких
     * меньше, чем всего, — иначе это шум. */
    onlineBookableCount: (bookable: number, total: number) =>
      `Забронировать онлайн можно в ${bookable} из ${total} — в остальные звоните напрямую`,
    onlineBookableNone: "Ни одно из этих заведений не принимает онлайн-бронь — им нужно звонить",
    filterCuisinesFailed: "Кухни не загрузились — повторить",
    emptyTitle: "Ничего не нашлось",
    emptyDescription:
      "Попробуйте изменить запрос или сбросить фильтры — так найдётся больше заведений",
    emptyResetFilters: "Сбросить фильтры",
    errorTitle: "Не получилось загрузить",
    errorDescription:
      "Проверьте соединение с интернетом и попробуйте ещё раз",
    loadingTitle: "Ищем заведения…",
    /** Пустой каталог — это не «ничего не нашлось»: сбрасывать нечего. */
    catalogEmptyTitle: "Каталог пока пуст",
    catalogEmptyDescription: "Заведения появятся здесь, как только их добавят",
  },
  restaurant: {
    /** «Открыто» / «Закрыто» — это ОТВЕТ СЕРВЕРА (`schedule.open_now`,
     * посчитанный в таймзоне заведения), а не наш вывод из часов. Третье
     * состояние обязательно: у заведения может не быть графика вообще, и это
     * «не знаем», а не «закрыто». */
    openNow: "Открыто",
    closedNow: "Закрыто",
    hoursUnknownShort: "Часы работы не указаны",
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
    /* --- онлайн-бронь: `accepts_online_bookings` ---------------------------
     * Не «временно недоступно» и не «всё занято»: сервер по такому заведению
     * не выдаст слот НИ НА ОДНУ дату. Говорим это до выбора даты и сразу даём
     * рабочий выход — телефон заведения. */
    bookingUnavailableTitle: "Онлайн-бронь здесь не работает",
    bookingUnavailableDescription:
      "Это заведение пока не принимает брони через приложение — свободного времени не будет ни на одну дату. Столик можно забронировать по телефону.",
    bookingUnavailableNoPhone:
      "Это заведение пока не принимает брони через приложение, а телефон в каталоге не указан.",
    bookingUnavailableAction: "Онлайн-бронь недоступна",
    callToBook: "Позвонить в заведение",
    /** Метка на карточке в каталоге. Короткая: рядом с кухней и ценой. */
    phoneOnlyBadge: "Только по телефону",
    showOnMap: "Показать на карте",
    photos: "Фотографии",
    photoOf: (index: number, total: number) => `Фото ${index} из ${total}`,
    previousPhoto: "Предыдущее фото",
    nextPhoto: "Следующее фото",
    tabOverview: "Обзор",
    tabPhotos: "Фото",
    photoAllFilter: "Все",
    /** Заголовок ленты блюд. Флага «популярное» в API нет — это первые
     * доступные блюда в том порядке, в котором их завело само заведение. */
    menuHighlights: "Из меню",
    menuEmpty: "Заведение ещё не добавило меню",
    /** Экран меню целиком, открывается с карточки заведения. */
    menuTitle: "Меню",
    menuLoading: "Загружаем меню…",
    menuErrorTitle: "Меню не загрузилось",
    menuOtherSection: "Другое",
    menuDishUnavailable: "Сейчас нет в наличии",
    menuDishNoPrice: "Цену уточняйте в заведении",
    menuPreorderNote: "Заказать блюда можно при бронировании столика",
    photosEmptyTitle: "Пока нет фотографий",
    photosEmptyDescription: "Заведение ещё не загрузило снимки — они появятся здесь",
    rating: (average: number) => `★ ${average.toFixed(1)}`,
    viewMenu: "Посмотреть меню",
    contacts: "Контакты",
    phoneLabel: "Телефон",
    /**
     * Недельный график. Приходит с сервера уже разложенным по дням, клиент
     * ничего не парсит и ничего не достраивает.
     *
     * Четыре РАЗНЫХ строки, которые нельзя путать:
     *   `range` — обычный день;
     *   `rangeNextDay` / `untilMidnight` — работа за полночь (12:00–01:00 —
     *      это тринадцать часов, а не один);
     *   `dayOff` — сервер сказал, что день нерабочий;
     *   `unknownDay` — дня в ответе нет, про него ничего не известно.
     */
    schedule: {
      today: "сегодня",
      range: (from: string, to: string) => `${from} – ${to}`,
      rangeNextDay: (from: string, to: string) => `${from} – ${to} следующего дня`,
      /** Закрытие ровно в 00:00 с флагом «за полночь». Числа те же, что в
       * обычной строке, чтобы колонка читалась как таблица, а «(полночь)»
       * снимает вопрос, конец это дня или его начало. */
      untilMidnight: (from: string) => `${from} – 00:00 (полночь)`,
      openTimeUnknown: "Открыто, время не указано",
      dayOff: "Выходной",
      unknownDay: "Не указано",
      /** Заведение без графика целиком. Никогда не «закрыто». */
      unknownTitle: "Часы работы не указаны",
      unknownDescription:
        "Заведение ещё не передало график работы. Уточните время по телефону.",
      /** Свободнотекстовая строка самого заведения — единственное, что есть,
       * когда графика нет. Подписана как слова заведения, а не как факт,
       * который проверил сервис. */
      venueOwnWords: (line: string) => `Со слов заведения: ${line}`,
      /** Показывается только у заведения в другом часовом поясе. */
      timezoneNote: (timezone: string) => `Время местное для заведения (${timezone})`,
    },
    shareText: (name: string, address: string) =>
      address ? `${name} — ${address}` : name,
    /** Тот же текст, что у сердечка на карточках Explore: одна и та же кнопка
     * должна и звучать одинаково — это буквально одно и то же избранное. */
    favoriteAdd: (name: string) => `Добавить «${name}» в избранное`,
    favoriteRemove: (name: string) => `Убрать «${name}» из избранного`,
    favoriteFailed: "Не получилось сохранить — попробуйте ещё раз",
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
  admin: {
    appName: "BookEat · Панель ресторана",
    nav: {
      bookings: "Брони",
      menu: "Меню",
      schedule: "Расписание",
      events: "События",
      promos: "Акции",
      guests: "Гости",
      settings: "Настройки",
      soon: "Скоро",
    },
    common: {
      retry: "Повторить",
      loading: "Загрузка…",
      save: "Сохранить",
      saving: "Сохраняем…",
      cancel: "Отмена",
      apply: "Применить",
      logout: "Выйти",
      create: "Создать",
      edit: "Изменить",
      delete: "Удалить",
      deleting: "Удаляем…",
      close: "Закрыть",
      confirmDelete: "Удалить безвозвратно?",
      required: "Заполните обязательные поля",
      errorTitle: "Не удалось загрузить",
      errorDescription: "Проверьте соединение и попробуйте ещё раз",
      saveFailed: "Не удалось сохранить. Попробуйте ещё раз",
      deleteFailed: "Не удалось удалить. Попробуйте ещё раз",
    },
    login: {
      title: "Вход для персонала",
      subtitle: "Войдите рабочей почтой, чтобы управлять бронями и меню",
      emailLabel: "Электронная почта",
      emailPlaceholder: "manager@restaurant.kz",
      passwordLabel: "Пароль",
      passwordPlaceholder: "Введите пароль",
      submit: "Войти",
      submitting: "Входим…",
      invalidCredentials: "Неверная почта или пароль",
      genericError: "Не удалось войти. Попробуйте ещё раз",
    },
    restaurant: {
      switch: "Сменить заведение",
      switchAria: "Сменить заведение",
      current: "Текущее заведение",
      pickTitle: "Ваши заведения",
      pickSubtitle: "Выберите заведение, чтобы открыть панель управления",
      loadingList: "Загружаем ваши заведения…",
      emptyTitle: "За вами не закреплено ни одного заведения",
      emptySubtitle:
        "Вы вошли, но пока не числитесь сотрудником ни одного заведения. Попросите владельца или менеджера добавить вас в команду — после этого заведение появится здесь.",
      errorTitle: "Не удалось загрузить список заведений",
      roleOwner: "Владелец",
      roleManager: "Менеджер",
      roleHostess: "Хостес",
      roleAdmin: "Администратор",
    },
    bookings: {
      title: "Брони",
      dateLabel: "Дата",
      today: "Сегодня",
      allStatuses: "Все статусы",
      emptyTitle: "На эту дату броней нет",
      emptyDescription: "Выберите другую дату или снимите фильтр по статусу",
      loadingTitle: "Загружаем брони…",
      colGuest: "Гость",
      colTime: "Время",
      colGuests: "Гостей",
      colStatus: "Статус",
      colSource: "Источник",
      colActions: "Действия",
      guestsCount: (n: number) => `${n} гост.`,
      confirm: "Подтвердить",
      cancel: "Отменить",
      noShow: "Не пришёл",
      actionFailed: "Не удалось изменить бронь",
      total: (n: number) => `Всего: ${n}`,
    },
    menu: {
      title: "Меню",
      loadingTitle: "Загружаем меню…",
      emptyTitle: "В меню пока нет блюд",
      emptyDescription: "Блюда, добавленные в панели ресторана, появятся здесь",
      available: "В наличии",
      unavailable: "Стоп",
      toggleAvailability: "Переключить наличие",
      selected: (n: number) => `Выбрано: ${n}`,
      stopSelected: "В стоп-лист",
      returnSelected: "Вернуть в меню",
      clearSelection: "Снять выделение",
      stopListDone: (n: number) => `Обновлено блюд: ${n}`,
      stopListFailed: "Не удалось обновить стоп-лист",
      uncategorized: "Без категории",
      searchPlaceholder: "Поиск по названию",
    },
    events: {
      title: "События",
      loadingTitle: "Загружаем события…",
      emptyTitle: "Пока нет событий",
      emptyDescription: "Создайте первое событие — оно появится здесь",
      create: "Новое событие",
      createTitle: "Новое событие",
      editTitle: "Редактирование события",
      total: (n: number) => `Всего: ${n}`,
      fieldTitle: "Название",
      fieldDescription: "Описание",
      fieldStartsAt: "Начало",
      fieldEndsAt: "Окончание",
      fieldVenue: "Место проведения",
      fieldVenueHint: "Например: летняя терраса. Пусто — в самом ресторане",
      fieldCover: "Обложка (URL изображения)",
      fieldTicketed: "Продажа билетов",
      fieldTicketPrice: "Цена билета, ₸",
      fieldCapacity: "Вместимость (мест)",
      publishNow: "Опубликовать сразу",
      publish: "Опубликовать",
      hide: "Скрыть",
      badgeDraft: "Черновик",
      badgePublished: "Опубликовано",
      badgeHidden: "Скрыто",
      free: "Бесплатно",
      ticketed: "С билетами",
      endBeforeStart: "Окончание не может быть раньше начала",
    },
    promos: {
      title: "Акции",
      loadingTitle: "Загружаем акции…",
      emptyTitle: "Пока нет акций",
      emptyDescription: "Создайте первую акцию — она появится здесь",
      create: "Новая акция",
      createTitle: "Новая акция",
      editTitle: "Редактирование акции",
      total: (n: number) => `Всего: ${n}`,
      fieldTitle: "Название",
      fieldDescription: "Описание",
      fieldStartsAt: "Действует с",
      fieldEndsAt: "Действует по",
      fieldTerms: "Условия",
      fieldTermsHint: "Мелкий шрифт: например «только при заказе от 2 человек»",
      publishNow: "Опубликовать сразу",
      publish: "Опубликовать",
      hide: "Скрыть",
      badgeDraft: "Черновик",
      badgePublished: "Опубликовано",
      badgeHidden: "Скрыто",
      endBeforeStart: "Дата окончания не может быть раньше даты начала",
    },
    schedule: {
      title: "Расписание",
      loadingTitle: "Загружаем расписание…",
      workingHoursTitle: "Часы работы",
      workingHoursHint: "Отметьте рабочие дни и укажите время открытия и закрытия",
      open: "Открыто",
      closed: "Выходной",
      openTime: "Открытие",
      closeTime: "Закрытие",
      saveWorkingHours: "Сохранить часы работы",
      workingHoursSaved: "Часы работы сохранены",
      overridesTitle: "Особые дни",
      overridesHint:
        "Праздники и исключения из обычного расписания. Особый день может быть платным для брони.",
      overridesEmpty: "Особых дней нет",
      addOverride: "Добавить особый день",
      overrideDate: "Дата",
      overrideClosed: "Закрыто в этот день",
      overrideNote: "Заметка",
      overrideNoteHint: "Например: «Новый год» — увидит только персонал",
      paidBooking: "Платная бронь в этот день",
      depositAmount: "Депозит, ₸",
      depositHint: "Сумма предоплаты за бронь в этот день",
      overrideSaved: "Особый день сохранён",
      overrideDeleted: "Особый день удалён",
      dateRequired: "Укажите дату",
      days: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
    },
    guests: {
      title: "Гости",
      loadingTitle: "Загружаем гостей…",
      emptyTitle: "Пока нет гостей",
      emptyDescription: "Здесь появятся гости после первых броней",
      total: (n: number) => `Всего гостей: ${n}`,
      colName: "Гость",
      colPhone: "Телефон",
      colEmail: "Почта",
      colBookings: "Броней",
      colVisits: "Визитов",
      colLast: "Последняя бронь",
    },
    push: {
      enable: "Включить уведомления",
      disable: "Отключить уведомления",
      enabling: "Включаем…",
      disabling: "Отключаем…",
      enabled: "Уведомления включены",
      unsupported: "Браузер не поддерживает уведомления",
      denied: "Уведомления заблокированы в настройках браузера",
      deniedHint: "Разрешите уведомления для этого сайта в настройках браузера",
      error: "Не удалось изменить уведомления. Попробуйте ещё раз",
      hint: "Push-уведомление о новой брони придёт в этот браузер",
      title: "Уведомления о бронях",
    },
    statuses: {
      pending: "Ожидает",
      confirmed: "Подтверждена",
      waitlist: "Лист ожидания",
      arrived: "Пришёл",
      completed: "Завершена",
      cancelled: "Отменена",
      no_show: "Не пришёл",
    },
    sources: {
      app: "Приложение",
      admin: "Персонал",
      phone: "Телефон",
      widget: "Виджет",
    },
  },
  booking: {
    title: "Бронирование",
    // --- шаг «когда» ---
    dateSectionTitle: "Дата",
    changeDate: "Другая дата",
    pickDateTitle: "Выберите дату",
    today: "Сегодня",
    tomorrow: "Завтра",
    guestsSectionTitle: "Гости",
    pickGuestsTitle: "Сколько гостей",
    guestsCount: (count: number) => `${count} ${guestsWord(count)}`,
    guestsHint: (max: number) =>
      `Больше ${max} гостей — это уже банкет, свяжитесь с заведением напрямую`,
    guestsDecrease: "Меньше гостей",
    guestsIncrease: "Больше гостей",
    timeSectionTitle: "Время",
    // --- время, подставленное с главного экрана ---
    /** Слот из карточки Explore оказался занят, пока гость шёл в форму.
     * Дата и число гостей при этом остаются подставленными. */
    prefillTakenTitle: "Это время уже заняли",
    prefillTakenDescription:
      "Выберите другое время — дата и число гостей уже подставлены",
    slotDuration: (minutes: number) => `Столик держим ${minutes} минут`,
    slotFreeTables: (count: number) => `Свободно столиков: ${count}`,
    slotUnavailable: {
      too_soon: "Слишком близко ко времени",
      beyond_horizon: "Пока нельзя бронировать так далеко",
      occupied: "Занято",
      capacity: "Нет подходящего столика",
      unknown: "Недоступно",
    },
    // --- состояния списка слотов ---
    slotsLoading: "Смотрим свободное время…",
    slotsErrorTitle: "Не удалось загрузить время",
    slotsErrorDescription: "Проверьте соединение и попробуйте ещё раз",
    slotsClosedTitle: "В этот день заведение не принимает брони",
    slotsClosedDescription: "Выберите другую дату — расписание на неё уже может быть открыто",
    /** Тот же случай, но теперь подсказка берётся из СТРУКТУРНОГО графика на
     * выбранный день, а не из свободного текста: гость сразу видит, выходной
     * это или просто нет свободного времени, и не перебирает даты наугад. */
    slotsClosedSchedule: (hours: string) => `По графику заведение работает: ${hours}`,
    slotsClosedDayOff: "В этот день у заведения выходной",
    slotsAllTakenTitle: "На эту дату всё занято",
    slotsAllTakenDescription: "Попробуйте другой день или другое количество гостей",
    /** Все слоты дня вернулись с `reason: "capacity"` — свободного столика нет
     * не на это время, а вообще: у заведения нет столиков в системе, и другая
     * дата ничего не изменит. Поэтому здесь НЕТ кнопки «выбрать другую дату» —
     * она отправляла бы гостя по кругу («Adept»: Вс–Ср 0 слотов, Чт–Сб все
     * слоты capacity — проверено 2026-07-26). */
    slotsNoTablesTitle: "Онлайн-бронь здесь пока не работает",
    slotsNoTablesDescription:
      "У заведения нет столиков в системе бронирования — свободного времени не будет ни на одну дату. Забронировать можно по телефону",
    slotsNoTablesCall: (phone: string) => `Позвонить: ${phone}`,
    pickAnotherDate: "Выбрать другую дату",
    // --- контакты ---
    contactSectionTitle: "Контакты",
    nameLabel: "Имя",
    namePlaceholder: "Как вас встречать",
    phoneLabel: "Телефон",
    phonePlaceholder: "+7 700 000 00 00",
    notesLabel: "Пожелания",
    notesPlaceholder: "Столик у окна, детский стул, день рождения…",
    nameRequired: "Укажите имя",
    phoneRequired: "Укажите телефон",
    phoneInvalid: "Телефон похож на неполный — проверьте номер",
    // --- предзаказ ---
    preorderSectionTitle: "Предзаказ",
    preorderOptional: "Необязательно — блюда можно выбрать и на месте",
    preorderAdd: "Выбрать блюда",
    preorderEdit: "Изменить предзаказ",
    preorderSummary: (count: number, total: string) => `${count} поз. · ${total}`,
    preorderTitle: "Предзаказ",
    preorderDone: "Готово",
    preorderClear: "Очистить",
    preorderEmptyTitle: "У заведения пока нет меню",
    preorderEmptyDescription: "Блюда появятся здесь, когда заведение их загрузит",
    preorderErrorTitle: "Меню не загрузилось",
    preorderLoading: "Загружаем меню…",
    preorderUnavailable: "Нет в наличии",
    preorderNoPrice: "Цена уточняется",
    preorderOther: "Другое",
    preorderTotalEstimate: "Предварительно",
    preorderTotalEstimateNote:
      "Итог посчитает заведение — здесь оценка по ценам меню",
    preorderSaveFailed:
      "Бронь создана, столик за вами. А вот предзаказ сохранить не удалось — блюда можно будет заказать на месте",
    dishAdd: "Добавить",
    dishRemove: "Убрать",
    // --- подтверждение ---
    submit: "Забронировать",
    submitting: "Бронируем…",
    signInToConfirm: "Войти и забронировать",
    signInGateNote: "Бронь оформляется на аккаунт — так вы сможете её отменить или изменить",
    // --- четыре исхода конфликта 409 на POST /bookings ---
    // Ветвление идёт по машинному полю `code` в ответе сервера, а не по
    // тексту. Формулировки разные не для красоты: гость, которому сказали
    // «бронь есть», когда её нет, просто не придёт в ресторан.
    /** code = idempotency_key_reused — прошлая отправка ДОШЛА, бронь есть. */
    createErrorDuplicateTitle: "Эта бронь уже оформлена",
    createErrorDuplicateDescription:
      "Ваша предыдущая отправка дошла до ресторана — столик за вами. Откройте «Мои брони», чтобы её посмотреть. Отправлять ещё раз не нужно, иначе стол займут дважды.",
    /** code = slot_taken — брони НЕТ, время ушло. */
    createErrorConflictTitle: "Это время только что заняли",
    createErrorConflictDescription:
      "Бронь не оформлена: пока вы заполняли форму, столик на это время забрали. Выберите другое время — список уже обновлён.",
    /** code = no_table_available — брони НЕТ, компания не помещается. */
    createErrorNoTableTitle: "На это время нет подходящего столика",
    createErrorNoTableDescription: (guests: number) =>
      `Бронь не оформлена: столика на ${guests} ${guestsWord(guests)} в это время не нашлось. Попробуйте другое время или уменьшите число гостей.`,
    /** Кода нет (старая сборка сервера) — не знаем, создалась бронь или нет.
     * Ничего не утверждаем ни в ту, ни в другую сторону. */
    createErrorAmbiguousTitle: "Не удалось подтвердить бронь",
    createErrorAmbiguousDescription:
      "Ресторан ответил, что на это время бронь уже есть, но не уточнил — ваша или чужая. Сначала откройте «Мои брони»: если ваша там есть, всё в порядке; если нет — выберите другое время.",
    createErrorOpenMyBookings: "Открыть мои брони",
    createErrorChangeGuests: "Изменить число гостей",
    createErrorValidationTitle: "Не получилось забронировать",
    createErrorValidationDescription:
      "Проверьте дату, время и число гостей: возможно, время уже прошло или гостей слишком много",
    createErrorTitle: "Бронь не отправилась",
    createErrorDescription: "Проверьте соединение и попробуйте ещё раз",
    // --- экран подтверждения ---
    confirmedTitle: "Столик забронирован",
    pendingTitle: "Заявка отправлена",
    cancelledTitle: "Бронь отменена",
    confirmedSubtitle: "Ждём вас — заведение уже видит вашу бронь",
    pendingSubtitle: "Заведение подтвердит бронь и пришлёт уведомление",
    cancelledSubtitle: "Эта бронь больше не действует",
    statusLabel: "Статус",
    status: {
      pending: "Ждёт подтверждения",
      confirmed: "Подтверждена",
      waitlist: "В листе ожидания",
      arrived: "Вы на месте",
      completed: "Завершена",
      cancelled: "Отменена",
      no_show: "Не пришли",
    },
    whenLabel: "Когда",
    whoLabel: "На кого",
    freeCancelUntil: (when: string) => `Бесплатная отмена до ${when}`,
    whatsNext: "Что дальше",
    whatsNextTitle: "Что дальше",
    whatsNextSteps: [
      {
        title: "Заведение получило бронь",
        text: "Она уже в системе — администратор видит дату, время и число гостей",
      },
      {
        title: "Придёт подтверждение",
        text: "Если заведение подтверждает брони вручную, ответ приходит обычно в течение пары часов",
      },
      {
        title: "Приходите вовремя",
        text: "Столик держим ограниченное время. Если опаздываете — предупредите заведение",
      },
      {
        title: "Планы изменились?",
        text: "Отменить бронь можно бесплатно до указанного времени",
      },
    ],
    backToVenue: "Вернуться к заведению",
    bookingErrorTitle: "Бронь не загрузилась",
    bookingLoading: "Загружаем бронь…",
    /** Экран брони открыт без сессии: по диплинку или когда сессия истекла
     * прямо на экране. Это не ошибка сети — это «вы не вошли». */
    bookingSignedOutTitle: "Вы не вошли",
    bookingSignedOutDescription: "Войдите в аккаунт, на который оформлена бронь — тогда мы её покажем",
    bookingSignIn: "Войти",

    // --- экран брони (Reservation, node 488:9876) ---
    /** Подпись под названием заведения: «Сегодня · 14:00 · 2 гостя». */
    reservationSummary: (when: string, time: string, guests: string) =>
      `${when} · ${time} · ${guests}`,
    /** Заголовок карточки-объяснялки. В макете он один на все статусы,
     * но текст под ним свой у каждого — см. whatHappensNext. */
    whatHappensNextTitle: "Что происходит дальше?",
    whatHappensNext: {
      pending:
        "Обычно заведение подтверждает бронь за 15–30 минут. Как только бронь подтвердят, мы пришлём уведомление.",
      waitlist:
        "Вы в листе ожидания: свободного столика на это время пока нет. Если место освободится, заведение подтвердит бронь, и мы сразу сообщим.",
      confirmed:
        "Столик за вами — заведение подтвердило бронь. Приходите к назначенному времени; если планы изменятся, бронь можно отменить прямо здесь.",
      arrived: "Вы на месте — администратор отметил ваш приход. Приятного вечера.",
      completed: "Визит завершён. Спасибо, что были у нас — будем рады видеть снова.",
      cancelled:
        "Эта бронь отменена, столик за вами больше не держат. Чтобы прийти, оформите новую бронь.",
      no_show:
        "Заведение отметило, что гость не пришёл. Если это ошибка, свяжитесь с заведением по телефону ниже.",
    },
    contactsTitle: "Контакты",
    contactWebsite: "Сайт заведения",
    contactWhatsapp: "Написать в WhatsApp",
    contactInstagram: "Instagram заведения",
    openInMaps: "Открыть на карте",
    /** Подсказка скринридера к блоку карты: сама картинка декоративная,
     * адрес рядом текстом, поэтому объявляем действие, а не изображение. */
    openInMapsHint: "Откроется приложение карт на устройстве",
    mapPlaceholderTitle: "Превью карты недоступно",
    mapPlaceholderDescription: "Нажмите, чтобы открыть адрес в приложении карт",
    mapNoCoordinates: "У заведения не указаны координаты",

    // --- отмена ---
    cancelBooking: "Отменить бронь",
    cancelDialogTitle: "Отменить бронь?",
    /** Деньги. Формулировка обязана быть однозначной — гость решает по ней. */
    cancelFreeNoMoney: "Вы ничего не оплачивали, поэтому отмена ничего не стоит.",
    cancelDepositLost: (amount: string) =>
      `Бесплатная отмена уже закончилась: депозит ${amount} не возвращается.`,
    cancelDepositLostSoon: (amount: string, when: string) =>
      `Бесплатная отмена действует до ${when}. Если отменить позже, депозит ${amount} останется у заведения.`,
    cancelMoneyUnknown:
      "Не удалось проверить, была ли оплата по этой брони. Если вы вносили депозит, уточните условия возврата у заведения.",
    cancelKeep: "Оставить бронь",
    cancelConfirm: "Да, отменить",
    cancelling: "Отменяем…",
    cancelledToast: "Бронь отменена",
    cancelErrorTitle: "Не удалось отменить бронь",
    cancelErrorDescription: "Проверьте соединение и попробуйте ещё раз",
    cancelErrorForbidden: "Отменить эту бронь может только заведение — позвоните им",
    cancelErrorGone: "Эту бронь уже нельзя отменить — она завершена или отменена ранее",
  },
  /** Вкладка «Бронь» — список собственных броней гостя (GET /bookings). */
  myBookings: {
    title: "Мои брони",
    loadingTitle: "Загружаем ваши брони…",
    loadingMore: "Загружаем ещё…",
    emptyTitle: "Броней пока нет",
    emptyDescription: "Забронируйте столик — бронь появится здесь",
    emptyAction: "Найти заведение",
    errorTitle: "Брони не загрузились",
    errorDescription: "Проверьте соединение и попробуйте ещё раз",
    signedOutTitle: "Войдите, чтобы увидеть свои брони",
    signedOutDescription: "Бронь оформляется на аккаунт — так её можно посмотреть и отменить",
    signIn: "Войти",
    /** Название заведения приходит отдельным запросом: пока оно не пришло
     * и если запрос упал, врать названием нельзя. */
    venueLoading: "Загружаем название…",
    venueUnavailable: "Название заведения не загрузилось",
    summary: (when: string, guests: string) => `${when} · ${guests}`,
    openBooking: (venue: string, when: string) => `Бронь в «${venue}», ${when}`,
  },
  /** Вкладка «Избранные» — GET /favorites. */
  favorites: {
    title: "Избранные",
    loadingTitle: "Загружаем избранное…",
    emptyTitle: "В избранном пусто",
    emptyDescription: "Нажмите на сердечко у заведения — оно появится здесь",
    emptyAction: "Открыть поиск",
    errorTitle: "Избранное не загрузилось",
    errorDescription: "Проверьте соединение и попробуйте ещё раз",
    signedOutTitle: "Войдите, чтобы сохранять заведения",
    signedOutDescription: "Избранное хранится в аккаунте и открывается на любом устройстве",
    signIn: "Войти",
    toggleFailed: "Не удалось изменить избранное. Попробуйте ещё раз",
  },
  /** Вкладка «Профиль» — GET /users/me. */
  profile: {
    title: "Профиль",
    loadingTitle: "Загружаем профиль…",
    accountTitle: "Аккаунт",
    nameLabel: "Имя",
    nameEmpty: "Не указано",
    emailLabel: "Почта",
    /** Аккаунт по коду из SMS создаётся без почты — это нормальное состояние. */
    emailEmpty: "Не указана",
    phoneLabel: "Телефон",
    phoneEmpty: "Не указан",
    myBookings: "Мои брони",
    myFavorites: "Избранные",
    signOut: "Выйти",
    signingOut: "Выходим…",
    signedOutTitle: "Вы не вошли",
    signedOutDescription: "Войдите, чтобы видеть свои брони и избранное",
    signIn: "Войти",
    errorTitle: "Профиль не загрузился",
    errorDescription: "Проверьте соединение и попробуйте ещё раз",
  },
  auth: {
    signInTitle: "Вход",
    /** Общий подзаголовок: экран входа открыт сам по себе (диплинк, «Профиль»). */
    signInSubtitle: "Войдите по номеру телефона — пароль не нужен",
    /** Экран входа открыт из формы брони — черновик ждёт на экране под ним. */
    signInSubtitleBooking: "Войдите, чтобы завершить бронирование",
    /** Экран входа открыт нажатием на сердечко — после входа оно применится само. */
    signInSubtitleFavorite: "Войдите — и мы сразу сохраним заведение в избранное",

    // --- шаг 1: номер телефона ---
    phoneLabel: "Номер телефона",
    phonePlaceholder: "(777) 123-45-67",
    /** Префикс зафиксирован интерфейсом, гость вводит только 10 цифр. */
    phonePrefix: "+7",
    phoneHint: "Пришлём код в SMS или мессенджер",
    phoneIncomplete: "Введите 10 цифр номера",
    submitRequestCode: "Получить код",
    requestingCode: "Отправляем код…",

    // --- шаг 2: код ---
    codeTitle: "Введите код",
    codeSentTo: (phone: string) => `Код отправлен на ${phone}`,
    codeLabel: "Код из сообщения",
    codePlaceholder: "000000",
    codeIncomplete: "Код состоит из шести цифр",
    submitVerify: "Войти",
    verifying: "Проверяем код…",
    changePhone: "Изменить номер",
    resend: "Отправить код заново",
    /** Лимит сервера — 1 запрос в минуту на номер, поэтому отсчёт идёт от него. */
    resendIn: (seconds: number) => `Отправить код заново можно через ${seconds} с`,
    /** Срок жизни кода на сервере — 5 минут (AUTH_OTP_TTL). */
    codeProbablyExpired: "Код действует 5 минут — скорее всего, он уже истёк. Запросите новый",

    // --- ошибки ---
    /** Сервер отвечает одинаковым 401 на неверный код, истёкший код и
     * заблокированный после пяти попыток номер — различить их нельзя,
     * поэтому текст перечисляет причины, а не выбирает одну. */
    errorCodeRejected: "Код не подошёл. Проверьте цифры или запросите новый — код живёт 5 минут",
    /** Пять неверных попыток подряд — дальше сервер отклонит любой ввод для
     * этого кода (maxOTPAttempts в internal/usecase/auth/otp.go). */
    errorTooManyAttempts: "Пять неверных попыток. Запросите новый код",
    /** 422 на запрос кода: единственное, что осталось после клиентской
     * проверки номера, — это лимит по номеру (1/мин, 5/час). */
    errorTooOften: "Код можно запрашивать раз в минуту и не больше пяти раз в час. Подождите и попробуйте снова",
    /** 429 от middleware: сервер сам сказал, сколько ждать. */
    errorRateLimited: (seconds: number) => `Слишком много запросов. Попробуйте через ${seconds} с`,
    errorDescription: "Проверьте соединение и попробуйте ещё раз",

    /** Показывается, когда сборка запущена с EXPO_PUBLIC_OTP_DELIVERY_DISABLED=1:
     * на таком окружении сервер отвечает «отправлено», но код не уходит. */
    deliveryDisabledNotice:
      "На этом сервере доставка кодов отключена — сообщение не придёт. Экран можно проверить только до этого шага",
    /** Сервер сам вернул код (AUTH_OTP_DEV_EXPOSE=true). Показываем только в
     * dev-сборке и подписываем, что это отладочный режим. */
    devCodeNotice: (code: string) => `Отладочный режим сервера: код ${code}`,
  },
  a11y: {
    closeButton: "Закрыть",
    backButton: "Назад",
    searchClearButton: "Очистить поле поиска",
    galleryImage: (index: number) => `Изображение ${index}`,
    openFilters: "Открыть фильтры",
    shareButton: "Поделиться",
    previousMonth: "Предыдущий месяц",
    nextMonth: "Следующий месяц",
  },
} as const;

export type Dictionary = typeof ru;
