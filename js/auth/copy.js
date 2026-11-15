const text = {
  en: {
    google: "Continue with Google",
    deleteGoogleHelp:
      "Google accounts may not have a password yet. To delete your account, first use Send password reset email, set a password through that email, then sign in again and confirm deletion with it.",
    cancel: "Cancel Google sign-in",
    pending: "Finish signing in in your browser, or cancel to start again.",
    failed:
      "Google sign-in could not be confirmed. Start again; your device records are unchanged.",
    requiredTitle: "Your journal starts with your account.",
    requiredBody:
      "Sign in with email or Google to continue. Existing device records stay separate until you explicitly migrate them.",
    requiredIntro:
      "Use your account to keep your journal separate and in sync. You choose the records shared with Companion.",
    requiredNote:
      "Sign in to continue. Subscription access is verified separately.",
    recover: "Recover device records",
    recoveryTitle: "Your device records are still here.",
    recoveryBody:
      "Export the original device-only records before signing in or migrating them. Export does not upload or merge them.",
    export: "Export device recovery archive",
    back: "Back to sign-in",
    review: "Review device records",
    error: "Device records could not be read. Nothing was removed.",
  },
  uk: {
    google: "Продовжити з Google",
    deleteGoogleHelp:
      "Акаунт Google може ще не мати пароля. Для видалення спочатку надішліть лист для скидання пароля, задайте пароль через лист, увійдіть знову й підтвердьте ним видалення.",
    cancel: "Скасувати вхід через Google",
    pending: "Завершіть вхід у браузері або скасуйте, щоб почати знову.",
    failed:
      "Не вдалося підтвердити вхід через Google. Почніть знову; записи пристрою не змінено.",
    requiredTitle: "Ваш щоденник починається з акаунта.",
    requiredBody:
      "Увійдіть через email або Google. Записи пристрою залишаються окремими до явного перенесення.",
    requiredIntro:
      "Використовуйте акаунт для окремого зберігання та синхронізації щоденника. Ви вибираєте записи для Companion.",
    requiredNote:
      "Увійдіть, щоб продовжити. Доступ за підпискою перевіряється окремо.",
    recover: "Відновити записи пристрою",
    recoveryTitle: "Записи пристрою залишилися тут.",
    recoveryBody:
      "Експортуйте оригінальні записи пристрою перед входом або перенесенням. Експорт не надсилає й не об’єднує їх.",
    export: "Експортувати архів відновлення",
    back: "Назад до входу",
    review: "Переглянути записи пристрою",
    error: "Не вдалося прочитати записи. Нічого не видалено.",
  },
  ru: {
    google: "Продолжить с Google",
    deleteGoogleHelp:
      "У аккаунта Google может ещё не быть пароля. Для удаления сначала отправьте письмо для сброса пароля, задайте пароль через письмо, войдите снова и подтвердите им удаление.",
    cancel: "Отменить вход через Google",
    pending: "Завершите вход в браузере или отмените его, чтобы начать заново.",
    failed:
      "Не удалось подтвердить вход через Google. Начните заново; записи устройства не изменены.",
    requiredTitle: "Ваш дневник начинается с аккаунта.",
    requiredBody:
      "Войдите через email или Google. Записи устройства остаются отдельными до явного переноса.",
    requiredIntro:
      "Используйте аккаунт для отдельного хранения и синхронизации дневника. Вы выбираете записи для Companion.",
    requiredNote:
      "Войдите, чтобы продолжить. Доступ по подписке проверяется отдельно.",
    recover: "Восстановить записи устройства",
    recoveryTitle: "Записи устройства остались здесь.",
    recoveryBody:
      "Экспортируйте оригинальные записи устройства перед входом или переносом. Экспорт не отправляет и не объединяет их.",
    export: "Экспортировать архив восстановления",
    back: "Назад ко входу",
    review: "Просмотреть записи устройства",
    error: "Не удалось прочитать записи. Ничего не удалено.",
  },
};
export const authCopy = (lang) => text[lang] || text.en;
