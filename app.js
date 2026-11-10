
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
let activeCategory = "";
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
  let toast = $("toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText =
      "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#a20f58;color:white;padding:13px 20px;border-radius:12px;z-index:99999;max-width:90%;text-align:center";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.display = "block";

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    toast.style.display = "none";
  }, 3500);
}

function openModal(id) {
  $(id)?.classList.add("show");
}

function closeModal(id) {
  $(id)?.classList.remove("show");
}

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    closeModal(button.dataset.close);
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
    category: "Üst Giyim",
    price: 499,
    stock: 0,
    description: "Rahat ve şık tasarım.",
    image: "https://images.unsplash.com/photo-1564257577-7cadc2d23e63?w=600"
  }
];

/* ÜRÜNLER */

async function loadProducts() {
  if (!db) {
    products = demoProducts;
    renderProducts();
    updateReviewProducts();
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
  updateReviewProducts();

  if (isAdmin) renderAdminProducts();
}

function renderProducts() {
  const search = ($("productSearch")?.value || "")
    .toLocaleLowerCase("tr");

  const filtered = products.filter(product => {
    const matchesCategory =
      !activeCategory || product.category === activeCategory;

    const matchesSearch =
      (product.name || "").toLocaleLowerCase("tr").includes(search);

    return product.active !== false &&
      matchesCategory &&
      matchesSearch;
  });

  $("productList").innerHTML = filtered.length
    ? filtered.map(product => {
        const available = Number(product.stock) > 0;

        return `
          <article class="product">
            <img src="${escapeHTML(product.image || "")}"
                 alt="${escapeHTML(product.name)}"
                 loading="lazy">

            <div class="product-info">
              <h3>${escapeHTML(product.name)}</h3>
              <p>${escapeHTML(product.description || "")}</p>
              <div class="price">${money(product.price)}</div>
              <p>${available
                ? "Stok: " + Number(product.stock)
                : "🔴 Stok Tükendi"}</p>

              <button data-add="${escapeHTML(product.id)}"
                ${available ? "" : "disabled"}>
                ${available ? "Sepete Ekle" : "Tükendi"}
              </button>
            </div>
          </article>
        `;
      }).join("")
    : "<p>Aradığınız ürün bulunamadı.</p>";
}

$("productSearch")?.addEventListener("input", renderProducts);

document.querySelectorAll("[data-category]").forEach(button => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    renderProducts();
  });
});

/* SEPET */

function addToCart(id) {
  const product = products.find(
    item => String(item.id) === String(id)
  );

  if (!product || Number(product.stock) <= 0) {
    return notify("Bu ürün stokta bulunmuyor.");
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
    (sum, item) => sum + Number(item.price), 0
  );

  $("cartTotal").textContent = money(total);
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

$("cartBtn")?.addEventListener("click", () => {
  renderCart();
  openModal("cartModal");
});

/* HESAP VE OTURUM */

$("accountBtn")?.addEventListener("click", () => {
  if (isAdmin) {
    openModal("adminModal");
    loadAdminData();
  } else {
    openModal("accountModal");
  }
});

$("accountForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!db) return notify("Supabase bağlantısı henüz yapılmadı.");

  const email = $("accountEmail").value.trim();
  const password = $("accountPassword").value;

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

$("registerBtn")?.addEventListener("click", async () => {
  if (!db) return notify("Supabase bağlantısı henüz yapılmadı.");

  const email = $("accountEmail").value.trim();
  const password = $("accountPassword").value;

  if (password.length < 6) {
    return notify("Şifre en az 6 karakter olmalı.");
  }

  const { error } = await db.auth.signUp({
    email,
    password
  });

  $("accountStatus").textContent = error
    ? error.message
    : "Kayıt oluşturuldu. E-postanı kontrol et.";
});

$("logoutBtn")?.addEventListener("click", async () => {
  if (!db) return;

  const { error } = await db.auth.signOut();

  if (error) return notify(error.message);

  await checkAccount();
  closeModal("accountModal");
  notify("Çıkış yapıldı.");
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
    isAdmin ? "Yönetici Paneli" : "Hesabım";

  $("adminBtn").hidden = !isAdmin;
  $("logoutBtn").hidden = !currentUser;
}

/* YÖNETİCİ PANELİ */

$("adminBtn")?.addEventListener("click", () => {
  if (!isAdmin) return notify("Yönetici yetkisi gerekli.");

  openModal("adminModal");
  loadAdminData();
});

/* FOTOĞRAF YÜKLEME */

async function uploadProductImage(file) {
  if (!db) throw new Error("Supabase bağlantısı yok.");
  if (!file) throw new Error("Ürün fotoğrafı seçin.");

  const allowed = ["image/jpeg", "image/png", "image/webp"];

  if (!allowed.includes(file.type)) {
    throw new Error("JPG, PNG veya WEBP fotoğraf seçin.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Fotoğraf en fazla 5 MB olabilir.");
  }

  const extension = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = "products/" + crypto.randomUUID() + "." + extension;

  const { error } = await db.storage
    .from("product-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;

  const { data } = db.storage
    .from("product-images")
    .getPublicUrl(path);

  return data.publicUrl;
}

/* ÜRÜN EKLEME */

$("productForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!db || !isAdmin) {
    return notify("Yönetici yetkisi gerekli.");
  }

  if (uploading) return;

  const name = $("productName").value.trim();
  const price = Number($("productPrice").value);
  const category = $("productCategory").value;
  const stock = Number($("productStock").value);
  const description = $("productDescription").value.trim();
  const file = $("productImage").files[0];

  if (!name || !category || !description || !file) {
    return notify("Tüm ürün bilgilerini ve fotoğrafı girin.");
  }

  if (!Number.isFinite(price) || price <= 0 ||
      !Number.isInteger(stock) || stock < 0) {
    return notify("Fiyat veya stok bilgisi geçersiz.");
  }

  uploading = true;
  $("addProductBtn").disabled = true;
  $("addProductBtn").textContent = "Yükleniyor...";

  try {
    const image = await uploadProductImage(file);

    const { error } = await db.from("products").insert({
      name, price, category, stock, description,
      image, active: true
    });

    if (error) throw error;

    $("productForm").reset();
    await loadProducts();
    await loadAdminData();
    notify("Ürün başarıyla eklendi.");

  } catch (error) {
    console.error(error);
    notify("Ürün eklenemedi: " + error.message);

  } finally {
    uploading = false;
    $("addProductBtn").disabled = false;
    $("addProductBtn").textContent = "Ürünü Kaydet";
  }
});

/* ÜRÜN YÖNETİMİ */

function renderAdminProducts() {
  $("adminProductList").innerHTML = products.length
    ? products.map(product => `
        <div class="admin-product">
          <b>${escapeHTML(product.name)}</b>
          <p>${money(product.price)} · Stok: ${product.stock}</p>
          <button data-stock="${escapeHTML(product.id)}">Stok Güncelle</button>
          <button data-delete="${escapeHTML(product.id)}">Ürünü Sil</button>
        </div>
      `).join("")
    : "<p>Henüz ürün yok.</p>";
}

async function updateStock(id) {
  if (!db || !isAdmin) return;

  const value = prompt("Yeni stok adedini yaz:");
  if (value === null) return;

  const stock = Number(value);

  if (!Number.isInteger(stock) || stock < 0) {
    return notify("Geçerli stok adedi girin.");
  }

  const { error } = await db.from("products")
    .update({ stock }).eq("id", id);

  if (error) return notify(error.message);

  await loadProducts();
  notify("Stok güncellendi.");
}

async function deleteProduct(id) {
  if (!db || !isAdmin) return;
  if (!confirm("Bu ürün silinsin mi?")) return;

  const { error } = await db.from("products")
    .delete().eq("id", id);

  if (error) return notify(error.message);

  cart = cart.filter(item => String(item.id) !== String(id));
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

/* SİPARİŞ */

$("checkoutForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!cart.length) return notify("Sepetiniz boş.");
  if (!db) return notify("Sipariş sistemi henüz bağlanmadı.");

  const name = $("customerName").value.trim();
  const phone = $("customerPhone").value.trim();
  const address = $("customerAddress").value.trim();

  if (!name || !phone || !address) {
    return notify("Sipariş bilgilerini doldurun.");
  }

  const grouped = {};

  cart.forEach(item => {
    grouped[item.id] = (grouped[item.id] || 0) + 1;
  });

  const items = Object.entries(grouped).map(
    ([product_id, quantity]) => ({ product_id, quantity })
  );

  const button = $("checkoutForm").querySelector('[type="submit"]');
  button.disabled = true;

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
    $("checkoutForm").reset();
    notify("Siparişiniz alındı. Sipariş numarası: " + data);
    await loadProducts();

  } catch (error) {
    console.error(error);
    notify("Sipariş oluşturulamadı: " + error.message);

  } finally {
    button.disabled = false;
  }
});

/* İLETİŞİM MESAJI */

$("contactForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!db) return notify("Mesaj sistemi henüz bağlanmadı.");

  const name = $("contactName").value.trim();
  const email = $("contactEmail").value.trim();
  const message = $("contactMessage").value.trim();

  const { error } = await db.from("messages").insert({
    name,
    contact: email,
    message
  });

  if (error) {
    console.error(error);
    return notify("Mesaj gönderilemedi: " + error.message);
  }

  $("contactForm").reset();
  notify("Mesajınız gönderildi.");
});

/* YORUM SİSTEMİ */

function updateReviewProducts() {
  const select = $("reviewProduct");
  if (!select) return;

  select.innerHTML =
    '<option value="">Ürün seç</option>' +
    products.map(product => `
      <option value="${escapeHTML(product.id)}">
        ${escapeHTML(product.name)}
      </option>
    `).join("");
}

$("reviewForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!db) {
    $("reviewStatus").textContent =
      "Yorum sistemi henüz veritabanına bağlanmadı.";
    return;
  }

  const customerName = $("reviewName").value.trim();
  const productId = $("reviewProduct").value;
  const rating = Number($("reviewRating").value);
  const comment = $("reviewText").value.trim();

  if (!customerName || !productId || !comment ||
      rating < 1 || rating > 5) {
    $("reviewStatus").textContent = "Lütfen tüm alanları doldurun.";
    return;
  }

  const { error } = await db.from("reviews").insert({
    product_id: productId,
    customer_name: customerName,
    rating,
    comment,
    approved: false
  });

  if (error) {
    console.error(error);
    $("reviewStatus").textContent =
      "Yorum gönderilemedi: " + error.message;
    return;
  }

  $("reviewForm").reset();
  $("reviewStatus").textContent =
    "Yorumun gönderildi. Yönetici onayından sonra yayınlanacak.";

  await loadReviews();
});

async function loadReviews() {
  if (!db) {
    $("reviewList").innerHTML =
      "<p>Yorumlar, mağaza veritabanı bağlandıktan sonra görüntülenecek.</p>";
    return;
  }

  const { data, error } = await db
    .from("reviews")
    .select("*, products(name)")
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    $("reviewList").textContent = "Yorumlar yüklenemedi.";
    return;
  }

  $("reviewList").innerHTML = (data || []).length
    ? data.map(review => `
        <article class="review-card">
          <h3>${escapeHTML(review.customer_name)}</h3>
          <p class="review-stars">${"★".repeat(Number(review.rating))}${"☆".repeat(5 - Number(review.rating))}</p>
          <small>${escapeHTML(review.products?.name || "Ürün")}</small>
          <p>${escapeHTML(review.comment)}</p>
        </article>
      `).join("")
    : "<p>Henüz onaylanmış yorum yok.</p>";
}

/* YÖNETİCİ VERİLERİ */

async function loadAdminData() {
  if (!db || !isAdmin) return;

  renderAdminProducts();

  const { data: messages, error: messageError } = await db
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false });

  $("adminMessageList").innerHTML = messageError
    ? "Mesajlar yüklenemedi."
    : (messages || []).map(item => `
        <div class="admin-message">
          <b>${escapeHTML(item.name)}</b>
          <p>${escapeHTML(item.contact || "")}</p>
          <p>${escapeHTML(item.message)}</p>
        </div>
      `).join("") || "Henüz mesaj yok.";

  const { data: orders, error: orderError } = await db
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  $("adminOrderList").innerHTML = orderError
    ? "Siparişler yüklenemedi."
    : (orders || []).map(item => `
        <div class="admin-order">
          <b>${escapeHTML(item.customer_name)}</b>
          <p>Telefon: ${escapeHTML(item.phone)}</p>
          <p>Adres: ${escapeHTML(item.address)}</p>
          <p>Toplam: ${money(item.total)}</p>
          <p>Durum: ${escapeHTML(item.status)}</p>
        </div>
      `).join("") || "Henüz sipariş yok.";

  await loadAdminReviews();
}

/* YÖNETİCİ YORUM ONAYI */

async function loadAdminReviews() {
  const container = $("adminReviews");
  if (!container || !db || !isAdmin) return;

  const { data, error } = await db
    .from("reviews")
    .select("*, products(name)")
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "Yorumlar yüklenemedi.";
    return;
  }

  container.innerHTML = (data || []).length
    ? data.map(review => `
        <div class="admin-review">
          <b>${escapeHTML(review.customer_name)}</b>
          <p>${escapeHTML(review.products?.name || "Ürün")}</p>
          <p>${"★".repeat(Number(review.rating))}</p>
          <p>${escapeHTML(review.comment)}</p>
          <p>Durum: ${review.approved ? "Onaylandı" : "Onay bekliyor"}</p>
          ${review.approved ? "" : `
            <button data-approve-review="${escapeHTML(review.id)}">
              Yorumu Onayla
            </button>
          `}
          <button data-delete-review="${escapeHTML(review.id)}">
            Yorumu Sil
          </button>
        </div>
      `).join("")
    : "Henüz yorum yok.";
}

document.addEventListener("click", async event => {
  const approve = event.target.closest("[data-approve-review]");
  const remove = event.target.closest("[data-delete-review]");

  if (!db || !isAdmin) return;

  if (approve) {
    const { error } = await db.from("reviews")
      .update({ approved: true })
      .eq("id", approve.dataset.approveReview);

    if (error) return notify("Yorum onaylanamadı.");

    await loadAdminReviews();
    await loadReviews();
    notify("Yorum yayınlandı.");
  }

  if (remove) {
    if (!confirm("Bu yorum silinsin mi?")) return;

    const { error } = await db.from("reviews")
      .delete()
      .eq("id", remove.dataset.deleteReview);

    if (error) return notify("Yorum silinemedi.");

    await loadAdminReviews();
    await loadReviews();
    notify("Yorum silindi.");
  }
});

/* SOSYAL MEDYA */

function loadContactLinks() {
  const social = $("socialLinks");
  if (!social) return;

  const instagram = (config.INSTAGRAM_USERNAME || "").replace("@", "");
  const whatsapp = (config.WHATSAPP_NUMBER || "").replace(/\D/g, "");

  social.innerHTML = `
    ${instagram
      ? `<a href="https://instagram.com/${encodeURIComponent(instagram)}" target="_blank" rel="noopener">Instagram</a>`
      : ""}
    ${whatsapp
      ? `<a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener">WhatsApp</a>`
      : ""}
  `;
}

/* AUTH TAKİBİ */

if (db) {
  db.auth.onAuthStateChange(() => {
    setTimeout(checkAccount, 0);
  });
}

/* BAŞLAT */

async function start() {
  loadContactLinks();
  await checkAccount();
  await loadProducts();
  await loadReviews();
  renderCart();
}

start();
