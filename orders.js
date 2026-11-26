/* GrowBridge seller side: shop details + incoming marketplace orders. */
(function () {
    "use strict";
    var G = window.gbCloud, list = document.getElementById("orders-list"), form = document.getElementById("shop-profile-form");
    if (!list) return;
    function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
    function tsh(n) { return "TSh " + Number(n || 0).toLocaleString("en-TZ"); }
    if (!G || !G.client || !G.session) { list.appendChild(h("p", "empty-row", "Orders need cloud sign-in. Add your Supabase keys in supabase-config.js.")); return; }

    var c = G.client, uid = G.session.user.id, msg = document.getElementById("shop-profile-msg");
    var LABEL = { pending: "New", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled" };

    c.from("profiles").select("shop_name,phone,momo_network,momo_number").eq("id", uid).maybeSingle().then(function (r) {
        var p = (r && r.data) || {};
        document.getElementById("shop-name").value = p.shop_name || "";
        document.getElementById("shop-phone").value = p.phone || "";
        document.getElementById("momo-network").value = p.momo_network || "";
        document.getElementById("momo-number").value = p.momo_number || "";
    });
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        c.from("profiles").update({
            shop_name: document.getElementById("shop-name").value.trim() || null,
            phone: document.getElementById("shop-phone").value.trim() || null,
            momo_network: document.getElementById("momo-network").value || null,
            momo_number: document.getElementById("momo-number").value.trim() || null
        }).eq("id", uid).then(function (r) { msg.textContent = r.error ? r.error.message : "Saved ✓"; msg.className = "gb-auth-msg" + (r.error ? "" : " good"); });
    });

    function act(o, status, paid, ask) {
        if (ask && !confirm(ask)) return;
        c.rpc("seller_update_order", { p_order: o.id, p_status: status, p_paid: paid }).then(function (r) { if (r.error) alert(r.error.message); load(); });
    }

    function load() {
        return c.from("orders").select("id,status,paid,total,payment_method,payment_network,payment_ref,note,created_at,buyer_id,order_items(name,qty,unit_price)")
            .eq("seller_id", uid).order("created_at", { ascending: false }).then(function (r) {
                var orders = (r && r.data) || [], ids = orders.map(function (o) { return o.buyer_id; });
                return (ids.length ? c.from("profiles").select("id,display_name,phone").in("id", ids) : Promise.resolve({ data: [] })).then(function (b) {
                    var who = {}; ((b && b.data) || []).forEach(function (p) { who[p.id] = p; });
                    list.textContent = "";
                    if (!orders.length) { list.appendChild(h("p", "empty-row", "No orders yet.")); return; }
                    orders.forEach(function (o) {
                        var box = h("div", "dashboard-card cart-box"), buyer = who[o.buyer_id] || {};
                        box.append(h("h3", "", (buyer.display_name || "Buyer") + (buyer.phone ? " · " + buyer.phone : "")),
                            h("span", o.status === "cancelled" ? "low-stock" : "available", LABEL[o.status]));
                        o.order_items.forEach(function (i) { box.appendChild(h("small", "", i.qty + " × " + i.name + " — " + tsh(i.unit_price * i.qty))); });
                        box.appendChild(h("strong", "", "Total " + tsh(o.total) + (o.paid ? " · PAID ✓" : "")));
                        box.appendChild(h("small", "", o.payment_method === "in_person" ? "Payment: in person" :
                            "Payment: " + (o.payment_network || "mobile money") + (o.payment_ref ? " · ref " + o.payment_ref : " · no reference yet")));
                        if (o.note) box.appendChild(h("small", "", "Note: " + o.note));
                        var row = h("div", "pay-opts");
                        function btn(t, fn, danger) { var b = h("button", danger ? "btn-danger" : "", t); b.type = "button"; b.addEventListener("click", fn); row.appendChild(b); }
                        if (o.status !== "cancelled" && o.status !== "completed") {
                            if (o.status === "pending") btn("Confirm", function () { act(o, "confirmed", null); });
                            if (o.status === "confirmed") btn("Complete", function () { act(o, "completed", null); });
                            if (!o.paid) btn("Mark paid", function () { act(o, o.status, true); });
                            btn("Cancel", function () { act(o, "cancelled", null, "Cancel this order and return the stock?"); }, true);
                        } else if (o.status === "completed" && !o.paid) btn("Mark paid", function () { act(o, o.status, true); });
                        box.appendChild(row); list.appendChild(box);
                    });
                });
            });
    }
    load();
    setInterval(load, 30000);
})();
