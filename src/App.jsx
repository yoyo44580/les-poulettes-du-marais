import React, { useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { ShoppingBasket, Plus, Minus, ClipboardList, LogOut } from "lucide-react";

const PRODUCTS = [
  { id: "box6", name: "Boîte de 6 œufs", size: 6, price: 2.2 },
  { id: "box12", name: "Boîte de 12 œufs", size: 12, price: 4.2 },
];

export default function EggSalesPWA() {
  const [screen, setScreen] = useState("home");
  const [isLogged, setIsLogged] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [name, setName] = useState("");
  const [cart, setCart] = useState({ box6: 0, box12: 0 });
  const [deliveryDate, setDeliveryDate] = useState("");
  const [orders, setOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [stockEggs, setStockEggs] = useState(0);
  const [stockInput, setStockInput] = useState(0);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const total = useMemo(() => {
    return PRODUCTS.reduce((sum, p) => sum + cart[p.id] * p.price, 0);
  }, [cart]);

  const totalEggs = useMemo(() => {
    return PRODUCTS.reduce((sum, p) => sum + cart[p.id] * p.size, 0);
  }, [cart]);

  function updateQty(id, delta) {
    setCart((prev) => ({
      ...prev,
      [id]: Math.max(0, prev[id] + delta),
    }));
  }

  async function register(e) {
    e.preventDefault();

    if (!form.fullName || !form.email || form.password.length < 6) {
      alert("Merci de remplir le nom, l'email et un mot de passe de 6 caractères minimum.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
        },
      },
    });

    if (error) {
      alert("Erreur création compte : " + error.message);
      return;
    }

    if (!data.user) {
      alert("Compte créé. Vérifie ton email si Supabase demande une confirmation.");
      return;
    }

    setCurrentUser(data.user);
    setName(form.fullName);
    setIsLogged(true);
    setIsAdmin(false);
    setScreen("shop");

    alert("Compte créé avec succès !");
  }

  async function loginAsClient(e) {
    e.preventDefault();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (error) {
      alert("Erreur connexion : " + error.message);
      return;
    }

    const user = data.user;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      alert("Erreur récupération profil : " + profileError.message);
      return;
    }

    setCurrentUser(user);
    setName(profile.full_name || form.email);
    setIsLogged(true);

    if (profile.is_admin) {
      setIsAdmin(true);
      await loadOrders();
      setScreen("admin");
    } else {
      setIsAdmin(false);
      await loadMyOrders(user.id);
      setScreen("shop");
      await loadStock();
    }

    alert("Connexion réussie !");
  }

  async function openAdmin() {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      alert("Tu dois d'abord te connecter avec ton compte admin.");
      setScreen("login");
      return;
    }

    const user = sessionData.session.user;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      alert("Erreur profil admin : " + error.message);
      return;
    }

    if (!profile.is_admin) {
      alert("Accès refusé : ce compte n'est pas administrateur.");
      return;
    }

    setCurrentUser(user);
    setName(profile.full_name || user.email);
    setIsLogged(true);
    setIsAdmin(true);
    await loadOrders();
    setScreen("admin");
  }

  async function placeOrder() {
    if (!isLogged || !currentUser || totalEggs === 0 || !deliveryDate) {
      alert("Connecte-toi, choisis des œufs et une date.");
      return;
    }
    const eggsNeeded =
  cart.box6 * 6 +
  cart.box12 * 12;

if (eggsNeeded > stockEggs) {
  alert("Stock insuffisant.");
  return;
}
    const { error } = await supabase.from("orders").insert({
      user_id: currentUser.id,
      box6: cart.box6,
      box12: cart.box12,
      delivery_date: deliveryDate,
      status: "À préparer",
    });

    if (error) {
      alert("Erreur commande : " + error.message);
      return;
    }
    await supabase
  .from("stock")
  .update({
    eggs_available: stockEggs - eggsNeeded,
  })
  .eq("id", 1);

    await loadStock();

    await loadMyOrders(currentUser.id);

    setCart({ box6: 0, box12: 0 });
    setDeliveryDate("");
    setScreen("confirmation");

    alert("Commande enregistrée !");
  }

  async function changeStatus(id, status) {
    if (status === "Prête") {

  const order = orders.find((o) => o.id === id);

  if (order?.email) {

    await fetch(
      "https://iomagmnnazaidtmivayo.functions.supabase.co/send-order-ready-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientEmail: order.email,
          clientName: order.client,
        }),
      }
    );
  }
}
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert("Erreur mise à jour statut : " + error.message);
      return;
    }

    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  }

  async function loadOrders() {
    const { data: ordersData, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .order("delivery_date", { ascending: true });

    if (ordersError) {
      alert("Erreur chargement commandes : " + ordersError.message);
      return;
    }

    const userIds = [...new Set((ordersData || []).map((o) => o.user_id))];

    let profilesData = [];

    if (userIds.length > 0) {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) {
        alert("Erreur chargement clients : " + profilesError.message);
        return;
      }

      profilesData = data || [];
    }

    const formattedOrders = (ordersData || []).map((o) => {
      const profile = profilesData.find((p) => p.id === o.user_id);

      return {
        id: o.id,
        client: profile?.full_name || "Client",
        email: profile?.email || "",
        box6: o.box6,
        box12: o.box12,
        status: o.status,
        date: o.delivery_date,
      };
    });

    setOrders(formattedOrders);
  }

  async function loadMyOrders(userId) {
    if (!userId) {
      alert("Utilisateur introuvable. Reconnecte-toi.");
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("delivery_date", { ascending: false });

    if (error) {
      alert("Erreur chargement historique : " + error.message);
      return;
    }

    setMyOrders(data || []);
  }

  async function goToMyOrders() {
    setScreen("myOrders");

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      alert("Tu dois être connecté.");
      setScreen("login");
      return;
    }

    const user = sessionData.session.user;
    setCurrentUser(user);
    await loadMyOrders(user.id);
  }
  async function loadStock() {
  const { data, error } = await supabase
    .from("stock")
    .select("*")
    .order("id", { ascending: true })
    .limit(1);

  if (error) {
    alert("Erreur chargement stock : " + error.message);
    return;
  }

  if (!data || data.length === 0) {
    alert("Aucune ligne de stock trouvée.");
    return;
  }
  

  setStockEggs(data[0].eggs_available);
}
async function updateStock() {

  const newStock =
    stockEggs + Number(stockInput);

  if (newStock < 0) {
    alert("Le stock ne peut pas être négatif.");
    return;
  }

  const { error } = await supabase
    .from("stock")
    .update({
      eggs_available: newStock,
    })
    .eq("id", 1);

  if (error) {
    alert("Erreur mise à jour stock : " + error.message);
    return;
  }

  setStockInput(0);

  await loadStock();

  alert("Stock mis à jour !");
}
  return (
    <div className="min-h-screen bg-amber-50 text-stone-900">
      <header className="sticky top-0 z-10 border-b border-amber-200 bg-amber-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <button
            onClick={() => setScreen("home")}
            className="flex items-center gap-2 font-bold"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-300 shadow-sm">
              🥚
            </span>
            Vente d'œufs
          </button>

          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={() => setScreen("shop")}
              className="rounded-xl px-3 py-2 hover:bg-amber-100"
            >
              Boutique
            </button>

            {isLogged && !isAdmin && (
              <button
                onClick={goToMyOrders}
                className="rounded-xl px-3 py-2 hover:bg-amber-100"
              >
                Mes commandes
              </button>
            )}

            {isAdmin && (
              <button
                onClick={async () => {
                  await loadOrders();
                  setScreen("admin");
                }}
                className="rounded-xl px-3 py-2 hover:bg-amber-100"
              >
                Admin
              </button>
            )}

            {isLogged ? (
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  setCurrentUser(null);
                  setIsLogged(false);
                  setIsAdmin(false);
                  setName("");
                  setMyOrders([]);
                  setOrders([]);
                  setScreen("home");
                }}
                className="flex items-center gap-1 rounded-xl bg-white px-3 py-2 shadow-sm"
              >
                <LogOut size={16} />
                Sortir
              </button>
            ) : (
              <button
                onClick={() => setScreen("login")}
                className="rounded-xl bg-stone-900 px-3 py-2 text-white"
              >
                Connexion
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {screen === "home" && (
          <section className="rounded-3xl bg-white p-8 shadow-sm">
            <h1 className="text-4xl font-black">Commandes de boîtes d'œufs</h1>

            <p className="mt-4 text-lg text-stone-600">
              Vente simple pour ton élevage.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => setScreen("register")}
                className="rounded-2xl bg-yellow-300 px-5 py-3 font-bold"
              >
                Créer un compte
              </button>

              <button
                onClick={() => setScreen("shop")}
                className="rounded-2xl bg-stone-900 px-5 py-3 font-bold text-white"
              >
                Boutique
              </button>

              <button
                onClick={openAdmin}
                className="rounded-2xl bg-white px-5 py-3 font-bold ring-1 ring-amber-200"
              >
                Espace admin
              </button>
            </div>
          </section>
        )}

        {(screen === "register" || screen === "login") && (
          <section className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
            <h1 className="text-3xl font-black">
              {screen === "register" ? "Créer mon compte" : "Connexion"}
            </h1>

            <form
              onSubmit={screen === "register" ? register : loginAsClient}
              className="mt-6 space-y-4"
            >
              {screen === "register" && (
                <input
                  className="w-full rounded-2xl border border-amber-200 px-4 py-3"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Nom complet"
                />
              )}

              <input
                type="email"
                className="w-full rounded-2xl border border-amber-200 px-4 py-3"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email"
              />

              <input
                type="password"
                className="w-full rounded-2xl border border-amber-200 px-4 py-3"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mot de passe"
              />

              <button className="w-full rounded-2xl bg-stone-900 px-4 py-3 font-bold text-white">
                Continuer
              </button>
            </form>
          </section>
        )}

        {screen === "shop" && (
          <section className="grid gap-6 md:grid-cols-[1fr_360px]">
            <div>
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

  <h1 className="text-3xl font-black">
    Bonjour {isLogged ? name : "👋"}
  </h1>

  <div className="rounded-2xl bg-white px-5 py-3 shadow-sm">
    🥚 Stock disponible :
    <strong className="ml-2">
      {stockEggs}
    </strong>
    {" "}œufs
  </div>

</div>

              <div className="grid gap-4 md:grid-cols-2">
                {PRODUCTS.map((p) => (
                  <article key={p.id} className="rounded-3xl bg-white p-6 shadow-sm">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-yellow-100 text-3xl">
                      🥚
                    </div>

                    <h2 className="text-2xl font-bold">{p.name}</h2>
                    <p className="mt-1 text-stone-600">Œufs frais de l'élevage</p>
                    <p className="mt-4 text-3xl font-black">{p.price.toFixed(2)} €</p>

                    <div className="mt-5 flex items-center justify-between rounded-2xl bg-amber-50 p-2">
                      <button
                        onClick={() => updateQty(p.id, -1)}
                        className="rounded-xl bg-white p-3 shadow-sm"
                      >
                        <Minus size={18} />
                      </button>

                      <span className="text-xl font-bold">{cart[p.id]}</span>

                      <button
                        onClick={() => updateQty(p.id, 1)}
                        className="rounded-xl bg-yellow-300 p-3 shadow-sm"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="h-fit rounded-3xl bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ShoppingBasket />
                <h2 className="text-2xl font-bold">Commande</h2>
              </div>

              <div className="space-y-3 text-stone-700">
                <p>Boîtes de 6 : <strong>{cart.box6}</strong></p>
                <p>Boîtes de 12 : <strong>{cart.box12}</strong></p>
                <p>Nombre d'œufs : <strong>{totalEggs}</strong></p>
                <p className="border-t border-amber-100 pt-3 text-2xl font-black">
                  Total : {total.toFixed(2)} €
                </p>

                <label className="mt-4 block">
                  <span className="mb-1 block text-sm font-medium text-stone-700">
                    Date souhaitée de livraison / récupération
                  </span>

                  <input
                    type="date"
                    value={deliveryDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full rounded-2xl border border-amber-200 px-4 py-3 outline-none focus:ring-2 focus:ring-yellow-300"
                  />
                </label>
              </div>

              {!isLogged && (
                <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm">
                  Connecte-toi ou crée un compte pour valider la commande.
                </p>
              )}

              <button
                onClick={isLogged ? placeOrder : () => setScreen("register")}
                className="mt-5 w-full rounded-2xl bg-stone-900 px-4 py-3 font-bold text-white"
              >
                {isLogged ? "Valider ma commande" : "Créer mon compte"}
              </button>
            </aside>
          </section>
        )}

        {screen === "confirmation" && (
          <section className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
              ✓
            </div>

            <h1 className="text-3xl font-black">Commande enregistrée</h1>

            <p className="mt-3 text-stone-600">Ta commande est bien enregistrée.</p>

            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setScreen("shop")}
                className="rounded-2xl bg-yellow-300 px-5 py-3 font-bold"
              >
                Nouvelle commande
              </button>

              <button
                onClick={goToMyOrders}
                className="rounded-2xl bg-white px-5 py-3 font-bold ring-1 ring-amber-200"
              >
                Voir mes commandes
              </button>
            </div>
          </section>
        )}

        {screen === "myOrders" && (
          <section>
            <h1 className="mb-6 text-3xl font-black">Mes commandes</h1>

            <button
              onClick={() => setScreen("shop")}
              className="mb-6 rounded-2xl bg-yellow-300 px-4 py-2 font-bold"
            >
              Retour boutique
            </button>

            <div className="space-y-4">
              {myOrders.map((o) => (
                <div key={o.id} className="rounded-3xl bg-white p-6 shadow-sm">
                  <p><strong>Date :</strong> {o.delivery_date}</p>
                  <p><strong>Boîtes de 6 :</strong> {o.box6}</p>
                  <p><strong>Boîtes de 12 :</strong> {o.box12}</p>
                  <p><strong>Statut :</strong> {o.status}</p>
                </div>
              ))}

              {myOrders.length === 0 && (
                <div className="rounded-3xl bg-white p-6 shadow-sm">
                  Aucune commande.
                </div>
              )}
            </div>
          </section>
        )}

        {screen === "admin" && (
          <section>
            <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">

  <h2 className="mb-4 text-2xl font-black">
    Gestion du stock
  </h2>

  <p className="mb-4 text-lg">
    🥚 Stock actuel :
    <strong> {stockEggs} œufs</strong>
  </p>

  <div className="flex flex-wrap gap-3">

    <input
      type="number"
      value={stockInput}
      onChange={(e) => setStockInput(e.target.value)}
      placeholder="+50 ou -20"
      className="rounded-2xl border border-amber-200 px-4 py-3"
    />

    <button
      onClick={updateStock}
      className="rounded-2xl bg-yellow-300 px-5 py-3 font-bold"
    >
      Modifier le stock
    </button>

  </div>
</div>
            <div className="mb-5 flex items-center gap-2">
              <ClipboardList />
              <h1 className="text-3xl font-black">Espace admin</h1>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-amber-100 text-stone-700">
                  <tr>
                    <th className="p-4">Client</th>
                    <th className="p-4">Commande</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Statut</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-amber-100">
                      <td className="p-4"><strong>{o.client}</strong></td>
                      <td className="p-4">
                        {o.box6} × 6 œufs<br />
                        {o.box12} × 12 œufs
                      </td>
                      <td className="p-4">{o.date}</td>
                      <td className="p-4">
                        <select
                          value={o.status}
                          onChange={(e) => changeStatus(o.id, e.target.value)}
                          className="rounded-xl border border-amber-200 px-3 py-2"
                        >
                          <option>À préparer</option>
                          <option>Prête</option>
                          <option>Récupérée</option>
                          <option>Annulée</option>
                        </select>
                      </td>
                    </tr>
                  ))}

                  {orders.length === 0 && (
                    <tr>
                      <td className="p-4" colSpan="4">Aucune commande.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
