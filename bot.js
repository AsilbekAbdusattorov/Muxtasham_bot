const { Telegraf, session } = require("telegraf");
const fs = require("fs");

const bot = new Telegraf("7690252639:AAErU_goKNL3HxVSynY073bORs0o7jXh2Kg"); // Tokenni o'zgartiring
const bookingsFile = "bookings.json";

// Bookinglar faylini tekshirish va yaratish
if (!fs.existsSync(bookingsFile)) {
  fs.writeFileSync(bookingsFile, JSON.stringify([]));
}

bot.use(session());

// Foydalanuvchilarni boshlash vaqti va sonini saqlash
const userStartCounts = {}; // foydalanuvchi uchun start tugmasi bosish sonini saqlash

bot.start((ctx) => {
  const userId = ctx.from.id;

  if (!userStartCounts[userId]) {
    userStartCounts[userId] = 1; // Agar foydalanuvchi birinchi marta bosgan bo'lsa, 1 ga o'rnatamiz
  } else {
    userStartCounts[userId] += 1; // Foydalanuvchi har safar bosganda 1 ga oshiramiz
  }

  // Agar foydalanuvchi ikki marta bosgan bo'lsa, startni cheklash
  if (userStartCounts[userId] > 2) {
    return ctx.reply("Siz bugun ikki marta start tugmasini bosdingiz. Iltimos, ertaga qaytib ko'ring.");
  }

  ctx.reply("Tilni tanlang | Choose a language | Выберите язык", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🇺🇿 Oʻzbek", callback_data: "lang_uz" }],
        [{ text: "🇬🇧 English", callback_data: "lang_en" }],
        [{ text: "🇷🇺 Русский", callback_data: "lang_ru" }],
      ],
    },
  });
});

bot.action(/lang_(uz|en|ru)/, (ctx) => {
  const lang = ctx.match[1];

  if (!ctx.session) {
    ctx.session = {};
  }

  ctx.session.lang = lang;
  const messages = {
    uz: "Xush kelibsiz! Xona band qilish uchun quyidagi tugmani bosing.",
    en: "Welcome! Click the button below to book a room.",
    ru: "Добро пожаловать! Нажмите кнопку ниже, чтобы забронировать комнату.",
  };
  const buttonLabels = {
    uz: "🛏 Xona band qilish",
    en: "🛏 Book a room",
    ru: "🛏 Забронировать комнату",
  };
  ctx.reply(messages[lang], {
    reply_markup: {
      inline_keyboard: [
        [{ text: buttonLabels[lang], callback_data: "book_room" }],
      ],
    },
  });
});

bot.action("book_room", (ctx) => {
  ctx.session.step = "waiting_for_date";
  const messages = {
    uz: "Iltimos, oy va kunni kiriting (MM-DD shaklida):",
    en: "Please enter the month and day (in MM-DD format):",
    ru: "Пожалуйста, введите месяц и день (в формате MM-DD):",
  };
  ctx.reply(messages[ctx.session.lang]);
});

bot.on("text", (ctx) => {
  const lang = ctx.session.lang || "uz";
  const messages = {
    uz: {
      invalid_date: "⚠️ Noto‘g‘ri format! Iltimos, MM-DD shaklida kiriting (masalan: 05-12)",
      select_room: "Bo‘sh xonalardan birini tanlang:",
      enter_name: "Ismingiz va familiyangizni kiriting:",
      enter_phone: "Telefon raqamingizni kiriting:",
      confirm: 'Tasdiqlash: \nXona: {room}\nSana: {date}\nIsm: {name}\nTelefon: {phone}\nTasdiqlash uchun "Ha" deb yozing.',
      success: "✅ Xona muvaffakatli band qilindi!",
      invalid_name: "⚠️ Ism va familiya to'g'ri kiriting.",
      invalid_phone: "⚠️ Telefon raqami 9 raqamdan iborat bo'lishi kerak!",
      already_booked: "⚠️ Siz bugun ikki marta band qildingiz!",
    },
    en: {
      invalid_date: "⚠️ Invalid format! Please enter in MM-DD format (e.g., 05-12)",
      select_room: "Please select an available room:",
      enter_name: "Please enter your full name:",
      enter_phone: "Please enter your phone number:",
      confirm: 'Confirmation: \nRoom: {room}\nDate: {date}\nName: {name}\nPhone: {phone}\nType "Yes" to confirm.',
      success: "✅ Room successfully booked!",
      invalid_name: "⚠️ Please enter a valid name.",
      invalid_phone: "⚠️ Phone number must be 9 digits long!",
      already_booked: "⚠️ You've already booked twice today!",
    },
    ru: {
      invalid_date: "⚠️ Неверный формат! Пожалуйста, введите в формате MM-DD (например: 05-12)",
      select_room: "Выберите одну из свободных комнат:",
      enter_name: "Введите ваше имя и фамилию:",
      enter_phone: "Введите ваш номер телефона:",
      confirm: 'Подтверждение: \nКомната: {room}\nДата: {date}\nИмя: {name}\nТелефон: {phone}\nВведите "Да" для подтверждения.',
      success: "✅ Комната успешно забронирована!",
      invalid_name: "⚠️ Введите правильное имя.",
      invalid_phone: "⚠️ Телефонный номер должен содержать 9 цифр!",
      already_booked: "⚠️ Вы уже забронировали дважды сегодня!",
    },
  };

  const userId = ctx.from.id;
  const date = ctx.session.date;

  if (ctx.session.step === "waiting_for_date") {
    const datePattern = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
    if (!datePattern.test(ctx.message.text)) {
      return ctx.reply(messages[lang].invalid_date);
    }

    const bookings = JSON.parse(fs.readFileSync(bookingsFile, "utf8"));
    const userBookingsToday = bookings.filter(
      (b) => b.userId === userId && b.date === date
    ).length;

    if (userBookingsToday >= 2) {
      return ctx.reply(messages[lang].already_booked);
    }

    ctx.session.date = ctx.message.text;
    ctx.session.step = "waiting_for_room";
    ctx.reply(messages[lang].select_room, {
      reply_markup: {
        inline_keyboard: getAvailableRooms(ctx.session.date, lang),
      },
    });
  } else if (ctx.session.step === "waiting_for_name") {
    const namePattern = /^[A-Za-zА-Яа-яЁё\s-]+$/;
    if (!namePattern.test(ctx.message.text)) {
      return ctx.reply(messages[lang].invalid_name);
    }
    ctx.session.name = ctx.message.text;
    ctx.session.step = "waiting_for_phone";
    ctx.reply(messages[lang].enter_phone);
  } else if (ctx.session.step === "waiting_for_phone") {
    const phonePattern = /^\d{9}$/;
    if (!phonePattern.test(ctx.message.text)) {
      return ctx.reply(messages[lang].invalid_phone);
    }
    ctx.session.phone = ctx.message.text;
    ctx.session.step = "confirm_booking";
    ctx.reply(
      messages[lang].confirm
        .replace("{room}", ctx.session.room)
        .replace("{date}", ctx.session.date)
        .replace("{name}", ctx.session.name)
        .replace("{phone}", ctx.session.phone)
    );
  } else if (
    ctx.session.step === "confirm_booking" &&
    (ctx.message.text.toLowerCase() === "ha" ||
      ctx.message.text.toLowerCase() === "yes" ||
      ctx.message.text.toLowerCase() === "да")
  ) {
    saveBooking(ctx.session);
    ctx.reply(messages[lang].success);
  }
});

bot.action(/room_(\d+)/, (ctx) => {
  ctx.session.room = `${ctx.session.lang === "uz" ? "Xona" : "Room"} ${
    ctx.match[1]
  }`;
  ctx.session.step = "waiting_for_name";

  const messages = {
    uz: "Ismingiz va familiyangizni kiriting:",
    en: "Please enter your full name:",
    ru: "Введите ваше имя и фамилию:",
  };

  ctx.reply(messages[ctx.session.lang]);
});

function getAvailableRooms(date, lang) {
  let bookings = [];
  try {
    bookings = JSON.parse(fs.readFileSync(bookingsFile, "utf8"));
  } catch (error) {
    fs.writeFileSync(bookingsFile, JSON.stringify([]));
  }

  const bookedRooms = bookings
    .filter((b) => b.date === date)
    .map((b) => b.room);
  let buttons = [];
  for (let i = 1; i <= 15; i++) {
    if (!bookedRooms.includes(`Xona ${i}`)) {
      buttons.push([
        {
          text: `${
            lang === "uz" ? "Xona" : lang === "en" ? "Room" : "Комната"
          } ${i}`,
          callback_data: `room_${i}`,
        },
      ]);
    }
  }
  return buttons.length > 0
    ? buttons
    : [[{ text: "❌ Barcha xonalar band", callback_data: "none" }]];
}

function saveBooking(session) {
  let bookings = [];
  try {
    bookings = JSON.parse(fs.readFileSync(bookingsFile, "utf8"));
  } catch (error) {
    bookings = [];
  }

  bookings.push({
    date: session.date,
    room: session.room,
    name: session.name,
    phone: session.phone,
    userId: session.userId,
  });

  fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2));

  const channelChatId = "-1002454056913"; // Channel chat ID
  const confirmationMessage =
    `Yangi buyurtma:\n\n` +
    `Xona: ${session.room}\n` +
    `Sana: ${session.date}\n` +
    `Ism: ${session.name}\n` +
    `Telefon: ${session.phone}\n`;

  bot.telegram.sendMessage(channelChatId, confirmationMessage);
}

bot.launch();
