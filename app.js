
/* BUTİK ŞENAY - MAĞAZA SİSTEMİ */

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

const $ = id => document.getElementById(id);

const money = value =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY"
  }).format(Number(value) || 0);

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

function notify(message) {
  const el = $("toast");
  el.textContent = message;
  el.style.display = "block";

  setTimeout(() => {
    el.style.display = "none";
  }, 3500);
}

function openModal(id) {
  $(id).classList.add("show");
}

function closeModal(id) {
  $(id).classList.remove("show");
}

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.onclick = () => closeModal(btn.dataset.close);
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
    notify("Ürünler yüklenemedi.");
    products = [];
    return;
  }

  products = data || [];
  renderProducts();

  if (isAdmin) renderAdminProducts();
}

/* ÜRÜN KARTLARI */

function renderProducts() {
  const search = $("searchInput").value
    .toLocaleLowerCase("tr");

  const filtered = products.filter(product => {
    const matchesCategory =
      !category || product.category === category;

    const matchesSearch =
      product.name.toLocaleLowerCase("tr")
        .includes(search);

    return matchesCategory && matchesSearch;
  });

  $("productList").innerHTML = filtered.length
    ? filtered.map(product => {
        const available = product.stock > 0;

        return `
          <div class="product">
            <img
              src="${escapeHTML(product.image)}"
              alt="${escapeHTML(product.name)}"
              loading="lazy"
            >

            <div class="product-info">
              <h3>${escapeHTML(product.name)}</h3>

              <p>${escapeHTML(product.description)}</p>

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
    : "<p>Henüz ürün bulunmuyor.</p>";
}

/* KATEGORİ VE ARAMA */

$("searchInput").oninput = renderProducts;

document.querySelectorAll("[data-category]").forEach(btn => {
  btn.onclick = () => {
    category = btn.dataset.category;
    renderProducts();
  };
});

/* SEPET */

function addToCart(id) {
  const product = products.find(
    item => String(item.id) === String(id)
  );

  if (!product || product.stock <= 0) {
    notify("Ürün stokta bulunmuyor.");
    return;
  }

  const quantity = cart.filter(
    item => String(item.id) === String(id)
  ).length;

  if (quantity >= product.stock) {
    notify("Stoktaki ürünlerin tamamı sepette.");
    return;
  }

  cart.push(product);
  renderCart();
  notify("Ürün sepete eklendi.");
}

function renderCart() {
  $("cartCount").textContent = cart.length;

  $("cartItems").innerHTML = cart.length
    ? cart.map((product, index) => `
        <div style="padding:10px;border-bottom:1px solid #eee">
          <b>${escapeHTML(product.name)}</b>
          <p>${money(product.price)}</p>
          <button data-remove="${index}">Sil</button>
        </div>
      `).join("")
    : "<p>Sepetiniz boş.</p>";

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price), 0
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

$("cartBtn").onclick = () => {
  renderCart();
  openModal("cartModal");
};

/* ÜYELİK */

$("accountBtn").onclick = () => {
  if (isAdmin) {
    openModal("adminModal");
    loadAdminData();
  } else {
    openModal("accountModal");
  }
};

$("loginBtn").onclick = async () => {
  if (!db) return notify("Veritabanı bağlanmadı.");

  const { error } = await db.auth.signInWithPassword({
    email: $("email").value,
    password: $("password").value
  });

  if (error) {
    $("accountStatus").textContent = error.message;
    return;
  }

  await checkAccount();
  closeModal("accountModal");
  notify("Giriş başarılı.");
};

$("signupBtn").onclick = async () => {
  if (!db) return notify("Veritabanı bağlanmadı.");

  const { error } = await db.auth.signUp({
    email: $("email").value,
    password: $("password").value
  });

  $("accountStatus").textContent = error
    ? error.message
    : "Kayıt oluşturuldu. E-postanı kontrol et.";
};

async function checkAccount() {
  if (!db) return;

  const { data } = await db.auth.getUser();
  currentUser = data.user;

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

/* MİSAFİR VE ÜYE SİPARİŞİ */

$("checkoutBtn").onclick = async () => {
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

  const items = cart.map(item => ({
    product_id: item.id,
    quantity: 1
  }));

  const { data, error } = await db.rpc(
    "place_order",
    {
      p_name: name,
      p_phone: phone,
      p_address: address,
      p_items: items
    }
  );

  if (error) {
    $("orderStatus").textContent =
      "Sipariş oluşturulamadı: " + error.message;
    return;
  }

  cart = [];
  renderCart();

  $("orderStatus").textContent =
    "Siparişiniz alındı! Numara: " + data;

  notify("Sipariş başarıyla oluşturuldu.");
};

/* MÜŞTERİ MESAJLARI */

$("messageForm").onsubmit = async event => {
  event.preventDefault();

  if (!db) {
    return notify("Mesaj sistemi henüz bağlanmadı.");
  }

  const { error } = await db.from("messages").insert({
    name: $("messageName").value.trim(),
    contact: $("messageContact").value.trim(),
    message: $("messageText").value.trim()
  });

  if (error) {
    notify("Mesaj gönderilemedi.");
    return;
  }

  $("messageForm").reset();
  notify("Mesajınız gönderildi.");
};

/* YÖNETİCİ: ÜRÜN EKLE */

$("addProductBtn").onclick = async () => {
  if (!db || !isAdmin) {
    return notify("Yönetici yetkisi gerekli.");
  }

  const product = {
    name: $("productName").value.trim(),
    price: Number($("productPrice").value),
    category: $("productCategory").value.trim(),
    stock: Number($("productStock").value),
    image: $("productImage").value.trim(),
    description: $("productDescription").value.trim(),
    active: true
  };

  if (
    !product.name ||
    !product.category ||
    !Number.isFinite(product.price) ||
    product.price < 0 ||
    !Number.isInteger(product.stock) ||
    product.stock < 0
  ) {
    return notify("Ürün bilgilerini kontrol edin.");
  }

  const { error } = await db
    .from("products")
    .insert(product);

  if (error) return notify("Ürün eklenemedi.");

  notify("Ürün yayınlandı.");
  await loadProducts();
};

/* YÖNETİCİ: ÜRÜN LİSTESİ */

function renderAdminProducts() {
  $("adminProductList").innerHTML =
    products.map(product => `
      <div style="padding:12px;border-bottom:1px solid #ddd">
        <b>${escapeHTML(product.name)}</b>
        <p>Stok: ${product.stock}</p>

        <button data-stock="${escapeHTML(product.id)}">
          Stok Güncelle
        </button>

        <button data-delete="${escapeHTML(product.id)}">
          Ürünü Sil
        </button>
      </div>
    `).join("");
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

  if (error) return notify("Ürün silinemedi.");

  await loadProducts();
  notify("Ürün silindi.");
}

document.addEventListener("click", event => {
  const stock = event.target.closest("[data-stock]");
  const remove = event.target.closest("[data-delete]");

  if (stock) updateStock(stock.dataset.stock);
  if (remove) deleteProduct(remove.dataset.delete);
});

/* YÖNETİCİ: MESAJ VE SİPARİŞLER */

async function loadAdminData() {
  if (!db || !isAdmin) return;

  renderAdminProducts();

  const messages = await db
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false });

  $("adminMessages").innerHTML =
    (messages.data || []).map(item => `
      <div style="padding:10px;border-bottom:1px solid #ddd">
        <b>${escapeHTML(item.name)}</b>
        <p>${escapeHTML(item.contact)}</p>
        <p>${escapeHTML(item.message)}</p>
      </div>
    `).join("") || "Henüz mesaj yok.";

  const orders = await db
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  $("adminOrders").innerHTML =
    (orders.data || []).map(item => `
      <div style="padding:10px;border-bottom:1px solid #ddd">
        <b>${escapeHTML(item.customer_name)}</b>
        <p>${escapeHTML(item.phone)}</p>
        <p>${money(item.total)}</p>
        <p>Durum: ${escapeHTML(item.status)}</p>
      </div>
    `).join("") || "Henüz sipariş yok.";
}

/* İLETİŞİM */

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
  }
}

/* BAŞLAT */

async function start() {
  loadContact();
  await checkAccount();
  await loadProducts();
  renderCart();
}

start();
