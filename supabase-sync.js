/* GrowBridge cloud layer — Supabase login + automatic data sync.
   - No config  -> local mode (exactly as before).
   - With config -> sign-in screen, then the app starts with the user's cloud data.
   Data is mirrored in localStorage (fast, works offline) and pushed to Supabase table `app_data`. */
(function () {
    "use strict";

    var CFG = window.GROWBRIDGE_SUPABASE || {};
    var SYNC_KEYS = ["growbridgeProducts", "growbridgeTotalSales", "growbridgeCustomers", "growbridgeSalesHistory"];
    var DIRTY_KEY = "growbridgeDirty";
    var UID_KEY = "growbridgeUserId";
    var SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
    var V = "?v=9";

    var client = null, session = null, signingOut = false, role = localStorage.getItem("growbridgeRole") || "seller";
    var dirty = {}, dirtyVer = {}, timer = null, retry = null, pill = null;
    var nativeSet = Storage.prototype.setItem;

    // ---------- tiny helpers ----------
    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }
    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = function () { reject(new Error("Could not load " + src)); };
            document.body.appendChild(s);
        });
    }
    function startApp() {
        var list = document.body.dataset.app === "shop" ? ["shop.js"] : ["script.js", "assistant.js"];
        if (document.body.classList.contains("page-orders")) list.push("orders.js");
        return list.reduce(function (p, f) { return p.then(function () { return loadScript(f + V); }); }, Promise.resolve())
            .then(function () { document.dispatchEvent(new CustomEvent("gb-scripts-loaded")); });
    }
    function parseVal(raw) { try { return JSON.parse(raw); } catch (e) { return raw; } }
    function toRaw(v) { return typeof v === "string" ? v : JSON.stringify(v); }
    function lockPage(on) { document.documentElement.classList.toggle("gb-locked", on); }

    // ---------- local mode ----------
    if (!CFG.url || !CFG.anonKey) {
        startApp();
        return;
    }

    lockPage(true);
    try { dirty = JSON.parse(localStorage.getItem(DIRTY_KEY) || "{}"); } catch (e) { dirty = {}; }

    // ---------- sync status pill ----------
    function setStatus(kind) {
        if (!pill) {
            pill = el("div", "gb-sync");
            pill.setAttribute("role", "status");
            document.body.appendChild(pill);
        }
        pill.className = "gb-sync gb-sync-" + kind;
        pill.textContent = { saving: "☁ Saving…", saved: "☁ Saved", offline: "☁ Offline — will retry" }[kind];
    }

    // ---------- write-through: every save to a synced key is queued for the cloud ----------
    function persistDirty() { nativeSet.call(localStorage, DIRTY_KEY, JSON.stringify(dirty)); }
    function markDirty(key) {
        dirty[key] = true;
        dirtyVer[key] = (dirtyVer[key] || 0) + 1;
        persistDirty();
        clearTimeout(timer);
        timer = setTimeout(flush, 400);
        if (session) setStatus("saving");
    }
    Storage.prototype.setItem = function (k, v) {
        nativeSet.call(this, k, v);
        if (this === localStorage && SYNC_KEYS.indexOf(k) !== -1) markDirty(k);
    };

    function flush() {
        var keys = Object.keys(dirty);
        if (!keys.length) { if (session) setStatus("saved"); return Promise.resolve(true); }
        if (!client || !session) { return Promise.resolve(false); }

        var snapshot = {};
        var rows = [];
        keys.forEach(function (k) {
            var raw = localStorage.getItem(k);
            snapshot[k] = dirtyVer[k];
            if (raw !== null) rows.push({ user_id: session.user.id, key: k, value: parseVal(raw), updated_at: new Date().toISOString() });
        });
        if (!rows.length) { keys.forEach(function (k) { delete dirty[k]; }); persistDirty(); return Promise.resolve(true); }

        setStatus("saving");
        return client.from("app_data").upsert(rows, { onConflict: "user_id,key" }).then(function (res) {
            if (res.error) throw res.error;
            keys.forEach(function (k) { if (dirtyVer[k] === snapshot[k]) delete dirty[k]; });
            persistDirty();
            if (keys.indexOf("growbridgeProducts") !== -1 && role === "seller") mirrorProducts();
            clearTimeout(retry);
            setStatus(Object.keys(dirty).length ? "saving" : "saved");
            if (Object.keys(dirty).length) flush();
            return true;
        }).catch(function () {
            setStatus("offline");
            clearTimeout(retry);
            retry = setTimeout(flush, 8000);
            return false;
        });
    }
    window.addEventListener("online", function () { flush(); });
    document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") flush();
    });

    // Marketplace: the seller's inventory is mirrored into the shared `products` table so buyers can see it.
    function mirrorProducts() {
        var list = parseVal(localStorage.getItem("growbridgeProducts"));
        if (!Array.isArray(list)) return Promise.resolve();
        var uid = session.user.id, now = new Date().toISOString();
        var rows = list.filter(function (p) { return p && p.name; }).map(function (p) {
            return { seller_id: uid, name: String(p.name), price: Number(p.price) || 0, quantity: Math.max(0, parseInt(p.quantity, 10) || 0), updated_at: now };
        });
        var step = rows.length ? client.from("products").upsert(rows, { onConflict: "seller_id,name" }) : Promise.resolve({});
        return step.then(function (r) {
            if (r && r.error) throw r.error;
            return client.from("products").select("name").eq("seller_id", uid);
        }).then(function (r) {
            var keep = rows.map(function (x) { return x.name; });
            var gone = ((r && r.data) || []).map(function (x) { return x.name; }).filter(function (n) { return keep.indexOf(n) === -1; });
            if (gone.length) return client.from("products").delete().eq("seller_id", uid).in("name", gone);
        }).catch(function () {});               // best-effort: the app keeps working if the marketplace tables are missing
    }
    // Stock can change while the seller is away (buyer orders / cancellations): the shared table is the truth for quantities.
    function pullStock() {
        return client.from("products").select("name,quantity").eq("seller_id", session.user.id).then(function (r) {
            if (!r || r.error || !r.data || !r.data.length) return;
            var list = parseVal(localStorage.getItem("growbridgeProducts"));
            if (!Array.isArray(list)) return;
            var map = {};
            r.data.forEach(function (x) { map[x.name] = x.quantity; });
            list.forEach(function (p) { if (p && Object.prototype.hasOwnProperty.call(map, p.name)) p.quantity = map[p.name]; });
            nativeSet.call(localStorage, "growbridgeProducts", JSON.stringify(list));
        }).catch(function () {});
    }
    function loadProfile() {
        return client.from("profiles").select("role,shop_name").eq("id", session.user.id).maybeSingle().then(function (r) {
            if (r && r.data) return r.data;
            return client.from("profiles").insert({ id: session.user.id, role: "seller" }).select("role,shop_name").single()
                .then(function (x) { return (x && x.data) || { role: "seller" }; });
        }).catch(function () { return { role: role }; });
    }

    function pull() {
        return client.from("app_data").select("key,value").then(function (res) {
            if (res.error) throw res.error;
            var cloud = {};
            res.data.forEach(function (row) { cloud[row.key] = row.value; });
            SYNC_KEYS.forEach(function (k) {
                if (Object.prototype.hasOwnProperty.call(cloud, k) && !dirty[k]) {
                    nativeSet.call(localStorage, k, toRaw(cloud[k]));          // cloud wins
                } else if (!Object.prototype.hasOwnProperty.call(cloud, k) && localStorage.getItem(k) !== null) {
                    markDirty(k);                                              // first login: upload this device's data
                }
            });
        });
    }

    function clearLocalData() {
        SYNC_KEYS.concat([DIRTY_KEY, UID_KEY]).forEach(function (k) { localStorage.removeItem(k); });
        dirty = {};
    }

    // ---------- overlays ----------
    function overlay(content) {
        var old = document.querySelector(".gb-auth");
        if (old) old.remove();
        var o = el("div", "gb-auth");
        o.setAttribute("role", "dialog");
        o.setAttribute("aria-modal", "true");
        o.appendChild(content);
        document.body.appendChild(o);
        return o;
    }
    function closeOverlay() {
        var o = document.querySelector(".gb-auth");
        if (o) o.remove();
    }
    function showLoading() {
        var card = el("div", "gb-auth-card gb-auth-center");
        card.append(el("div", "gb-spinner"), el("p", "", "Loading…"));
        overlay(card);
    }

    function friendly(err) {
        var m = (err && err.message) || "";
        if (/invalid login/i.test(m)) return "Invalid email or password.";
        if (/not confirmed/i.test(m)) return "Email not confirmed. Check your inbox.";
        if (/already registered|already been registered/i.test(m)) return "This email already has an account. Sign in instead.";
        if (/fetch|network/i.test(m)) return "Could not connect. Check your internet and try again.";
        return m || "Something went wrong. Please try again.";
    }

    function showLogin(note) {
        return new Promise(function (resolve) {
            var mode = "in";
            var card = el("div", "gb-auth-card");
            var title = el("h1", "", "GrowBridge");
            var sub = el("p", "gb-auth-sub", "Sign in to open your business");
            var tabs = el("div", "gb-auth-tabs");
            var tIn = el("button", "on", "Sign in");
            var tUp = el("button", "", "Create account");
            tIn.type = tUp.type = "button";
            tabs.append(tIn, tUp);

            var lEmail = el("label", "", "Email");
            var email = el("input");
            email.type = "email"; email.autocomplete = "email"; email.inputMode = "email";
            var lPass = el("label", "", "Password");
            var pass = el("input");
            pass.type = "password"; pass.autocomplete = "current-password"; pass.minLength = 6;

            var go = el("button", "gb-auth-go", "Sign in");
            go.type = "button";
            var forgot = el("button", "gb-auth-link", "Forgot password?");
            forgot.type = "button";
            var msg = el("p", "gb-auth-msg", note || "");
            msg.setAttribute("role", "alert");

            var who = "buyer";
            var roleBox = el("div", "gb-auth-tabs");
            var rBuy = el("button", "on", "I am a buyer");
            var rSell = el("button", "", "I am a seller");
            rBuy.type = rSell.type = "button";
            roleBox.hidden = true;
            roleBox.append(rBuy, rSell);
            rBuy.addEventListener("click", function () { who = "buyer"; rBuy.className = "on"; rSell.className = ""; });
            rSell.addEventListener("click", function () { who = "seller"; rSell.className = "on"; rBuy.className = ""; });

            card.append(title, sub, tabs, roleBox, lEmail, email, lPass, pass, go, forgot, msg);

            if (localStorage.getItem(UID_KEY)) {                      // this device has used the app before
                var off = el("button", "gb-auth-link", "Continue offline");
                off.type = "button";
                off.addEventListener("click", function () { closeOverlay(); resolve("offline"); });
                card.appendChild(off);
            }
            if (window.gbLangSwitch) card.appendChild(window.gbLangSwitch());

            function setMode(m) {
                mode = m;
                tIn.className = m === "in" ? "on" : "";
                tUp.className = m === "up" ? "on" : "";
                go.textContent = m === "in" ? "Sign in" : "Create account";
                pass.autocomplete = m === "in" ? "current-password" : "new-password";
                forgot.hidden = m === "up";
                roleBox.hidden = m !== "up";
                msg.textContent = "";
            }
            function busy(on) { go.disabled = on; go.textContent = on ? "Please wait…" : (mode === "in" ? "Sign in" : "Create account"); }
            function say(t, good) { msg.textContent = t; msg.className = "gb-auth-msg" + (good ? " good" : ""); }

            function submit() {
                var e = email.value.trim(), p = pass.value;
                if (!e || p.length < 6) { say("Enter your email and a password (6+ characters)."); return; }
                busy(true);
                var req = mode === "in"
                    ? client.auth.signInWithPassword({ email: e, password: p })
                    : client.auth.signUp({ email: e, password: p, options: { data: { role: who } } });
                req.then(function (res) {
                    busy(false);
                    if (res.error) { say(friendly(res.error)); return; }
                    if (!res.data.session) { say("Account created. Check your email to confirm, then sign in.", true); setMode("in"); return; }
                    session = res.data.session;
                    closeOverlay();
                    resolve("online");
                }).catch(function (err) { busy(false); say(friendly(err)); });
            }

            tIn.addEventListener("click", function () { setMode("in"); });
            tUp.addEventListener("click", function () { setMode("up"); });
            go.addEventListener("click", submit);
            pass.addEventListener("keydown", function (ev) { if (ev.key === "Enter") submit(); });
            forgot.addEventListener("click", function () {
                var e = email.value.trim();
                if (!e) { say("Enter your email first."); return; }
                client.auth.resetPasswordForEmail(e).then(function (res) {
                    say(res.error ? friendly(res.error) : "Password reset link sent to your email.", !res.error);
                });
            });

            overlay(card);
            email.focus();
        });
    }

    function showConnectError() {
        return new Promise(function (resolve) {
            var card = el("div", "gb-auth-card gb-auth-center");
            card.append(el("h1", "", "GrowBridge"), el("p", "gb-auth-msg", "Could not connect. Check your internet and try again."));
            var retryBtn = el("button", "gb-auth-go", "Try again");
            retryBtn.type = "button";
            retryBtn.addEventListener("click", function () { location.reload(); });
            card.appendChild(retryBtn);
            if (localStorage.getItem(UID_KEY)) {
                var off = el("button", "gb-auth-link", "Continue offline");
                off.type = "button";
                off.addEventListener("click", function () { closeOverlay(); resolve(); });
                card.appendChild(off);
            }
            overlay(card);
        });
    }

    // ---------- signed-in UI ----------
    function addAccountUI(emailText) {
        var out = el("button", "gb-signout", "Sign out");
        out.type = "button";
        out.addEventListener("click", signOut);
        var header = document.querySelector(".app-header");
        if (header) header.appendChild(out);

        var foot = document.querySelector(".sidebar-footer");
        if (foot) {
            var who = el("p", "gb-who", emailText || "");
            who.setAttribute("data-no-i18n", "");
            var out2 = out.cloneNode(true);
            out2.addEventListener("click", signOut);
            foot.append(who, out2);
        }
    }

    function signOut() {
        signingOut = true;
        flush().then(function () {
            if (Object.keys(dirty).length && !confirm("Some changes are not saved yet. Sign out anyway?")) {
                signingOut = false;
                return;
            }
            return client.auth.signOut().catch(function () {}).then(function () {
                clearLocalData();
                location.reload();
            });
        });
    }

    // ---------- boot ----------
    showLoading();

    loadScript(SDK_URL).then(function () {
        client = window.supabase.createClient(CFG.url, CFG.anonKey);
        return client.auth.getSession();
    }).then(function (res) {
        session = res && res.data ? res.data.session : null;
        if (session) return "online";
        closeOverlay();
        return showLogin();
    }, function () {
        closeOverlay();
        return showConnectError().then(function () { return "offline"; });
    }).then(function (mode) {
        if (mode === "offline") { setStatus("offline"); return; }

        var uid = session.user.id;
        var stored = localStorage.getItem(UID_KEY);
        if (stored && stored !== uid) clearLocalData();                // different person on this device
        nativeSet.call(localStorage, UID_KEY, uid);

        showLoading();
        return loadProfile().then(function (profile) {
            role = profile.role === "buyer" ? "buyer" : "seller";
            nativeSet.call(localStorage, "growbridgeRole", role);
            var onShop = document.body.dataset.app === "shop";
            if (role === "buyer" && !onShop) { location.replace("shop.html"); return new Promise(function () {}); }
            if (role === "buyer") return;                              // buyers have no seller data to sync
            return flush().then(pull).then(pullStock).then(function () { setStatus("saved"); }).catch(function () { setStatus("offline"); });
        });
    }).then(function () {
        window.gbCloud = { client: client, session: session, role: role };
        closeOverlay();
        lockPage(false);
        if (session) {
            addAccountUI(session.user.email);
            client.auth.onAuthStateChange(function (event) {
                if (event === "SIGNED_OUT" && !signingOut) { clearLocalData(); location.reload(); }
            });
        }
        return startApp();
    }).catch(function () {
        closeOverlay();
        lockPage(false);
        startApp();
    });
})();
