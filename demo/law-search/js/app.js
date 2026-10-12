/* ============================================================
 * app.js —— 界面交互逻辑
 * ============================================================ */
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };

  var CUSTOM_KEY = "law_custom_provisions";
  var FAV_KEY = "law_favorites";
  var SEARCH_HIST_KEY = "law_search_history";
  var ANA_HIST_KEY = "law_analysis_history";
  var HIST_MAX = 50;

  /* ---------- 工具 ---------- */
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function highlight(text, terms) {
    var esc = escapeHtml(text);
    if (!terms || !terms.length) return esc;
    var list = terms.slice().sort(function (a, b) { return b.length - a.length; })
      .filter(function (t) { return t && t.length >= 2; });
    list.forEach(function (t) {
      var escT = escapeHtml(t);
      if (escT) {
        esc = esc.split(escT).join("<mark>" + escT + "</mark>");
      }
    });
    return esc;
  }

  function loadCustom() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveCustom(list) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); return true; }
    catch (e) { alert("保存失败：浏览器本地存储不可用（file:// 环境下部分浏览器受限）"); return false; }
  }

  /* ---------- 收藏与历史（localStorage 持久化） ---------- */
  function loadList(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch (e) { return []; }
  }
  function saveList(key, list) {
    try { localStorage.setItem(key, JSON.stringify(list)); return true; }
    catch (e) { alert("保存失败：浏览器本地存储不可用"); return false; }
  }

  var favorites = loadList(FAV_KEY);
  var searchHist = loadList(SEARCH_HIST_KEY);
  var anaHist = loadList(ANA_HIST_KEY);

  function provKey(p) { return (p.law || "") + "|" + (p.id || ""); }

  function isFav(p) {
    var k = provKey(p);
    return favorites.some(function (f) { return f.key === k; });
  }

  function toggleFav(p) {
    var k = provKey(p);
    var idx = -1;
    for (var i = 0; i < favorites.length; i++) if (favorites[i].key === k) { idx = i; break; }
    if (idx >= 0) {
      favorites.splice(idx, 1);
      saveList(FAV_KEY, favorites);
      return false; /* 已取消收藏 */
    }
    favorites.unshift({
      key: k, time: Date.now(),
      snapshot: {
        id: p.id, law: p.law, part: p.part, chapter: p.chapter,
        title: p.title, content: p.content, keywords: p.keywords,
        topics: p.topics, summary: p.summary, isCustom: p.isCustom || false
      }
    });
    saveList(FAV_KEY, favorites);
    return true; /* 已收藏 */
  }

  function removeFav(k) {
    favorites = favorites.filter(function (f) { return f.key !== k; });
    saveList(FAV_KEY, favorites);
  }

  function pushSearchHist(q, count) {
    if (!q) return;
    searchHist = searchHist.filter(function (h) { return h.q !== q; });
    searchHist.unshift({ q: q, time: Date.now(), count: count });
    if (searchHist.length > HIST_MAX) searchHist.length = HIST_MAX;
    saveList(SEARCH_HIST_KEY, searchHist);
  }

  function pushAnaHist(text, rep) {
    if (!text) return;
    anaHist = anaHist.filter(function (h) { return h.text !== text; });
    anaHist.unshift({ text: text, time: Date.now(), rep: rep });
    if (anaHist.length > 20) anaHist.length = 20;
    saveList(ANA_HIST_KEY, anaHist);
  }

  function fmtTime(ts) {
    var d = new Date(ts);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* ---------- 初始化 ---------- */
  var customData = loadCustom();
  var allProvisions = (window.LAW_PROVISIONS || []).concat(customData.map(function (p) { p.isCustom = true; return p; }));

  var HOT_QUERIES = ["借钱不还 利息", "离婚 财产分割", "抚养权 抚养费", "彩礼 返还", "高空抛物", "押金 不退", "网购 假货 三倍", "狗咬人 没拴绳", "遗嘱 继承顺序", "诉讼时效 三年"];

  var SCENES = [
    { name: "朋友借钱不还", text: "2022年3月朋友向我借了5万元，写了借条约定一年后还，到期后一直拖着不还，微信催了很多次，请问我该怎么办？" },
    { name: "离婚争抚养权", text: "我要离婚，孩子今年6岁一直是我在带，丈夫工资比我高但常年出差不管家，孩子能判给我吗？" },
    { name: "房东扣押金", text: "退租时房东以墙面有正常磨损、地板旧了为由扣押金3000元不退，合同里没有约定赔偿条款。" },
    { name: "网购买到假货", text: "直播间买的品牌包到货鉴定为假货，商家拒绝赔偿只同意退货，我买的价格是2800元。" },
    { name: "被未拴绳的狗咬伤", text: "小区里邻居遛狗不拴绳，泰迪把我腿咬伤，打疫苗花了一千多，误工三天，对方只愿赔疫苗钱。" },
    { name: "楼上坠物砸伤", text: "楼上掉下来一个花盆把我停的车砸坏了，也差点砸到人，找不到是谁家掉的，物业也不管。" },
    { name: "彩礼分手能退吗", text: "订婚时给了18万彩礼和三金，双方没领证也没共同生活，现在女方提分手，彩礼能要回来吗？" },
    { name: "商家虚假宣传", text: "装修公司宣传全屋进口环保材料，入住后检测甲醛超标，孩子生病住院，我能否解除合同并索赔？" }
  ];

  function init() {
    LawSearch.init(allProvisions);
    $("#statProvisions").textContent = "已收录 " + allProvisions.length + " 条常用条文";

    /* 热门搜索 */
    var hotBox = document.querySelector("#hotSearch .hot-items");
    hotBox.innerHTML = HOT_QUERIES.map(function (q) {
      return '<a data-q="' + escapeHtml(q) + '">' + escapeHtml(q) + "</a>";
    }).join(" ");

    /* 场景快捷按钮 */
    $("#sceneChips").innerHTML = SCENES.map(function (s, i) {
      return '<button class="chip" data-scene="' + i + '">' + escapeHtml(s.name) + "</button>";
    }).join("");

    /* 筛选器 */
    var laws = {}, parts = {};
    allProvisions.forEach(function (p) {
      laws[p.law] = 1;
      if (p.law === "中华人民共和国民法典") parts[p.part] = 1;
    });
    var lawSel = $("#filterLaw"), partSel = $("#filterPart");
    Object.keys(laws).sort().forEach(function (l) {
      lawSel.insertAdjacentHTML("beforeend", '<option value="' + escapeHtml(l) + '">' + escapeHtml(l) + "</option>");
    });
    Object.keys(parts).forEach(function (p) {
      partSel.insertAdjacentHTML("beforeend", '<option value="' + escapeHtml(p) + '">' + escapeHtml(p) + "</option>");
    });

    bindEvents();
    renderCustomList();
    renderFormatDoc();
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents() {
    $$("#tabs .tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        $$("#tabs .tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        $$(".page").forEach(function (p) { p.classList.remove("active"); });
        $("#page-" + tab.dataset.page).classList.add("active");
        if (tab.dataset.page === "favorites") renderFavorites();
        if (tab.dataset.page === "history") { renderSearchHistory(); renderAnalysisHistory(); }
      });
    });

    $("#searchBtn").addEventListener("click", doSearch);
    $("#searchInput").addEventListener("keydown", function (e) { if (e.key === "Enter") doSearch(); });
    $("#hotSearch").addEventListener("click", function (e) {
      if (e.target.dataset.q) {
        $("#searchInput").value = e.target.dataset.q;
        doSearch();
      }
    });
    $("#filterLaw").addEventListener("change", doSearch);
    $("#filterPart").addEventListener("change", doSearch);
    $("#sortSel").addEventListener("change", doSearch);

    $("#sceneChips").addEventListener("click", function (e) {
      var i = e.target.dataset.scene;
      if (i != null) { $("#caseText").value = SCENES[i].text; }
    });
    $("#analyzeBtn").addEventListener("click", doAnalyze);
    $("#clearCaseBtn").addEventListener("click", function () {
      $("#caseText").value = ""; $("#analysisReport").innerHTML = "";
    });

    $("#modalClose").addEventListener("click", closeModal);
    $("#modal").addEventListener("click", function (e) { if (e.target === this) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

    $("#uploadInput").addEventListener("change", handleUpload);
    $("#exportBtn").addEventListener("click", exportCustom);
    $("#clearCustomBtn").addEventListener("click", function () {
      if (!confirm("确定删除全部自定义条文？该操作不可恢复。")) return;
      saveCustom([]); customData = []; rebuild(); renderCustomList();
      msg("已删除全部自定义条文。", "ok");
    });
    $("#customList").addEventListener("click", function (e) {
      var idx = e.target.dataset.del;
      if (idx != null) {
        customData.splice(parseInt(idx, 10), 1);
        saveCustom(customData); rebuild(); renderCustomList();
      }
    });

    $("#clearFavBtn").addEventListener("click", function () {
      if (!favorites.length) return;
      if (!confirm("确定清空全部 " + favorites.length + " 条收藏？该操作不可恢复。")) return;
      favorites = [];
      saveList(FAV_KEY, favorites);
      renderFavorites();
    });
    $("#clearSearchHistBtn").addEventListener("click", function () {
      if (!searchHist.length) return;
      if (!confirm("确定清空全部检索历史？")) return;
      searchHist = [];
      saveList(SEARCH_HIST_KEY, searchHist);
      renderSearchHistory();
    });
    $("#clearAnaHistBtn").addEventListener("click", function () {
      if (!anaHist.length) return;
      if (!confirm("确定清空全部分析历史？")) return;
      anaHist = [];
      saveList(ANA_HIST_KEY, anaHist);
      renderAnalysisHistory();
    });
  }

  /* ---------- 检索 ---------- */
  var lastResults = [];

  /* 提取查询词用于结果高亮（与引擎同样的切词规则） */
  function collectQueryTerms(q) {
    var runs = q.match(/[\u4e00-\u9fa5]{2,}/g) || [];
    var seen = {}, out = [];
    runs.forEach(function (r) {
      for (var i = 0; i < r.length - 1; i++) {
        var b = r.substr(i, 2);
        if (!seen[b]) { seen[b] = 1; out.push(b); }
      }
      if (r.length >= 3 && !seen[r]) { seen[r] = 1; out.push(r); }
    });
    return out.slice(0, 12);
  }

  function doSearch() {
    var q = $("#searchInput").value.trim();
    var opts = {
      law: $("#filterLaw").value,
      part: $("#filterPart").value,
      limit: 30
    };
    var results = q ? LawSearch.search(q, opts) : [];
    if (!q && (opts.law || opts.part)) {
      results = allProvisions.filter(function (p) {
        return (!opts.law || p.law === opts.law) && (!opts.part || p.part === opts.part);
      }).map(function (p) { return { prov: p, score: 0, matched: [] }; });
    }
    lastResults = results;
    if (q) pushSearchHist(q, results.length);

    var stats = $("#searchStats"), box = $("#searchResults"), empty = $("#searchEmpty");
    if (!results.length) {
      stats.textContent = ""; box.innerHTML = "";
      empty.style.display = q ? "block" : "block";
      empty.innerHTML = q ? "未找到相关条文，试试换一组关键词（如「借款」「违约」「抚养费」）。" :
        "输入关键词开始检索。<br><small>支持自然语言描述，如「装修师傅拖延工期可以要求赔偿吗」</small>";
      return;
    }
    empty.style.display = "none";
    stats.textContent = "找到 " + results.length + " 条相关条文（相关度从高到低）";

    if ($("#sortSel").value === "article") {
      results = results.slice().sort(function (a, b) {
        var na = parseInt((a.prov.id || "").replace(/\D/g, ""), 10) || 0;
        var nb = parseInt((b.prov.id || "").replace(/\D/g, ""), 10) || 0;
        return na - nb;
      });
    }

    var terms = q ? collectQueryTerms(q) : [];
    box.innerHTML = results.map(function (r, i) {
      var p = r.prov;
      var matchTerms = r.matched.map(function (m) { return m.term; });
      return '<div class="result-item" data-idx="' + i + '">' +
        '<span class="fav-star' + (isFav(p) ? " on" : "") + '" data-fav="' + i + '" title="收藏">' + (isFav(p) ? "★" : "☆") + "</span>" +
        '<div class="result-head">' +
        '<span class="result-id">' + escapeHtml(p.id) + "</span>" +
        '<span class="result-title">' + escapeHtml(p.title || "") + "</span>" +
        '<span class="pill part">' + escapeHtml(p.part || "") + "</span>" +
        (p.isCustom ? '<span class="pill custom">自定义</span>' : "") +
        (r.score ? '<span class="pill score">相关度 ' + r.score + "</span>" : "") +
        "</div>" +
        '<div class="result-content">' + highlight(p.content || "", matchTerms) + "</div>" +
        (r.matched.length ? '<div class="result-foot">命中：' + r.matched.map(function (m) {
          return '<span class="match-term">' + escapeHtml(m.term) + "（" + escapeHtml(m.field) + "×" + m.count + "）</span>";
        }).join("") + "</div>" : "") +
        "</div>";
    }).join("");

    box.onclick = function (e) {
      var star = e.target.closest(".fav-star");
      if (star) {
        e.stopPropagation();
        var p = lastResults[parseInt(star.dataset.fav, 10)].prov;
        var nowFav = toggleFav(p);
        star.classList.toggle("on", nowFav);
        star.textContent = nowFav ? "★" : "☆";
        return;
      }
      var item = e.target.closest(".result-item");
      if (item) openDetail(lastResults[parseInt(item.dataset.idx, 10)].prov, q);
    };
  }

  /* ---------- 条文详情 ---------- */
  function openDetail(p, query) {
    var rel = LawSearch.related(p, 5);
    var terms = [];
    if (query) {
      var r = LawSearch.search(query, { limit: 30 });
      r.forEach(function (x) { if (x.prov === p) terms = x.matched.map(function (m) { return m.term; }); });
    }
    var html =
      '<div class="modal-body-id">' + escapeHtml(p.id) + " · " + escapeHtml(p.title || "") + "</div>" +
      '<div class="modal-body-law">' + escapeHtml(p.law || "") + " ｜ " + escapeHtml(p.chapter || p.part || "") + "</div>" +
      '<div class="modal-body-content">' + highlight(p.content || "", terms) + "</div>" +
      (p.summary ? '<div class="modal-summary">💡 通俗解读：' + escapeHtml(p.summary) + "</div>" : "") +
      ((p.keywords || []).length ? '<div class="modal-kws">关键词：' + p.keywords.map(function (k) {
        return '<span class="match-term">' + escapeHtml(k) + "</span>";
      }).join("") + "</div>" : "");
    if (rel.length) {
      html += '<div class="related-h">🔗 相关条文</div>' + rel.map(function (rp) {
        return '<div class="report-law" data-open="' + escapeHtml(rp.id) + '">' +
          '<div class="rl-head"><span class="result-id">' + escapeHtml(rp.id) + "</span>" +
          '<span class="pill part">' + escapeHtml(rp.part || "") + "</span></div>" +
          '<div class="rl-content">' + escapeHtml(rp.title || rp.content) + "</div></div>";
      }).join("");
    }
    html += '<div style="margin-top:18px">' +
      '<button class="btn btn-ghost copy-btn" data-copy="1">📋 复制条文</button>' +
      '<button class="btn ' + (isFav(p) ? "btn-primary" : "btn-ghost") + ' modal-fav-btn" data-favbtn="1">' +
      (isFav(p) ? "★ 已收藏（点击取消）" : "☆ 收藏此条文") + "</button></div>";
    $("#modalBody").innerHTML = html;
    $("#modal").classList.remove("hidden");

    $("#modalBody").onclick = function (e) {
      var openId = e.target.closest("[data-open]") ? e.target.closest("[data-open]").dataset.open : null;
      if (openId) {
        var np = LawSearch.byId(openId);
        if (np) { openDetail(np, query); return; }
      }
      if (e.target.closest("[data-copy]")) {
        var text = (p.law || "") + " " + p.id + "\n" + (p.content || "");
        var cp = (window.ReaderCore && ReaderCore.copyText) ? ReaderCore.copyText(text)
          : (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject());
        cp.catch(function () { /* HTTP 环境兜底已内置于 ReaderCore.copyText */ });
        e.target.closest("[data-copy]").textContent = "✅ 已复制";
        return;
      }
      var favBtn = e.target.closest("[data-favbtn]");
      if (favBtn) {
        var nowFav = toggleFav(p);
        favBtn.className = "btn " + (nowFav ? "btn-primary" : "btn-ghost") + " modal-fav-btn";
        favBtn.textContent = nowFav ? "★ 已收藏（点击取消）" : "☆ 收藏此条文";
        return;
      }
    };
  }

  function closeModal() { $("#modal").classList.add("hidden"); }

  /* ---------- 智能分析 ---------- */
  function doAnalyze() {
    var text = $("#caseText").value.trim();
    var box = $("#analysisReport");
    if (!text) { box.innerHTML = '<div class="warn-box">请先描述你遇到的法律问题。</div>'; return; }

    var rep = LawAnalyzer.analyze(text);
    pushAnaHist(text, rep);
    renderReport(rep, text);
  }

  function renderReport(rep, text) {
    var box = $("#analysisReport");
    var h = '<div class="card report-card">';

    h += '<div class="report-h">一、纠纷类型识别</div><div>';
    rep.types.forEach(function (t) {
      h += '<span class="type-chip">' + escapeHtml(t.name) + "</span>";
    });
    h += "</div>";

    if (rep.money.length) {
      h += '<p class="muted" style="margin-top:6px">💰 涉及金额：' + rep.money.map(escapeHtml).join("；") + "</p>";
    }

    h += '<div class="report-h">二、最相关的法律条文（按匹配度排序）</div>';
    rep.provisions.forEach(function (item) {
      var p = item.prov;
      h += '<div class="report-law" data-open="' + escapeHtml(p.id) + '">' +
        '<div class="rl-head"><span class="result-id">' + escapeHtml(p.id) + "</span>" +
        '<span class="pill part">' + escapeHtml(p.part || "") + "</span>" +
        '<span class="pill score">匹配度 ' + item.score + "</span></div>" +
        '<div class="rl-content">' + escapeHtml(p.content || "") + "</div>" +
        (item.why.length ? '<div class="rl-why">📌 ' + item.why.map(escapeHtml).join("；") + "</div>" : "") +
        "</div>";
    });

    h += '<div class="report-h">三、分析要点</div><ul class="pts">';
    rep.focusPoints.slice(0, 9).forEach(function (f) { h += "<li>" + escapeHtml(f) + "</li>"; });
    h += "</ul>";

    if (rep.reminders.length || rep.timeRisks.length) {
      h += '<div class="report-h">四、风险提示</div><div class="warn-box">';
      rep.timeRisks.concat(rep.reminders).forEach(function (r) { h += "⚠️ " + escapeHtml(r) + "<br>"; });
      h += "</div>";
    }

    h += '<div class="report-h">五、建议行动步骤</div><ol class="advice-list">';
    rep.advice.forEach(function (a) { h += "<li>" + escapeHtml(a) + "</li>"; });
    h += "</ol>";

    h += '<div class="report-h">六、证据准备清单</div><ul class="pts">';
    rep.evidences.forEach(function (e2) { h += "<li>📎 " + escapeHtml(e2) + "</li>"; });
    h += "</ul>";

    h += '<div class="disclaimer-box">⚖️ 免责声明：以上内容由系统根据你输入的文字描述自动匹配生成，仅供参考，不构成法律意见。个案情况复杂，涉及诉讼或重大权益事项请咨询执业律师。</div>';
    h += "</div>";

    box.innerHTML = h;
    box.onclick = function (e) {
      var openEl = e.target.closest("[data-open]");
      if (openEl) {
        var p = LawSearch.byId(openEl.dataset.open);
        if (p) openDetail(p, text);
      }
    };
  }

  /* ---------- 我的收藏 ---------- */
  function renderFavorites() {
    $("#favCount").textContent = favorites.length;
    var box = $("#favoritesList");
    if (!favorites.length) {
      box.innerHTML = '<div class="empty-tip">还没有收藏任何条文。<br><small>在「条文检索」结果或条文详情弹窗中点击 ☆ 即可收藏</small></div>';
      return;
    }
    box.innerHTML = favorites.map(function (f, i) {
      var p = f.snapshot;
      return '<div class="fav-item" data-open="' + i + '">' +
        '<span class="fi-star">★</span>' +
        '<span class="fi-body">' +
        '<div class="fi-title">' + escapeHtml(p.id) + " " + escapeHtml(p.title || "") + "</div>" +
        '<div class="fi-sub">' + escapeHtml(p.law || "自定义") +
        (p.part ? " · " + escapeHtml(p.part) : "") + " · 收藏于 " + fmtTime(f.time) + "</div>" +
        "</span>" +
        '<span class="fi-del" data-del="' + i + '" title="取消收藏">✕ 取消收藏</span>' +
        "</div>";
    }).join("");

    box.onclick = function (e) {
      var del = e.target.closest(".fi-del");
      if (del) {
        e.stopPropagation();
        removeFav(favorites[parseInt(del.dataset.del, 10)].key);
        renderFavorites();
        return;
      }
      var item = e.target.closest(".fav-item");
      if (item) {
        var snap = favorites[parseInt(item.dataset.open, 10)].snapshot;
        openDetail(LawSearch.byId(snap.id) || snap, "");
      }
    };
  }

  /* ---------- 历史记录 ---------- */
  function renderSearchHistory() {
    var box = $("#searchHistoryList");
    if (!searchHist.length) {
      box.innerHTML = '<div class="empty-tip" style="padding:34px 20px">暂无检索历史。<br><small>每次检索会自动记录在这里，点击可一键重新检索</small></div>';
      return;
    }
    box.innerHTML = searchHist.map(function (h, i) {
      return '<div class="hist-item" data-go="' + i + '">' +
        '<span class="hi-ico">🔍</span>' +
        '<span class="hi-body">' +
        '<div class="hi-title">' + escapeHtml(h.q) + "</div>" +
        '<div class="hi-sub">' + fmtTime(h.time) + " · 命中 " + h.count + " 条</div>" +
        "</span>" +
        '<span class="hi-del" data-del="' + i + '" title="删除">✕</span>' +
        "</div>";
    }).join("");

    box.onclick = function (e) {
      var del = e.target.closest(".hi-del");
      if (del) {
        e.stopPropagation();
        searchHist.splice(parseInt(del.dataset.del, 10), 1);
        saveList(SEARCH_HIST_KEY, searchHist);
        renderSearchHistory();
        return;
      }
      var item = e.target.closest(".hist-item");
      if (item) {
        var h = searchHist[parseInt(item.dataset.go, 10)];
        switchTab("search");
        $("#searchInput").value = h.q;
        doSearch();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }

  function renderAnalysisHistory() {
    var box = $("#analysisHistoryList");
    if (!anaHist.length) {
      box.innerHTML = '<div class="empty-tip" style="padding:34px 20px">暂无分析历史。<br><small>在「智能分析」页生成报告后会自动保存，点击可重新查看</small></div>';
      return;
    }
    box.innerHTML = anaHist.map(function (h, i) {
      var types = (h.rep && h.rep.types ? h.rep.types : []).map(function (t) { return t.name; }).join(" / ");
      return '<div class="hist-item analysis" data-go="' + i + '">' +
        '<span class="hi-ico">📋</span>' +
        '<span class="hi-body">' +
        '<div class="hi-title">' + escapeHtml(h.text.slice(0, 60)) + (h.text.length > 60 ? "…" : "") + "</div>" +
        '<div class="hi-sub">' + fmtTime(h.time) + (types ? " · " + escapeHtml(types) : "") + "</div>" +
        "</span>" +
        '<span class="hi-del" data-del="' + i + '" title="删除">✕</span>' +
        "</div>";
    }).join("");

    box.onclick = function (e) {
      var del = e.target.closest(".hi-del");
      if (del) {
        e.stopPropagation();
        anaHist.splice(parseInt(del.dataset.del, 10), 1);
        saveList(ANA_HIST_KEY, anaHist);
        renderAnalysisHistory();
        return;
      }
      var item = e.target.closest(".hist-item");
      if (item) {
        var h = anaHist[parseInt(item.dataset.go, 10)];
        switchTab("analysis");
        $("#caseText").value = h.text;
        renderReport(h.rep, h.text);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
  }

  function switchTab(page) {
    $$("#tabs .tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.page === page);
    });
    $$(".page").forEach(function (p) { p.classList.remove("active"); });
    $("#page-" + page).classList.add("active");
  }

  /* ---------- 数据接入 ---------- */
  var FORMAT_SAMPLE = {
    provisions: [
      {
        id: "第X条",
        law: "中华人民共和国XX法",
        part: "XX编",
        chapter: "第X章 章名",
        title: "一句话概括条文主旨",
        content: "条文全文……",
        keywords: ["关键词1", "关键词2"],
        topics: ["主题"],
        summary: "通俗解读（可选）"
      }
    ]
  };

  function renderFormatDoc() {
    $("#formatDoc").textContent = JSON.stringify(FORMAT_SAMPLE, null, 2);
  }

  function msg(text, type) {
    var el = $("#uploadMsg");
    el.className = "upload-msg " + (type || "");
    el.textContent = text;
  }

  function handleUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var list = data.provisions || data.laws || (Array.isArray(data) ? data : null);
        if (!Array.isArray(list)) throw new Error("缺少 provisions 数组");
        var okItems = [], errs = 0;
        list.forEach(function (item) {
          if (item && item.id && item.content) {
            okItems.push({
              id: String(item.id), law: item.law || "自定义法规", part: item.part || "自定义",
              chapter: item.chapter || "", title: item.title || "",
              content: String(item.content), keywords: item.keywords || [],
              topics: item.topics || [], summary: item.summary || ""
            });
          } else { errs++; }
        });
        if (!okItems.length) throw new Error("没有可用条文（每条需包含 id 与 content）");
        var dup = 0;
        okItems.forEach(function (it) {
          var exists = customData.some(function (c) { return c.id === it.id && c.law === it.law; }) ||
            (window.LAW_PROVISIONS || []).some(function (c) { return c.id === it.id && c.law === it.law; });
          if (exists) dup++; else customData.push(it);
        });
        saveCustom(customData);
        rebuild(); renderCustomList();
        msg("✅ 导入成功：" + okItems.length + " 条（重复跳过 " + dup + " 条，格式错误 " + errs + " 条）。现在可到「条文检索」页查询。", "ok");
      } catch (err) {
        msg("❌ 导入失败：" + err.message + "。请对照上方 JSON 格式检查。", "err");
      }
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  function renderCustomList() {
    $("#customCount").textContent = customData.length;
    var box = $("#customList");
    if (!customData.length) {
      box.innerHTML = '<p class="muted">暂无自定义条文。上传 JSON 文件即可接入你自己的法规数据。</p>';
      return;
    }
    box.innerHTML = customData.map(function (p, i) {
      return '<div class="custom-item"><span><b>' + escapeHtml(p.id) + "</b>（" +
        escapeHtml(p.law || "自定义") + "）" + escapeHtml(p.title || "") + "</span>" +
        '<span class="del" data-del="' + i + '">删除</span></div>';
    }).join("");
  }

  function exportCustom() {
    if (!customData.length) { msg("暂无自定义数据可导出。", "err"); return; }
    var blob = new Blob([JSON.stringify({ provisions: customData }, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "custom-provisions.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function rebuild() {
    allProvisions = (window.LAW_PROVISIONS || []).concat(customData.map(function (p) { p.isCustom = true; return p; }));
    LawSearch.init(allProvisions);
    $("#statProvisions").textContent = "已收录 " + allProvisions.length + " 条常用条文";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
