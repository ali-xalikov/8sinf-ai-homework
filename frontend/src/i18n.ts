import { useEffect, useState } from "react";

export type Lang = "uz" | "ru" | "en";

const KEY = "sinf8_lang";

const STRINGS: Record<Lang, Record<string, string>> = {
  uz: {
    app_title: "8-sinf AI Homework",
    nav_home: "Bosh sahifa",
    nav_books: "Kitoblar",
    nav_ai: "AI",
    nav_chat: "Chat",
    nav_answers: "Javoblar",
    nav_history: "Tarix",
    nav_saved: "Saqlanganlar",
    nav_profile: "Profil",
    ai_off: "o‘chirilgan",

    hi: "Salom, {name} 👋",
    hi_sub: "Bugun nimani o‘rganamiz?",
    quick_card: "Tez yechish",
    quick_solve: "Yechish",
    dash_title: "Uy vazifalari paneli",
    stat_solved: "Yechilgan",
    stat_saved: "Saqlangan",
    stat_subjects: "Fanlar",
    subjects_label: "Fanlar bo‘yicha",
    recent_title: "So‘nggi savollar",
    no_recent: "Hali savollar yo‘q. AI bo‘limiga o‘ting!",
    browse_books: "Kitoblarni ko‘rish",

    ai_title: "AI Uy vazifasi",
    ai_sub: "Matn yozing, rasm yuqorlang yoki ovoz bilan so‘rang.",
    mode_text: "Matn",
    mode_image: "Rasm",
    mode_text_desc: "Savolingizni yozing yoki ovoz bilan so‘rang — AI darhol javob beradi.",
    mode_image_desc: "Uy vazifasi yoki qo‘l yozuvi suratini yuklang — AI taniydi va yechadi.",
    write_question: "Masalangizni yozing…",
    solve: "Yechish",
    solving: "Yechilmoqda…",
    clear: "Tozalash",
    examples_label: "Misol:" ,
    mic_hint: "Mikrofon orqali so‘rang",
    listening: "Tinglanmoqda…",
    mic_unsupported: "Brauzeringiz ovozli kiritishni qo‘llamaydi",
    upload_image: "Rasm yuklash",
    take_photo: "Suratga olish",
    homework_photo: "Uy vazifasi surati",
    handwriting_mode: "Qo‘l yozuvi rejimi",
    handwriting_desc: "Qo‘l yozilgan ishni taniy oladi, xatolarni tuzatadi",
    photo_mode: "Daftar / qo‘l yozuvi",
    add_question: "Qo‘shimcha savol (ixtiyoriy)",
    recognizing: "Taniqdanmoqda…",
    recognized_text: "Rasmdan taniqan matn",
    detected_subject: "Fan",
    change_image: "Boshqa rasm",
    image_required: "Avval rasm yuklang",
    toast_working: "AI ishlamoqda…",

    save: "Saqlash",
    saved: "Saqlandi!",
    share: "Ulashish",
    copy: "Nusxalash",
    copied: "Nusxalandi",
    export: "Eksport",
    export_pdf: "PDF yuklab olish",
    export_word: "Word yuklab olish",
    export_print: "Chop etish",
    plan_general: "Umumiy bilim",
    plan_book: "Kitobdan topildi",
    plan_image: "Rasmdan",

    chat_title: "AI Chat",
    chat_sub: "Savol bering va suhbatni davom ettiring.",
    new_chat: "Yangi suhbat",
    enter_message: "Xabaringizni yozing…",
    send: "Yuborish",
    no_chats: "Hali suhbat yo‘q. «Yangi suhbat» tugmasini bosing!",
    empty_chat: "Suhbat boshlang — savolingizni yozing. AI kontekstni eslab qoladi.",
    delete_chat: "Suhbatni o‘chirish",
    confirm_delete: "Haqiqatan o‘chirmoqchimisiz?",

    status_ready: "Yechim tayyor",
    status_blocked: "Cheklov",
    status_clarify: "Aniqlashtiring",
    status_no_llm: "AI sozlanmagan",
    status_error: "Xatolik",
    src_manba: "Manba",
    err_generic: "Xatolik yuz berdi",
  },
  ru: {
    app_title: "8-класс AI Домашка",
    nav_home: "Главная",
    nav_books: "Книги",
    nav_ai: "AI",
    nav_chat: "Чат",
    nav_answers: "Ответы",
    nav_history: "История",
    nav_saved: "Сохранённые",
    nav_profile: "Профиль",
    ai_off: "выключен",

    hi: "Привет, {name} 👋",
    hi_sub: "Что сегодня изучаем?",
    quick_card: "Быстрое решение",
    quick_solve: "Решить",
    dash_title: "Панель домашних заданий",
    stat_solved: "Решено",
    stat_saved: "Сохранено",
    stat_subjects: "Предметы",
    subjects_label: "По предметам",
    recent_title: "Последние вопросы",
    no_recent: "Вопросов пока нет. Перейдите в раздел AI!",
    browse_books: "Смотреть книги",

    ai_title: "AI Домашка",
    ai_sub: "Введите текст, загрузите фото или спросите голосом.",
    mode_text: "Текст",
    mode_image: "Фото",
    mode_text_desc: "Напишите вопрос или спросите голосом — AI сразу ответит.",
    mode_image_desc: "Загрузите фото задания или рукописи — AI распознает и решит.",
    write_question: "Напишите задачу…",
    solve: "Решить",
    solving: "Решаем…",
    clear: "Очистить",
    examples_label: "Пример:",
    mic_hint: "Спросить через микрофон",
    listening: "Слушаем…",
    mic_unsupported: "Ваш браузер не поддерживает голосовой ввод",
    upload_image: "Загрузить фото",
    take_photo: "Сфотографировать",
    homework_photo: "Фото задания",
    handwriting_mode: "Режим рукописи",
    handwriting_desc: "Распознаёт рукописную работу и исправляет ошибки",
    photo_mode: "Тетрадь / рукопись",
    add_question: "Дополнительный вопрос (необязательно)",
    recognizing: "Распознаём…",
    recognized_text: "Распознанный текст",
    detected_subject: "Предмет",
    change_image: "Другое фото",
    image_required: "Сначала загрузите фото",
    toast_working: "AI работает…",

    save: "Сохранить",
    saved: "Сохранено!",
    share: "Поделиться",
    copy: "Копировать",
    copied: "Скопировано",
    export: "Экспорт",
    export_pdf: "Скачать PDF",
    export_word: "Скачать Word",
    export_print: "Печать",
    plan_general: "Общие знания",
    plan_book: "Найдено в книге",
    plan_image: "Из фото",

    chat_title: "AI Чат",
    chat_sub: "Задавайте вопросы и продолжайте диалог.",
    new_chat: "Новый чат",
    enter_message: "Напишите сообщение…",
    send: "Отправить",
    no_chats: "Чатов пока нет. Нажмите «Новый чат»!",
    empty_chat: "Начните диалог — напишите вопрос. AI запомнит контекст.",
    delete_chat: "Удалить чат",
    confirm_delete: "Точно удалить?",

    status_ready: "Решение готово",
    status_blocked: "Ограничение",
    status_clarify: "Уточните",
    status_no_llm: "AI не настроен",
    status_error: "Ошибка",
    src_manba: "Источник",
    err_generic: "Произошла ошибка",
  },
  en: {
    app_title: "8th Grade AI Homework",
    nav_home: "Home",
    nav_books: "Books",
    nav_ai: "AI",
    nav_chat: "Chat",
    nav_answers: "Answers",
    nav_history: "History",
    nav_saved: "Saved",
    nav_profile: "Profile",
    ai_off: "off",

    hi: "Hello, {name} 👋",
    hi_sub: "What shall we learn today?",
    quick_card: "Quick solve",
    quick_solve: "Solve",
    dash_title: "Homework dashboard",
    stat_solved: "Solved",
    stat_saved: "Saved",
    stat_subjects: "Subjects",
    subjects_label: "By subject",
    recent_title: "Recent questions",
    no_recent: "No questions yet. Go to AI!",
    browse_books: "Browse books",

    ai_title: "AI Homework",
    ai_sub: "Type, upload a photo or ask by voice.",
    mode_text: "Text",
    mode_image: "Image",
    mode_text_desc: "Type your question or ask by voice — AI answers instantly.",
    mode_image_desc: "Upload a photo of the task or handwriting — AI reads and solves it.",
    write_question: "Write your problem…",
    solve: "Solve",
    solving: "Solving…",
    clear: "Clear",
    examples_label: "Examples:",
    mic_hint: "Ask via microphone",
    listening: "Listening…",
    mic_unsupported: "Your browser does not support voice input",
    upload_image: "Upload image",
    take_photo: "Take a photo",
    homework_photo: "Homework photo",
    handwriting_mode: "Handwriting mode",
    handwriting_desc: "Recognizes handwritten work and corrects mistakes",
    photo_mode: "Notebook / handwriting",
    add_question: "Extra question (optional)",
    recognizing: "Recognizing…",
    recognized_text: "Recognized text",
    detected_subject: "Subject",
    change_image: "Another image",
    image_required: "Upload an image first",
    toast_working: "AI is working…",

    save: "Save",
    saved: "Saved!",
    share: "Share",
    copy: "Copy",
    copied: "Copied",
    export: "Export",
    export_pdf: "Download PDF",
    export_word: "Download Word",
    export_print: "Print",
    plan_general: "General knowledge",
    plan_book: "Found in book",
    plan_image: "From image",

    chat_title: "AI Chat",
    chat_sub: "Ask questions and keep the conversation going.",
    new_chat: "New chat",
    enter_message: "Type your message…",
    send: "Send",
    no_chats: "No chats yet. Click «New chat»!",
    empty_chat: "Start a conversation — write your question. AI remembers the context.",
    delete_chat: "Delete chat",
    confirm_delete: "Really delete?",

    status_ready: "Solution ready",
    status_blocked: "Restricted",
    status_clarify: "Clarify",
    status_no_llm: "AI not configured",
    status_error: "Error",
    src_manba: "Source",
    err_generic: "Something went wrong",
  },
};

export function loadLang(): Lang {
  const v = localStorage.getItem(KEY);
  if (v === "uz" || v === "ru" || v === "en") return v;
  return "uz";
}

export function setLang(l: Lang) {
  localStorage.setItem(KEY, l);
}

export function translate(lang: Lang, key: string, vars?: Record<string, string>): string {
  const table = STRINGS[lang] || STRINGS.uz;
  let s = table[key] !== undefined ? table[key] : STRINGS.uz[key] !== undefined ? STRINGS.uz[key] : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  }
  return s;
}

export function langOfSpeechRecognition(lang: Lang): string {
  return lang === "ru" ? "ru-RU" : lang === "en" ? "en-US" : "uz-UZ";
}

export function useLang() {
  const [lang, set] = useState<Lang>(loadLang);
  useEffect(() => {
    setLang(lang);
  }, [lang]);
  const t = (key: string, vars?: Record<string, string>) => translate(lang, key, vars);
  return { lang, setLang: set, t };
}