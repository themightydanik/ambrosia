// ─────────────────────────────────────────────
// SYMPTOM CATEGORIES & THEIR SYMPTOMS
// ─────────────────────────────────────────────
export const CATEGORIES = {
  general:     { icon: '🌡️', symptoms: ['fatigue','fever','chills','weakness','loss_of_appetite'] },
  respiratory: { icon: '🫁', symptoms: ['cough','sore_throat','runny_nose','shortness_of_breath','congestion'] },
  digestive:   { icon: '🫃', symptoms: ['nausea','stomach_pain','bloating','diarrhea','heartburn'] },
  pain:        { icon: '⚡', symptoms: ['headache','back_pain','joint_pain','muscle_ache','chest_pain'] },
  mental:      { icon: '🧠', symptoms: ['anxiety','brain_fog','mood_changes','insomnia','stress'] },
  skin:        { icon: '🫧', symptoms: ['rash','itching','swelling','bruising'] }
};

export const CAT_NAMES = {
  general: 'catGeneral', respiratory: 'catRespiratory', digestive: 'catDigestive',
  pain: 'catPain', mental: 'catMental', skin: 'catSkin'
};

export const TRIGGERS = [
  'stress','poor_sleep','bad_diet','cold_weather','alcohol','exercise','allergen','medication'
];

export const TRIGGER_ICONS = {
  stress: '😰', poor_sleep: '😴', bad_diet: '🍔', cold_weather: '❄️',
  alcohol: '🍷', exercise: '🏃', allergen: '🌸', medication: '💊'
};

export const SYMPTOM_COLORS = {
  fatigue: '#5BBFA0', fever: '#E07560', chills: '#8EC5FC', weakness: '#D4A853',
  loss_of_appetite: '#A0A0A0', cough: '#E07560', sore_throat: '#E07560',
  runny_nose: '#8EC5FC', shortness_of_breath: '#E07560', congestion: '#8EC5FC',
  nausea: '#A0E0C0', stomach_pain: '#E0A060', bloating: '#D4A853',
  diarrhea: '#A0A0A0', heartburn: '#E07560', headache: '#E07560',
  back_pain: '#D4A853', joint_pain: '#D4A853', muscle_ache: '#A0A0A0',
  chest_pain: '#E07560', anxiety: '#8EC5FC', brain_fog: '#A0A0A0',
  mood_changes: '#C080E0', insomnia: '#6080C0', stress: '#E07560',
  rash: '#E07560', itching: '#D4A853', swelling: '#8EC5FC', bruising: '#8060A0'
};

// Pre-loaded sample data (3-day illness progression)
export const SAMPLE_ENTRIES = [
  {
    id: 1, date: '2026-03-27', timestamp: new Date('2026-03-27T19:30').toISOString(),
    category: 'general', symptoms: ['fatigue','loss_of_appetite'],
    intensity: 4, triggers: ['stress','poor_sleep'],
    notes: 'Feeling unusually tired after work. Not hungry at dinner.'
  },
  {
    id: 2, date: '2026-03-28', timestamp: new Date('2026-03-28T21:00').toISOString(),
    category: 'respiratory', symptoms: ['sore_throat','runny_nose','fatigue'],
    intensity: 6, triggers: ['cold_weather'],
    notes: 'Throat started hurting in the afternoon. Definitely coming down with something.'
  },
  {
    id: 3, date: '2026-03-29', timestamp: new Date('2026-03-29T10:00').toISOString(),
    category: 'respiratory', symptoms: ['sore_throat','cough','fever','headache','fatigue'],
    intensity: 7, triggers: [],
    notes: 'Woke up with fever (37.8°C). Cough started. Headache throughout the day.'
  }
];

// ─────────────────────────────────────────────
// TRANSLATIONS  (add new languages here)
// ─────────────────────────────────────────────
export const T = {
  en: {
    // nav
    navHome: 'Home', navHist: 'History', navAI: 'AI', navSet: 'Profile',
    // greetings
    goodMorning: 'GOOD MORNING', goodAfternoon: 'GOOD AFTERNOON', goodEvening: 'GOOD EVENING',
    // home
    overallFeeling: 'OVERALL FEELING TODAY',
    todaySymptoms: "TODAY'S SYMPTOMS", logBtn: '+ Log',
    recentEntries: 'RECENT ENTRIES', seeAll: 'See all',
    chartTitle: '7-DAY SYMPTOM INTENSITY',
    noSymptoms: 'No symptoms logged today',
    homeAiInsight: 'Your symptoms suggest early-stage upper respiratory illness. Tap to see full analysis →',
    // log
    logTitle: 'Log Symptom', selectCat: 'Select category',
    selectSymptoms: 'Select symptoms (tap all that apply)',
    overallIntensity: 'Overall intensity', triggers: 'Triggers (optional)',
    addNotes: 'Any additional notes?', notesPlaceholder: 'How are you feeling? Any context that might be relevant...',
    nextBtn: 'Next →', saveBtn: 'Save Entry',
    mild: 'Mild', moderate: 'Moderate', severe: 'Severe',
    i1:'Very mild — barely noticeable', i2:'Mild — slight discomfort', i3:'Mild — noticeable',
    i4:'Moderate — somewhat bothersome', i5:'Moderate — noticeable but manageable',
    i6:'Moderate-severe — affecting daily activities', i7:'Severe — difficult to ignore',
    i8:'Severe — significantly limiting', i9:'Very severe — debilitating', i10:'Extreme — unbearable',
    // categories
    catGeneral:'General', catRespiratory:'Respiratory', catDigestive:'Digestive',
    catPain:'Pain', catMental:'Mental', catSkin:'Skin',
    // symptoms
    fatigue:'Fatigue', fever:'Fever', chills:'Chills', weakness:'Weakness', loss_of_appetite:'Loss of appetite',
    cough:'Cough', sore_throat:'Sore throat', runny_nose:'Runny nose', shortness_of_breath:'Shortness of breath', congestion:'Congestion',
    nausea:'Nausea', stomach_pain:'Stomach pain', bloating:'Bloating', diarrhea:'Diarrhea', heartburn:'Heartburn',
    headache:'Headache', back_pain:'Back pain', joint_pain:'Joint pain', muscle_ache:'Muscle ache', chest_pain:'Chest pain',
    anxiety:'Anxiety', brain_fog:'Brain fog', mood_changes:'Mood changes', insomnia:'Insomnia', stress:'Stress',
    rash:'Rash', itching:'Itching', swelling:'Swelling', bruising:'Bruising',
    // triggers
    poor_sleep:'Poor sleep', bad_diet:'Bad diet', cold_weather:'Cold weather',
    alcohol:'Alcohol', exercise:'Exercise', allergen:'Allergen', medication:'Medication',
    // history
    histTitle:'Health History', histSub:'Your complete symptom timeline',
    noEntries:'No entries yet. Tap ➕ to log your first symptom.',
    allFilter:'All',
    // ai
    aiTag:'AI HEALTH ASSISTANT',
    aiBt1:'Analyze My Symptoms', aiBd1:'Get AI insights on patterns and possible conditions',
    aiBt2:'Find Correlations', aiBd2:'Discover hidden connections between your symptoms',
    aiBt3:'Generate Doctor Report', aiBd3:'Create a comprehensive summary for your appointment',
    aiBt4:'Get Recommendations', aiBd4:'What to do now and which doctor to see',
    // settings
    setTitle:'Profile & Settings', setLang:'LANGUAGE', setPref:'PREFERENCES',
    setData:'DATA', setNotif:'Reminders', setTheme:'Theme',
    setExport:'Export Data', setClear:'Clear All Data',
    entries:'Entries', daysTracked:'Days tracked', symptoms:'Symptoms',
    // feeling scale
    feeling1:'Feeling great', feeling2:'Feeling good', feeling3:'Slight discomfort',
    feeling4:'Mild discomfort', feeling5:'Moderate discomfort',
    feeling6:'Feeling unwell', feeling7:'Quite unwell', feeling8:'Feeling poorly',
    feeling9:'Feeling very ill', feeling10:'Critical',
  },

  ru: {
    navHome:'Главная', navHist:'История', navAI:'ИИ', navSet:'Профиль',
    goodMorning:'ДОБРОЕ УТРО', goodAfternoon:'ДОБРЫЙ ДЕНЬ', goodEvening:'ДОБРЫЙ ВЕЧЕР',
    overallFeeling:'ОБЩЕЕ САМОЧУВСТВИЕ СЕГОДНЯ',
    todaySymptoms:'СИМПТОМЫ СЕГОДНЯ', logBtn:'+ Записать',
    recentEntries:'ПОСЛЕДНИЕ ЗАПИСИ', seeAll:'Все',
    chartTitle:'ИНТЕНСИВНОСТЬ ЗА 7 ДНЕЙ',
    noSymptoms:'Симптомы за сегодня не записаны',
    homeAiInsight:'Ваши симптомы указывают на начало ОРВИ. Нажмите для полного анализа →',
    logTitle:'Записать симптом', selectCat:'Выберите категорию',
    selectSymptoms:'Выберите симптомы (можно несколько)',
    overallIntensity:'Общая интенсивность', triggers:'Триггеры (необязательно)',
    addNotes:'Дополнительные заметки?', notesPlaceholder:'Как вы себя чувствуете? Что-то важное...',
    nextBtn:'Далее →', saveBtn:'Сохранить',
    mild:'Слабо', moderate:'Умеренно', severe:'Сильно',
    i1:'Очень слабо — едва заметно', i2:'Слабо — лёгкий дискомфорт', i3:'Слабо — заметно',
    i4:'Умеренно — немного беспокоит', i5:'Умеренно — заметно, но терпимо',
    i6:'Умеренно-сильно — мешает повседневной жизни', i7:'Сильно — трудно игнорировать',
    i8:'Сильно — значительно ограничивает', i9:'Очень сильно — изнурительно', i10:'Экстремально — невыносимо',
    catGeneral:'Общее', catRespiratory:'Дыхательные', catDigestive:'Пищеварение',
    catPain:'Боль', catMental:'Ментальное', catSkin:'Кожа',
    fatigue:'Усталость', fever:'Температура', chills:'Озноб', weakness:'Слабость', loss_of_appetite:'Потеря аппетита',
    cough:'Кашель', sore_throat:'Боль в горле', runny_nose:'Насморк', shortness_of_breath:'Одышка', congestion:'Заложенность носа',
    nausea:'Тошнота', stomach_pain:'Боль в животе', bloating:'Вздутие', diarrhea:'Диарея', heartburn:'Изжога',
    headache:'Головная боль', back_pain:'Боль в спине', joint_pain:'Боль в суставах', muscle_ache:'Боль в мышцах', chest_pain:'Боль в груди',
    anxiety:'Тревога', brain_fog:'Туман в голове', mood_changes:'Перепады настроения', insomnia:'Бессонница', stress:'Стресс',
    rash:'Сыпь', itching:'Зуд', swelling:'Отёк', bruising:'Синяки',
    poor_sleep:'Плохой сон', bad_diet:'Питание', cold_weather:'Холодная погода',
    alcohol:'Алкоголь', exercise:'Нагрузка', allergen:'Аллерген', medication:'Лекарства',
    histTitle:'История здоровья', histSub:'Полная хронология симптомов',
    noEntries:'Записей ещё нет. Нажмите ➕ чтобы добавить симптом.',
    allFilter:'Все',
    aiTag:'ИИ ПОМОЩНИК',
    aiBt1:'Анализ симптомов', aiBd1:'Инсайты по паттернам и возможным состояниям',
    aiBt2:'Найти корреляции', aiBd2:'Скрытые связи между вашими симптомами',
    aiBt3:'Отчёт для врача', aiBd3:'Детальное саммари для приёма у доктора',
    aiBt4:'Рекомендации', aiBd4:'Что делать и к какому врачу обратиться',
    setTitle:'Профиль и настройки', setLang:'ЯЗЫК', setPref:'НАСТРОЙКИ',
    setData:'ДАННЫЕ', setNotif:'Напоминания', setTheme:'Тема',
    setExport:'Экспорт данных', setClear:'Очистить все данные',
    entries:'Записей', daysTracked:'Дней отслеживания', symptoms:'Симптомов',
    feeling1:'Отлично', feeling2:'Хорошо', feeling3:'Лёгкий дискомфорт',
    feeling4:'Умеренный дискомфорт', feeling5:'Умеренное недомогание',
    feeling6:'Нехорошо', feeling7:'Довольно плохо', feeling8:'Плохо',
    feeling9:'Очень плохо', feeling10:'Критично',
  },

  uk: {
    navHome:'Головна', navHist:'Історія', navAI:'ШІ', navSet:'Профіль',
    goodMorning:'ДОБРОГО РАНКУ', goodAfternoon:'ДОБРИЙ ДЕНЬ', goodEvening:'ДОБРИЙ ВЕЧІР',
    overallFeeling:'ЗАГАЛЬНЕ САМОПОЧУТТЯ СЬОГОДНІ',
    todaySymptoms:'СИМПТОМИ СЬОГОДНІ', logBtn:'+ Записати',
    recentEntries:'ОСТАННІ ЗАПИСИ', seeAll:'Всі',
    chartTitle:'ІНТЕНСИВНІСТЬ ЗА 7 ДНІВ',
    noSymptoms:'Симптоми за сьогодні не записані',
    homeAiInsight:'Ваші симптоми вказують на початок ГРВІ. Натисніть для повного аналізу →',
    logTitle:'Записати симптом', selectCat:'Оберіть категорію',
    selectSymptoms:'Оберіть симптоми (можна кілька)',
    overallIntensity:'Загальна інтенсивність', triggers:"Тригери (необов'язково)",
    addNotes:'Додаткові нотатки?', notesPlaceholder:'Як ви почуваєтесь? Щось важливе...',
    nextBtn:'Далі →', saveBtn:'Зберегти',
    mild:'Слабко', moderate:'Помірно', severe:'Сильно',
    i1:'Дуже слабко — ледь помітно', i2:'Слабко — легкий дискомфорт', i3:'Слабко — помітно',
    i4:'Помірно — трохи турбує', i5:'Помірно — помітно, але терпимо',
    i6:'Помірно-сильно — заважає щоденному житті', i7:'Сильно — важко ігнорувати',
    i8:'Сильно — значно обмежує', i9:'Дуже сильно — виснажливо', i10:'Екстремально — нестерпно',
    catGeneral:'Загальне', catRespiratory:'Дихальні', catDigestive:'Травлення',
    catPain:'Біль', catMental:'Ментальне', catSkin:'Шкіра',
    fatigue:'Втома', fever:'Температура', chills:'Озноб', weakness:'Слабкість', loss_of_appetite:'Втрата апетиту',
    cough:'Кашель', sore_throat:'Біль у горлі', runny_nose:'Нежить', shortness_of_breath:'Задишка', congestion:'Закладеність носа',
    nausea:'Нудота', stomach_pain:'Біль у животі', bloating:'Здуття', diarrhea:'Діарея', heartburn:'Печія',
    headache:'Головний біль', back_pain:'Біль у спині', joint_pain:'Біль у суглобах', muscle_ache:"Біль у м'язах", chest_pain:'Біль у грудях',
    anxiety:'Тривога', brain_fog:'Туман у голові', mood_changes:'Перепади настрою', insomnia:'Безсоння', stress:'Стрес',
    rash:'Висип', itching:'Свербіж', swelling:'Набряк', bruising:'Синці',
    poor_sleep:'Поганий сон', bad_diet:'Харчування', cold_weather:'Холодна погода',
    alcohol:'Алкоголь', exercise:'Навантаження', allergen:'Алерген', medication:'Ліки',
    histTitle:"Історія здоров'я", histSub:'Повна хронологія симптомів',
    noEntries:'Записів ще немає. Натисніть ➕ щоб додати симптом.',
    allFilter:'Всі',
    aiTag:'ШІ ПОМІЧНИК',
    aiBt1:'Аналіз симптомів', aiBd1:'Інсайти щодо паттернів і можливих станів',
    aiBt2:'Знайти кореляції', aiBd2:"Приховані зв'язки між вашими симптомами",
    aiBt3:'Звіт для лікаря', aiBd3:'Детальне саммарі для прийому у лікаря',
    aiBt4:'Рекомендації', aiBd4:'Що робити та до якого лікаря звернутись',
    setTitle:'Профіль і налаштування', setLang:'МОВА', setPref:'НАЛАШТУВАННЯ',
    setData:'ДАНІ', setNotif:'Нагадування', setTheme:'Тема',
    setExport:'Експорт даних', setClear:'Очистити всі дані',
    entries:'Записів', daysTracked:'Днів відстеження', symptoms:'Симптомів',
    feeling1:'Відмінно', feeling2:'Добре', feeling3:'Легкий дискомфорт',
    feeling4:'Помірний дискомфорт', feeling5:'Помірне нездужання',
    feeling6:'Погано', feeling7:'Досить погано', feeling8:'Зле',
    feeling9:'Дуже погано', feeling10:'Критично',
  }
};
