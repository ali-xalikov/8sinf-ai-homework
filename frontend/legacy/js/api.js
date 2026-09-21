/* Basapan API yordamchi: token saqlash + so'rovlar */
(function () {
  const TOKEN_KEY = "sinf8_token";
  const USER_KEY = "sinf8_user";

  window.API = {
    get token() {
      return localStorage.getItem(TOKEN_KEY) || "";
    },
    set token(v) {
      if (v) localStorage.setItem(TOKEN_KEY, v);
      else localStorage.removeItem(TOKEN_KEY);
    },
    get user() {
      try {
        return JSON.parse(localStorage.getItem(USER_KEY) || "null");
      } catch {
        return null;
      }
    },
    set user(u) {
      if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
      else localStorage.removeItem(USER_KEY);
    },

    async request(method, url, body, isForm) {
      const headers = {};
      if (this.token) headers["Authorization"] = "Bearer " + this.token;
      let payload;
      if (body !== undefined && body !== null) {
        if (isForm) {
          payload = body;
        } else {
          headers["Content-Type"] = "application/json";
          payload = JSON.stringify(body);
        }
      }
      let res;
      try {
        res = await fetch(url, { method, headers, body: payload });
      } catch (e) {
        throw new Error("Serverga ulanib bo'lmadi. Iltimos, qayta urinib ko'ring.");
      }
      if (res.status === 401) {
        this.token = "";
        this.user = null;
        window.dispatchEvent(new CustomEvent("auth:expired"));
        throw new Error("Sessiya tugagan — qayta kiring.");
      }
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (!res.ok) {
        const msg = (data && (data.detail || data.message)) || "Xatolik yuz berdi";
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }
      return data;
    },

    get(url) {
      return this.request("GET", url);
    },
    post(url, body) {
      return this.request("POST", url, body || {});
    },
    put(url, body) {
      return this.request("PUT", url, body || {});
    },
    del(url) {
      return this.request("DELETE", url);
    },
    upload(url, formData) {
      return this.request("POST", url, formData, true);
    },
  };
})();