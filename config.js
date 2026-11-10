
/* =========================================
   BUTİK ŞENAY
   MAĞAZA AYARLARI
   ========================================= */

window.BUTIK_CONFIG = {

  // VERİTABANI BAĞLANTISI
  SUPABASE_URL: "https://aynnohvdurstvuamkdpo.supabase.co/rest/v1/",
  SUPABASE_ANON_KEY: "sb_publishable_eSY5WbDFEA_c02SoGM0AKA_ziDsJJk6",

  // MAĞAZA KİMLİĞİ
  STORE_NAME: "BUTİK ŞENAY",
  STORE_DESCRIPTION: "Şıklığın en güzel hali.",
  STORE_TAGLINE: "Zarafetin yeni adresi",

  // İLETİŞİM
  INSTAGRAM_USERNAME: "",
  WHATSAPP_NUMBER: "",
  CONTACT_EMAIL: "",

  // PARA BİRİMİ
  STORE_CURRENCY: "TRY",
  CURRENCY_LOCALE: "tr-TR",

  // TASARIM RENKLERİ
  PRIMARY_COLOR: "#a20f58",
  DARK_COLOR: "#71083d",
  SECONDARY_COLOR: "#c6a04b",
  BACKGROUND_COLOR: "#ffffff",
  LIGHT_COLOR: "#fff0f6",

  // MAĞAZA AYARLARI
  STORE_ACTIVE: true,
  GUEST_CHECKOUT: true,
  CUSTOMER_REGISTRATION: true,

  // GÜVENLİK
  SINGLE_ADMIN: true,
  ADMIN_ROLE: "admin",
  CUSTOMER_ROLE: "customer",

  // ÜRÜN AYARLARI
  MAX_IMAGE_SIZE_MB: 5,
  ALLOWED_IMAGE_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp"
  ],

  // SİPARİŞ AYARLARI
  ORDER_STATUSES: [
    "Yeni",
    "Hazırlanıyor",
    "Kargoya Verildi",
    "Tamamlandı",
    "İptal Edildi"
  ],

  // YORUM AYARLARI
  REVIEW_MIN_RATING: 1,
  REVIEW_MAX_RATING: 5,
  REVIEW_REQUIRES_APPROVAL: true

};
