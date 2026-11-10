
/* =========================================
   BUTİK ŞENAY - MAĞAZA SİSTEMİ
   ========================================= */

const config = window.BUTIK_CONFIG || {};

const db = (
  config.SUPABASE_URL &&
  config.SUPABASE_ANON_KEY &&
  window.supabase
)
  ? window.supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY
    )
  : null;

let products = [];
let cart = [];
let currentUser = null;
let isAdmin = false;
let category = "";
let uploading = false;

const $ = id => document.getElementById(id);

const money = value =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY"
  }).format(Number(value) || 0);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function notify(message) {
  const el = $("toast");
  if (!el) return;

  el.textContent = message;
  el.style.display = "block";

  setTimeout(() => {
    el.style.display = "none";
  }, 3500);
}

function openModal(id) {
  $(id)?.classList.add("show");
}

function closeModal(id) {
  $(id)?.classList.remove("show");
}

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => {
    closeModal(btn.dataset.close);
  });
});

/* ÖRNEK ÜRÜNLER */

const demoProducts = [
  {
    id: "demo1",
    name: "Zarif Pembe Elbise",
    category: "Elbise",
    price: 799,
    stock: 5,
    description: "Yeni sezon şık elbise.",
    image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600"
  },
  {
    id: "demo2",
    name: "Şık Omuz Çantası",
    category: "Çanta",
    price: 649,
    stock: 3,
    description: "Günlük kullanım için zarif çanta.",
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600"
  },
  {
    id: "demo3",
    name: "Kadın Bluz",
    category: "Bluz",
    price: 499,
    stock: 0,
    description: "Rahat ve şık tasarım.",
    image: "https://images.unsplash.com/photo-1564257577-7cadc2d23e63?w=600"
  }
];

/* ÜRÜNLERİ YÜKLE */

async function loadProducts() {
  if (!db) {
    products = demoProducts;
    renderProducts();
    return;
  }

  const { data, error } = await db
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    notify("Ürünler yüklenemedi.");
    return;
  }

  products = data || [];
  renderProducts();

  if (isAdmin) renderAdminProducts();
}

/* ÜRÜN GÖRÜNTÜLEME */

function renderProducts() {
  const search = $("searchInput").value
    .toLocaleLowerCase("tr");

  const filtered = products.filter(product => {
    const matchesCategory =
      !category || product.category === category;

    const matchesSearch =
      product.name.toLocaleLowerCase("tr").includes(search);

    return product.active !== false &&
      matchesCategory &&
      matchesSearch;
  });

  $("productList").innerHTML = filtered.length
    ? filtered.map(product => {
        const available = Number(product.stock) > 0;

        return `
          <div class="product">
            <img
              src="${escapeHTML(product.image || "")}"
              alt="${escapeHTML(product.name)}"
              loading="lazy"
            >

            <div class="product-info">
              <h3>${escapeHTML(product.name)}</h3>
              <p>${escapeHTML(product.description || "")}</p>

              <div class="price">
                ${money(product.price)}
              </div>

              <p>
                ${available
                  ? "Stok: " + product.stock
                  : "🔴 Stok Tükendi"}
              </p>

              <button
                data-add="${escapeHTML(product.id)}"
                ${available ? "" : "disabled"}
              >
                ${available ? "Sepete Ekle" : "Tükendi"}
              </button>
            </div>
          </div>
        `;
      }).join("")
    : "<p>Aradığınız ürün bulunamadı.</p>";
}

/* ARAMA VE KATEGORİ */

$("searchInput").addEventListener("input", renderProducts);

document.querySelectorAll("[data-category]").forEach(btn => {
  btn.addEventListener("click", () => {
    category = btn.dataset.category;
    renderProducts();
  });
});

/* SEPET */

function addToCart(id) {
  const product = products.find(
    item => String(item.id) === String(id)
  );

  if (!product || Number(product.stock) <= 0) {
    return notify("Ürün stokta bulunmuyor.");
  }

  const quantity = cart.filter(
    item => String(item.id) === String(id)
  ).length;

  if (quantity >= Number(product.stock)) {
    return notify("Stoktaki ürünlerin tamamı sepette.");
  }

  cart.push(product);
  renderCart();
  notify("Ürün sepete eklendi.");
}

function renderCart() {
  $("cartCount").textContent = cart.length;

  $("cartItems").innerHTML = cart.length
    ? cart.map((product, index) => `
        <div class="cart-item">
          <b>${escapeHTML(product.name)}</b>
          <p>${money(product.price)}</p>
          <button data-remove="${index}">Sil</button>
        </div>
      `).join("")
    : "<p>Sepetiniz boş.</p>";

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price),
    0
  );

  $("cartTotal").textContent = "Toplam: " + money(total);
}

document.addEventListener("click", event => {
  const add = event.target.closest("[data-add]");
  const remove = event.target.closest("[data-remove]");

  if (add) addToCart(add.dataset.add);

  if (remove) {
    cart.splice(Number(remove.dataset.remove), 1);
    renderCart();
  }
});

$("cartBtn").addEventListener("click", () => {
  renderCart();
  openModal("cartModal");
});

/* HESAP VE YÖNETİCİ */

$("accountBtn").addEventListener("click", () => {
  if (isAdmin) {
    openModal("adminModal");
    loadAdminData();
  } else {
    openModal("accountModal");
  }
});

$("loginBtn").addEventListener("click", async () => {
  if (!db) return notify("Veritabanı henüz bağlanmadı.");

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || !password) {
    return notify("E-posta ve şifre girin.");
  }

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    $("accountStatus").textContent = error.message;
    return;
  }

  await checkAccount();
  closeModal("accountModal");
  notify("Giriş başarılı.");
});

$("signupBtn").addEventListener("click", async () => {
  if (!db) return notify("Veritabanı henüz bağlanmadı.");

  const email = $("email").value.trim();
  const password = $("password").value;

  if (!email || password.length < 6) {
    return notify("Geçerli e-posta ve en az 6 karakterli şifre girin.");
  }

  const { error } = await db.auth.signUp({
    email,
    password
  });

  $("accountStatus").textContent = error
    ? error.message
    : "Kayıt oluşturuldu. E-postanı kontrol et.";
});

async function checkAccount() {
  if (!db) return;

  const { data, error } = await db.auth.getUser();

  currentUser = error ? null : data.user;
  isAdmin = false;

  if (currentUser) {
    const result = await db
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    isAdmin = result.data?.role === "admin";
  }

  $("accountBtn").textContent =
    isAdmin ? "👑 Yönetici Paneli" : "Hesabım";
}

/* FOTOĞRAF YÜKLEME */

async function uploadProductImage(file) {
  if (!db) throw new Error("Supabase bağlantısı yok.");

  if (!file) throw new Error("Ürün fotoğrafı seçin.");

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error("JPG, PNG veya WEBP fotoğraf seçin.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Fotoğraf en fazla 5 MB olabilir.");
  }

  const extension = file.type.split("/")[1]
    .replace("jpeg", "jpg");

  const filePath =
    "products/" + crypto.randomUUID() + "." + extension;

  const { error } = await db.storage
    .from("product-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;

  const { data } = db.storage
    .from("product-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

/* YENİ ÜRÜN YAYINLA */

$("addProductBtn").addEventListener("click", async () => {
  if (!db || !isAdmin) {
    return notify("Yönetici yetkisi gerekli.");
  }

  if (uploading) return;

  const name = $("productName").value.trim();
  const price = Number($("productPrice").value);
  const productCategory = $("productCategory").value;
  const stock = Number($("productStock").value);
  const description = $("productDescription").value.trim();
  const file = $("productImage").files[0];

  if (!name || !productCategory || !description) {
    return notify("Ürün bilgilerini doldurun.");
  }

  if (!Number.isFinite(price) || price <= 0) {
    return notify("Geçerli bir ürün fiyatı girin.");
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return notify("Geçerli stok adedi girin.");
  }

  if (!file) return notify("Ürün fotoğrafı seçin.");

  uploading = true;
  $("addProductBtn").disabled = true;
  $("addProductBtn").textContent = "Yükleniyor...";

  try {
    const imageUrl = await uploadProductImage(file);

    const { error } = await db
      .from("products")
      .insert({
        name,
        price,
        category: productCategory,
        stock,
        description,
        image: imageUrl,
        active: true
      });

    if (error) throw error;

    $("productName").value = "";
    $("productPrice").value = "";
    $("productCategory").value = "";
    $("productStock").value = "";
    $("productDescription").value = "";
    $("productImage").value = "";

    notify("Ürün başarıyla yayınlandı.");

    await loadProducts();
    await loadAdminData();

  } catch (error) {
    console.error(error);
    notify("Ürün eklenemedi: " + error.message);

  } finally {
    uploading = false;
    $("addProductBtn").disabled = false;
    $("addProductBtn").textContent = "Ürün Yayınla";
  }
});

/* YÖNETİCİ ÜRÜN LİSTESİ */

function renderAdminProducts() {
  $("adminProductList").innerHTML = products.length
    ? products.map(product => `
        <div class="admin-product">
          <b>${escapeHTML(product.name)}</b>
          <p>Fiyat: ${money(product.price)}</p>
          <p>Stok: ${product.stock}</p>

          <button data-stock="${escapeHTML(product.id)}">
            Stok Güncelle
          </button>

          <button data-delete="${escapeHTML(product.id)}">
            Ürünü Sil
          </button>
        </div>
      `).join("")
    : "<p>Henüz ürün yok.</p>";
}

/* STOK GÜNCELLE */

async function updateStock(id) {
  if (!isAdmin || !db) return;

  const value = prompt("Yeni stok adedini yaz:");

  if (value === null) return;

  const stock = Number(value);

  if (!Number.isInteger(stock) || stock < 0) {
    return notify("Geçerli stok adedi girin.");
  }

  const { error } = await db
    .from("products")
    .update({ stock })
    .eq("id", id);

  if (error) return notify("Stok güncellenemedi.");

  await loadProducts();
  notify("Stok güncellendi.");
}

/* ÜRÜN SİL */

async function deleteProduct(id) {
  if (!isAdmin || !db) return;

  if (!confirm("Bu ürün tamamen silinsin mi?")) return;

  const { error } = await db
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    return notify("Ürün silinemedi: " + error.message);
  }

  cart = cart.filter(
    item => String(item.id) !== String(id)
  );

  renderCart();
  await loadProducts();

  notify("Ürün silindi.");
}

document.addEventListener("click", event => {
  const stock = event.target.closest("[data-stock]");
  const remove = event.target.closest("[data-delete]");

  if (stock) updateStock(stock.dataset.stock);
  if (remove) deleteProduct(remove.dataset.delete);
});

/* MÜŞTERİ MESAJLARI VE SİPARİŞLER */

async function loadAdminData() {
  if (!db || !isAdmin) return;

  renderAdminProducts();

  const messages = await db
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false });

  $("adminMessages").innerHTML =
    (messages.data || []).map(item => `
      <div class="admin-message">
        <b>${escapeHTML(item.name)}</b>
        <p>${escapeHTML(item.contact || "")}</p>
        <p>${escapeHTML(item.message)}</p>
      </div>
    `).join("") || "Henüz mesaj yok.";

  const orders = await db
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  $("adminOrders").innerHTML =
    (orders.data || []).map(item => `
      <div class="admin-order">
        <b>${escapeHTML(item.customer_name)}</b>
        <p>Telefon: ${escapeHTML(item.phone)}</p>
        <p>Adres: ${escapeHTML(item.address)}</p>
        <p>Toplam: ${money(item.total)}</p>
        <p>Durum: ${escapeHTML(item.status)}</p>
      </div>
    `).join("") || "Henüz sipariş yok.";

  if (messages.error) {
    $("adminMessages").textContent = "Mesajlar yüklenemedi.";
  }

  if (orders.error) {
    $("adminOrders").textContent = "Siparişler yüklenemedi.";
  }
}

/* SİPARİŞ OLUŞTUR */

$("checkoutBtn").addEventListener("click", async () => {
  if (!cart.length) {
    return notify("Sepetiniz boş.");
  }

  if (!db) {
    return notify("Sipariş sistemi henüz bağlanmadı.");
  }

  const name = $("buyerName").value.trim();
  const phone = $("buyerPhone").value.trim();
  const address = $("buyerAddress").value.trim();

  if (!name || !phone || !address) {
    return notify("Sipariş bilgilerini doldurun.");
  }

  const grouped = {};

  cart.forEach(item => {
    grouped[item.id] = (grouped[item.id] || 0) + 1;
  });

  const items = Object.entries(grouped).map(
    ([product_id, quantity]) => ({
      product_id,
      quantity
    })
  );

  $("checkoutBtn").disabled = true;

  try {
    const { data, error } = await db.rpc("place_order", {
      p_name: name,
      p_phone: phone,
      p_address: address,
      p_items: items
    });

    if (error) throw error;

    cart = [];
    renderCart();

    $("buyerName").value = "";
    $("buyerPhone").value = "";
    $("buyerAddress").value = "";

    $("orderStatus").textContent =
      "Siparişiniz alındı! Sipariş numarası: " + data;

    notify("Sipariş başarıyla oluşturuldu.");

    await loadProducts();

  } catch (error) {
    console.error(error);
    $("orderStatus").textContent =
      "Sipariş oluşturulamadı: " + error.message;

  } finally {
    $("checkoutBtn").disabled = false;
  }
});

/* MÜŞTERİ MESAJ GÖNDERME */

$("messageForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!db) {
    return notify("Mesaj sistemi henüz bağlanmadı.");
  }

  const name = $("messageName").value.trim();
  const contact = $("messageContact").value.trim();
  const message = $("messageText").value.trim();

  if (!name || !message) {
    return notify("Adınızı ve mesajınızı girin.");
  }

  const { error } = await db
    .from("messages")
    .insert({
      name,
      contact,
      message
    });

  if (error) {
    console.error(error);
    return notify("Mesaj gönderilemedi.");
  }

  $("messageForm").reset();
  notify("Mesajınız gönderildi.");
});

/* INSTAGRAM VE WHATSAPP */

function loadContact() {
  const instagram = config.INSTAGRAM_USERNAME;
  const whatsapp = config.WHATSAPP_NUMBER;

  $("instagramLink").onclick = event => {
    if (!instagram) {
      event.preventDefault();
      notify("Instagram hesabı henüz eklenmedi.");
    }
  };

  if (instagram) {
    $("instagramLink").href =
      "https://instagram.com/" + instagram.replace("@", "");
    $("instagramLink").target = "_blank";
  }

  $("whatsappLink").onclick = event => {
    if (!whatsapp) {
      event.preventDefault();
      notify("WhatsApp numarası henüz eklenmedi.");
    }
  };

  if (whatsapp) {
    $("whatsappLink").href =
      "https://wa.me/" + whatsapp.replace(/\D/g, "");
    $("whatsappLink").target = "_blank";
  }
}

/* AUTH OTURUM TAKİBİ */

if (db) {
  db.auth.onAuthStateChange(() => {
    setTimeout(async () => {
      await checkAccount();
    }, 0);
  });
}

/* BAŞLAT */

async function start() {
  loadContact();
  await checkAccount();
  await loadProducts();
  renderCart();
}

start();
