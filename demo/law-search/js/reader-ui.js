/* ============================================================
 * ReaderUI —— 法律个人文献阅读界面层
 * 文献库（收件箱/主题/回收站/搜索） + 阅读工作台（目录/原文/笔记）
 * 交互：导入(拖放/粘贴/URL)、划选摘录、个人思考、高亮定位、
 *       主题管理、主题导出、备份恢复
 * 依赖：ReaderCore（js/reader-core.js）
 * ============================================================ */
var ReaderUI = (function () {
  "use strict";

  var RC = window.ReaderCore;
  var $ = function (s) { return document.querySelector(s); };
  var esc = RC.esc;

  /* ---------------- 状态 ---------------- */
  var S = {
    view: "inbox",            /* inbox | all | trash | topic:<id> */
    docs: [], topics: [], annos: [],
    q: "", fType: "", fStatus: "",
    cur: null, curAnnos: [],
    readMode: "text", pdfDoc: null, pdfPage: 1,
    fontSize: 16, pendingSel: null, scrollTimer: null
  };

  var FORMAT_LABEL = { pdf: "PDF", docx: "Word", txt: "文本", md: "MD", web: "网页" };
  var STATUS_LABEL = { inbox: "未读", reading: "阅读中", done: "已读" };

  function uid(p) { return RC.uid(p); }
  function nowISO() { return RC.nowISO(); }
  function fmtDT(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0") + " " +
      String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function toast(msg, ms) {
    var t = $("#readerToast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.add("hidden"); }, ms || 2600);
  }

  /* ================= 弹窗（阅读器专用） ================= */
  function rModal(bodyHTML) {
    $("#readerModalBody").innerHTML = bodyHTML;
    $("#readerModal").classList.remove("hidden");
  }
  function closeRModal() { $("#readerModal").classList.add("hidden"); }

  /* ================= 初始化 ================= */
  function init() {
    var dz = $("#dropzone");
    dz.addEventListener("click", function () { $("#docFileInput").click(); });
    dz.addEventListener("dragover", function (e) { e.preventDefault(); dz.classList.add("drag"); });
    dz.addEventListener("dragleave", function () { dz.classList.remove("drag"); });
    dz.addEventListener("drop", function (e) {
      e.preventDefault(); dz.classList.remove("drag");
      if (e.dataTransfer && e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
    });
    $("#docFileInput").addEventListener("change", function (e) {
      if (e.target.files.length) importFiles(e.target.files);
      e.target.value = "";
    });
    $("#pasteImportBtn").addEventListener("click", openPasteModal);
    $("#urlImportBtn").addEventListener("click", openUrlModal);
    $("#backupBtn").addEventListener("click", doBackup);
    $("#restoreBtn").addEventListener("click", function () { $("#restoreInput").click(); });
    $("#restoreInput").addEventListener("change", function (e) {
      var f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      f.text().then(function (txt) {
        try { previewRestore(JSON.parse(txt)); }
        catch (err) { toast("❌ 文件解析失败：" + err.message); }
      });
    });

    $("#libSearch").addEventListener("input", function (e) { S.q = e.target.value.trim(); renderList(); });
    $("#libFilterType").addEventListener("change", function (e) { S.fType = e.target.value; renderList(); });
    $("#libFilterStatus").addEventListener("change", function (e) { S.fStatus = e.target.value; renderList(); });
    $("#libNav").addEventListener("click", function (e) {
      var item = e.target.closest(".lib-nav-item");
      if (!item) return;
      S.view = item.dataset.view;
      renderSidebar(); renderList();
    });
    $("#manageTopicsBtn").addEventListener("click", openTopicManage);
    $("#libList").addEventListener("click", onLibListClick);

    /* 阅读器 */
    $("#readerBack").addEventListener("click", closeReader);
    $("#readerStatusSel").addEventListener("change", function (e) {
      if (!S.cur) return;
      S.cur.status = e.target.value;
      RC.putDoc(S.cur);
    });
    $("#readerModeBtn").addEventListener("click", toggleReadMode);
    $("#fontMinus").addEventListener("click", function () { setFont(S.fontSize - 1); });
    $("#fontPlus").addEventListener("click", function () { setFont(S.fontSize + 1); });
    $("#readerModalClose").addEventListener("click", closeRModal);
    $("#readerModal").addEventListener("click", function (e) {
      if (e.target === $("#readerModal")) closeRModal();
    });
    bindSelection();
    bindNotesPanel();
    bindInfoForm();
    bindCanvasNav();
    $("#readerContent").addEventListener("scroll", saveReadingDebounced);
    window.addEventListener("resize", function () { $("#selPop").classList.add("hidden"); });

    refresh();
  }

  /* ================= 数据刷新与侧栏 ================= */
  function refresh() {
    Promise.all([RC.listDocs(), RC.listAnnotations(), RC.listTopics()]).then(function (r) {
      S.docs = r[0]; S.annos = r[1]; S.topics = r[2];
      renderSidebar(); renderStats(); renderList();
    }).catch(function (e) { console.warn("[reader]", e); });
  }

  function annoStats() {
    var m = {};
    S.annos.forEach(function (a) {
      if (!m[a.docId]) m[a.docId] = { ex: 0, th: 0 };
      if (a.kind === "excerpt") m[a.docId].ex++;
      else m[a.docId].th++;
    });
    return m;
  }

  function renderStats() {
    var live = S.docs.filter(function (d) { return !d.deleted; });
    var ex = 0, th = 0;
    S.annos.forEach(function (a) { if (a.kind === "excerpt") ex++; else th++; });
    $("#libStats").innerHTML =
      "📚 <b>" + live.length + "</b> 篇文献 · 📌 <b>" + ex + "</b> 条摘录 · ✏️ <b>" + th +
      "</b> 条思考 · 🗂 <b>" + S.topics.length + "</b> 个主题" +
      '<span class="lib-stats-sub">资料仅保存在本机浏览器（IndexedDB），不上传任何服务器</span>';
  }

  function renderSidebar() {
    var live = S.docs.filter(function (d) { return !d.deleted; });
    $("#cntInbox").textContent = live.filter(function (d) { return d.status === "inbox"; }).length;
    $("#cntAll").textContent = live.length;
    $("#cntTrash").textContent = S.docs.length - live.length;

    var topicHtml = S.topics.map(function (t) {
      var n = live.filter(function (d) { return d.topics.indexOf(t.id) >= 0; }).length +
        S.annos.filter(function (a) { return a.topics.indexOf(t.id) >= 0; }).length;
      return '<button class="lib-nav-item topic-item' + (t.archived ? " archived" : "") +
        (S.view === "topic:" + t.id ? " active" : "") + '" data-view="topic:' + t.id + '">' +
        (t.archived ? "📦" : "🗂") + " " + esc(t.name) +
        (n ? ' <span class="cnt">' + n + "</span>" : "") + "</button>";
    }).join("");
    $("#libTopics").innerHTML = topicHtml ||
      '<div class="lib-topic-empty">还没有主题<br><small>点下方「管理主题」创建</small></div>';

    $$("#libNav .lib-nav-item").forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === S.view);
    });
  }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  /* ================= 文献列表 ================= */
  function currentDocs() {
    var list;
    if (S.view === "trash") list = S.docs.filter(function (d) { return d.deleted; });
    else if (S.view.indexOf("topic:") === 0) {
      var tid = S.view.slice(6);
      list = S.docs.filter(function (d) { return !d.deleted && d.topics.indexOf(tid) >= 0; });
    } else if (S.view === "inbox") {
      list = S.docs.filter(function (d) { return !d.deleted && d.status === "inbox"; });
    } else {
      list = S.docs.filter(function (d) { return !d.deleted; });
    }
    if (S.fType) list = list.filter(function (d) { return d.format === S.fType; });
    if (S.fStatus && S.view !== "trash") list = list.filter(function (d) { return d.status === S.fStatus; });
    if (S.q) {
      var q = S.q.toLowerCase();
      list = list.filter(function (d) {
        return (d.title + " " + (d.authors || "") + " " + RC.docPlainText(d)).toLowerCase().indexOf(q) >= 0;
      });
    }
    list.sort(function (a, b) { return b.importedAt.localeCompare(a.importedAt); });
    return list;
  }

  function renderList() {
    var box = $("#libList");
    var st = annoStats();
    var docs = currentDocs();

    /* 主题视图：显示主题内笔记 + 导出入口 */
    var topicSection = "";
    if (S.view.indexOf("topic:") === 0) {
      var tid = S.view.slice(6);
      var topic = S.topics.filter(function (t) { return t.id === tid; })[0];
      if (topic) {
        var tAnnos = S.annos.filter(function (a) {
          return a.topics.indexOf(tid) >= 0 &&
            (S.q ? a.text.toLowerCase().indexOf(S.q.toLowerCase()) >= 0 : true);
        }).sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
        topicSection =
          '<div class="card topic-workbench">' +
          '<div class="page-head"><h2 class="card-title">🗂 主题：' + esc(topic.name) + "</h2>" +
          '<button class="btn btn-primary btn-sm" id="exportTopicBtn">⬇️ 导出主题 JSON</button></div>' +
          (topic.archived ? '<span class="pill">已归档</span>' : "") +
          "<p class=\"muted\">" + (topic.description ? esc(topic.description) : "汇集该主题下的文献、原文摘录与个人思考，可一键导出为结构化数据。") + "</p>" +
          '<div class="topic-note-list">' +
          (tAnnos.length ? tAnnos.map(function (a) { return annoCard(a, { showDoc: true }); }).join("") :
            '<p class="muted">该主题下暂无笔记（在阅读器中对摘录或思考「加入主题」即可归入）。</p>') +
          "</div></div>";
      }
    }

    /* 搜索时的笔记命中 */
    var annoHits = "";
    if (S.q && S.view !== "trash") {
      var hits = S.annos.filter(function (a) {
        var d = S.docs.filter(function (x) { return x.id === a.docId; })[0];
        return d && !d.deleted && a.text.toLowerCase().indexOf(S.q.toLowerCase()) >= 0;
      }).slice(0, 20);
      if (hits.length) {
        annoHits = '<div class="card anno-hit-card"><h3 class="sub-title">✍️ 笔记命中（' + hits.length + "）</h3>" +
          hits.map(function (a) { return annoCard(a, { showDoc: true, jump: true }); }).join("") + "</div>";
      }
    }

    var docSection = "";
    if (S.view === "trash") {
      docSection = docs.length
        ? '<h3 class="sub-title">🗑️ 回收站（' + docs.length + "）· 删除 30 天内可恢复</h3>" + docs.map(docCard).join("")
        : '<div class="empty-tip">回收站是空的。</div>';
    } else {
      docSection = docs.length
        ? '<h3 class="sub-title">' + viewTitle() + "（" + docs.length + "）</h3>" + docs.map(docCard).join("")
        : '<div class="empty-tip">这里还没有文献。<br><small>拖入 PDF / DOCX / TXT，或用上方按钮导入</small></div>';
    }

    box.innerHTML = topicSection + annoHits + docSection;

    var expBtn = $("#exportTopicBtn");
    if (expBtn) expBtn.addEventListener("click", openExportModal);
  }

  function viewTitle() {
    if (S.view === "inbox") return "📥 收件箱";
    if (S.view === "all") return "📄 全部文献";
    return "📄 文献";
  }

  function docCard(d) {
    var st = annoStats()[d.id] || { ex: 0, th: 0 };
    var topicNames = (d.topics || []).map(function (tid) {
      var t = S.topics.filter(function (x) { return x.id === tid; })[0];
      return t ? t.name : "";
    }).filter(Boolean);
    if (S.view === "trash") {
      return '<div class="doc-card">' +
        '<div class="doc-head"><b>' + esc(d.title) + "</b>" +
        '<span class="pill fmt">' + (FORMAT_LABEL[d.format] || d.format) + "</span></div>" +
        '<div class="doc-meta">删除于 ' + fmtDT(d.deletedAt) + "</div>" +
        '<div class="doc-actions">' +
        '<button class="btn btn-ghost btn-sm" data-act="restore-doc" data-id="' + d.id + '">♻️ 恢复</button>' +
        '<button class="btn btn-danger-ghost btn-sm" data-act="purge-doc" data-id="' + d.id + '">❌ 彻底删除</button>' +
        "</div></div>";
    }
    return '<div class="doc-card" data-id="' + d.id + '">' +
      '<div class="doc-head"><b class="doc-title" data-act="open-doc" data-id="' + d.id + '">' + esc(d.title) + "</b>" +
      '<span class="pill fmt">' + (FORMAT_LABEL[d.format] || d.format) + "</span>" +
      '<span class="pill st-' + d.status + '">' + (STATUS_LABEL[d.status] || d.status) + "</span></div>" +
      '<div class="doc-meta">' +
      (d.authors ? esc(d.authors) + " · " : "") +
      (d.publishedDate ? String(d.publishedDate).slice(0, 10) + " · " : "") +
      "导入于 " + fmtDT(d.importedAt) +
      (d.sourceUrl ? ' · <a href="' + esc(d.sourceUrl) + '" target="_blank" rel="noopener" class="doc-link">来源链接</a>' : "") +
      "</div>" +
      (topicNames.length ? '<div class="doc-topics">' + topicNames.map(function (n) {
        return '<span class="pill topic">🗂 ' + esc(n) + "</span>";
      }).join("") + "</div>" : "") +
      '<div class="doc-foot"><span class="doc-stats">' +
      (d.format === "pdf" ? d.pageCount + " 页 · " : "") + (d.charCount || 0) + " 字" +
      " · 📌 " + st.ex + " · ✏️ " + st.th +
      (d.textExtracted === false ? ' · <span class="warn-text">疑似扫描件</span>' : "") +
      "</span>" +
      '<span class="doc-actions">' +
      '<button class="btn btn-primary btn-sm" data-act="open-doc" data-id="' + d.id + '">📖 阅读</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="edit-info" data-id="' + d.id + '">✏️ 来源信息</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="assign-topics-doc" data-id="' + d.id + '">🗂 主题</button>' +
      '<button class="btn btn-danger-ghost btn-sm" data-act="del-doc" data-id="' + d.id + '">🗑️ 删除</button>' +
      "</span></div></div>";
  }

  function annoCard(a, opt) {
    opt = opt || {};
    var d = S.docs.filter(function (x) { return x.id === a.docId; })[0];
    var topicChips = (a.topics || []).map(function (tid) {
      var t = S.topics.filter(function (x) { return x.id === tid; })[0];
      return t ? '<span class="pill topic">🗂 ' + esc(t.name) + "</span>" : "";
    }).join("");
    if (a.kind === "excerpt") {
      return '<div class="note-card nc-excerpt">' +
        '<div class="nc-head"><span class="nc-kind">📌 原文摘录</span>' +
        (a.locator ? '<span class="pill loc">' + esc(RC.locatorSummary(a.locator)) + "</span>" : "") +
        '<span class="nc-time">' + fmtDT(a.updatedAt) + "</span></div>" +
        (opt.showDoc && d ? '<div class="nc-doc">📄 ' + esc(d.title) + "</div>" : "") +
        '<div class="nc-text">' + esc(a.text) + "</div>" +
        (topicChips ? '<div class="nc-topics">' + topicChips + "</div>" : "") +
        '<div class="nc-actions">' +
        '<button class="btn btn-ghost btn-sm" data-act="locate-anno" data-id="' + a.id + '">🧭 定位</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="add-thought" data-id="' + a.id + '">✏️ 添加思考</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="assign-anno" data-id="' + a.id + '">🗂 主题</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="cite-anno" data-id="' + a.id + '">📋 引文</button>' +
        '<button class="btn btn-danger-ghost btn-sm" data-act="del-anno" data-id="' + a.id + '">🗑️</button>' +
        "</div></div>";
    }
    /* thought */
    var rel = (a.relatedIds || []).map(function (rid) {
      var r = S.annos.filter(function (x) { return x.id === rid; })[0];
      if (!r) return "";
      return '<span class="rel-chip" data-act="locate-anno" data-id="' + r.id + '">📌 ' +
        esc(r.text.slice(0, 24)) + (r.text.length > 24 ? "…" : "") + "</span>";
    }).join("");
    return '<div class="note-card nc-thought">' +
      '<div class="nc-head"><span class="nc-kind kind-thought">💭 个人思考</span>' +
      '<span class="nc-time">' + fmtDT(a.updatedAt) + "</span></div>" +
      (opt.showDoc && d ? '<div class="nc-doc">📄 ' + esc(d.title) + "</div>" : "") +
      '<div class="nc-text">' + esc(a.text) + "</div>" +
      (rel ? '<div class="nc-rel">关联：' + rel + "</div>" : "") +
      (topicChips ? '<div class="nc-topics">' + topicChips + "</div>" : "") +
      '<div class="nc-actions">' +
      '<button class="btn btn-ghost btn-sm" data-act="edit-thought" data-id="' + a.id + '">✏️ 编辑</button>' +
      '<button class="btn btn-ghost btn-sm" data-act="assign-anno" data-id="' + a.id + '">🗂 主题</button>' +
      '<button class="btn btn-danger-ghost btn-sm" data-act="del-anno" data-id="' + a.id + '">🗑️</button>' +
      "</div></div>";
  }

  function onLibListClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.dataset.act, id = btn.dataset.id;
    if (act === "open-doc") openDoc(id);
    else if (act === "del-doc") {
      if (confirm("移入回收站？关联的摘录与思考会保留，可随时恢复。")) {
        RC.softDeleteDoc(id).then(refresh);
      }
    } else if (act === "restore-doc") RC.restoreDoc(id).then(refresh);
    else if (act === "purge-doc") {
      var n = S.annos.filter(function (a) { return a.docId === id; }).length;
      if (confirm("彻底删除将连同 " + n + " 条关联笔记一并移除，且不可恢复。确定？")) {
        RC.purgeDoc(id).then(refresh);
      }
    } else if (act === "edit-info") editInfoModal(id);
    else if (act === "assign-topics-doc") openAssignTopics({ type: "doc", id: id });
    else if (act === "locate-anno") jumpToAnno(id);
    else if (act === "add-thought") openThoughtModal(null, [id]);
    else if (act === "cite-anno") citeAnno(id);
    else if (act === "edit-thought") openThoughtModal(id, null);
    else if (act === "assign-anno") {
      var ta = S.annos.filter(function (x) { return x.id === id; })[0];
      if (ta) openAssignTargets(ta, (ta.kind === "excerpt" ? "摘录" : "思考") + "：" + ta.text.slice(0, 14) + "…", ta.topics || [], RC.putAnnotation);
    }
    else if (act === "del-anno") {
      if (confirm("删除这条笔记？")) RC.deleteAnnotation(id).then(refresh);
    }
    e.stopPropagation();
  }

  function citeAnno(id) {
    var a = S.annos.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    var d = S.docs.filter(function (x) { return x.id === a.docId; })[0] || S.cur;
    RC.copyText(RC.buildCitation(d, a)).then(function () {
      toast("✅ 引文已复制（含出处信息）");
    }, function () { toast("❌ 复制失败，请手动选择文本复制"); });
  }

  function jumpToAnno(annoId) {
    var a = S.annos.filter(function (x) { return x.id === annoId; })[0];
    if (!a) return;
    openDoc(a.docId, function () { locateAnno(annoId); });
  }

  /* ================= 导入 ================= */
  function importMsg(html) { $("#importMsg").innerHTML = html; }

  function importFiles(files) {
    var arr = Array.prototype.slice.call(files);
    importMsg('<span class="ok">排队中：' + arr.length + " 个文件…</span>");
    var ok = 0, fails = [];
    function next(i) {
      if (i >= arr.length) {
        importMsg((ok ? '<span class="ok">✅ 成功导入 ' + ok + " 篇</span>" : "") +
          (fails.length ? ' <span class="err">❌ ' + fails.length + " 个失败：" + fails.map(esc).join("；") + "</span>" : ""));
        refresh();
        return;
      }
      var f = arr[i];
      importMsg("处理中（" + (i + 1) + "/" + arr.length + "）：" + esc(f.name));
      RC.parseFile(f).then(function (fields) {
        fields.title = f.name.replace(/\.[^.]+$/, "");
        var doc = RC.normalizeDoc(fields);
        return RC.putDoc(doc).then(function () {
          if (fields.fileData) return RC.putBlob(doc.id, fields.fileData);
        });
      }).then(function () {
        ok++; next(i + 1);
      }).catch(function (err) {
        fails.push(f.name + "：" + err.message);
        next(i + 1);
      });
    }
    next(0);
  }

  function openPasteModal() {
    rModal(
      '<h3 class="rm-title">📝 粘贴文本导入</h3>' +
      '<p class="muted">适合快速保存网页正文、聊天记录、法条文本等。来源链接可选填，会保留在文献信息中。</p>' +
      '<div class="form-row"><label>标题</label><input id="pmTitle" placeholder="例如：网购纠纷案例评析"></div>' +
      '<div class="form-row"><label>作者</label><input id="pmAuthors" placeholder="可选"></div>' +
      '<div class="form-row"><label>来源链接</label><input id="pmUrl" placeholder="https://… 可选"></div>' +
      '<div class="form-row"><label>正文</label><textarea id="pmText" rows="9" placeholder="粘贴正文内容，空行分段…"></textarea></div>' +
      '<div class="rm-actions"><button class="btn btn-primary" id="pmSave">保存到文献库</button></div>'
    );
    $("#pmSave").onclick = function () {
      var text = $("#pmText").value.trim();
      if (!text) { toast("请粘贴正文内容"); return; }
      var doc = RC.normalizeDoc({
        title: $("#pmTitle").value.trim() || text.slice(0, 20),
        authors: $("#pmAuthors").value.trim() || null,
        sourceUrl: $("#pmUrl").value.trim() || null,
        sourceType: "web",
        captureMethod: "manual_paste",
        content: { paragraphs: RC.splitParagraphs(text) },
        charCount: text.length
      });
      RC.putDoc(doc).then(function () { closeRModal(); refresh(); toast("✅ 已保存"); });
    };
  }

  function openUrlModal() {
    rModal(
      '<h3 class="rm-title">🌐 导入网页 URL</h3>' +
      '<p class="muted">输入网址，系统尝试自动抓取标题与正文。若当前部署不支持抓取（纯静态托管），会切换为手动粘贴模式。</p>' +
      '<div class="form-row"><label>网址</label><input id="umUrl" placeholder="https://…"></div>' +
      '<div class="rm-actions"><button class="btn btn-primary" id="umFetch">⚡ 尝试抓取</button></div>' +
      '<div id="umStatus" class="upload-msg"></div>' +
      '<div id="umPasteArea" class="hidden">' +
      '<div class="form-row"><label>标题</label><input id="umTitle"></div>' +
      '<div class="form-row"><label>正文</label><textarea id="umText" rows="9" placeholder="可编辑抓取到的正文，或手动粘贴网页内容…"></textarea></div>' +
      '<div class="rm-actions"><button class="btn btn-primary" id="umSave">保存到文献库</button></div>' +
      "</div>"
    );
    $("#umFetch").onclick = function () {
      var url = $("#umUrl").value.trim();
      if (!/^https?:\/\//i.test(url)) { toast("请输入 http/https 网址"); return; }
      $("#umStatus").innerHTML = "抓取中…";
      RC.fetchViaServer(url).then(function (j) {
        $("#umStatus").innerHTML = '<span class="ok">✅ 抓取成功' + (j.finalUrl && j.finalUrl !== url ? "（已跟随跳转）" : "") + "</span>";
        $("#umPasteArea").classList.remove("hidden");
        $("#umTitle").value = j.title || url;
        $("#umText").value = j.text || "";
        $("#umSave").dataset.capture = "server_fetch";
      }).catch(function (err) {
        $("#umStatus").innerHTML = '<span class="err">⚠️ 自动抓取不可用（' + esc(err.message) +
          "）。当前为静态部署，请手动打开网页复制正文粘贴到下方。</span>";
        $("#umPasteArea").classList.remove("hidden");
        $("#umTitle").value = "";
        $("#umSave").dataset.capture = "manual_paste";
      });
    };
    $("#umSave").onclick = function () {
      var text = $("#umText").value.trim();
      if (!text) { toast("请粘贴正文内容"); return; }
      var doc = RC.normalizeDoc({
        title: $("#umTitle").value.trim() || $("#umUrl").value.trim().slice(0, 30),
        sourceUrl: $("#umUrl").value.trim() || null,
        sourceType: "web",
        captureMethod: this.dataset.capture || "manual_paste",
        content: { paragraphs: RC.splitParagraphs(text) },
        charCount: text.length
      });
      RC.putDoc(doc).then(function () { closeRModal(); refresh(); toast("✅ 已保存"); });
    };
  }

  /* ================= 主题管理 ================= */
  function openTopicManage() {
    rModal(
      '<h3 class="rm-title">🗂 主题管理</h3>' +
      '<div id="tmList">' + S.topics.map(function (t) {
        return '<div class="tm-row" data-id="' + t.id + '">' +
          '<span>' + (t.archived ? "📦" : "🗂") + " " + esc(t.name) + (t.archived ? "（已归档）" : "") + "</span>" +
          '<span class="tm-ops">' +
          '<button class="btn btn-ghost btn-sm" data-tmact="rename" data-id="' + t.id + '">✏️ 重命名</button>' +
          '<button class="btn btn-ghost btn-sm" data-tmact="archive" data-id="' + t.id + '">' + (t.archived ? "📤 取消归档" : "📦 归档") + "</button>" +
          '<button class="btn btn-danger-ghost btn-sm" data-tmact="del" data-id="' + t.id + '">🗑️</button>' +
          "</span></div>";
      }).join("") + '<p class="muted" id="tmEmpty">暂无主题</p></div>' +
      '<div class="form-row"><label>新建主题</label><input id="tmNew" placeholder="例如：平台责任"></div>' +
      '<div class="rm-actions"><button class="btn btn-primary" id="tmAdd">➕ 创建</button></div>'
    );
    $("#tmEmpty") && (S.topics.length ? $("#tmEmpty").remove() : 0);
    $("#tmAdd").onclick = function () {
      var name = $("#tmNew").value.trim();
      if (!name) return;
      RC.putTopic({ id: uid("topic"), name: name, description: "", archived: false, createdAt: nowISO() })
        .then(function () { refresh(); openTopicManage(); });
    };
    $("#tmList").onclick = function (e) {
      var b = e.target.closest("[data-tmact]");
      if (!b) return;
      var id = b.dataset.id, t = S.topics.filter(function (x) { return x.id === id; })[0];
      if (b.dataset.tmact === "rename") {
        var name = prompt("新名称：", t.name);
        if (name && name.trim()) { t.name = name.trim(); RC.putTopic(t).then(function () { refresh(); openTopicManage(); }); }
      } else if (b.dataset.tmact === "archive") {
        t.archived = !t.archived;
        RC.putTopic(t).then(function () { refresh(); openTopicManage(); });
      } else if (b.dataset.tmact === "del") {
        if (confirm("删除主题「" + t.name + "」？文献与笔记本身不会被删除，仅解除归属。")) {
          RC.deleteTopic(id).then(function () { if (S.view === "topic:" + id) S.view = "all"; refresh(); openTopicManage(); });
        }
      }
    };
  }

  function openAssignTargets(entity, title, selected, saveFn) {
    var rows = S.topics.map(function (t) {
      return '<label class="assign-row"><input type="checkbox" value="' + t.id + '"' +
        (selected.indexOf(t.id) >= 0 ? " checked" : "") + (t.archived ? " disabled" : "") + "> " +
        esc(t.name) + (t.archived ? "（已归档）" : "") + "</label>";
    }).join("") || '<p class="muted">还没有主题，先在下方创建一个。</p>';
    rModal(
      '<h3 class="rm-title">🗂 加入主题 — ' + esc(title) + "</h3>" +
      '<div class="assign-list">' + rows + "</div>" +
      '<div class="form-row"><label>新建并加入</label><input id="asNew" placeholder="新主题名称，可留空"></div>' +
      '<div class="rm-actions"><button class="btn btn-primary" id="asSave">保存</button></div>'
    );
    $("#asSave").onclick = function () {
      var ids = $$("#readerModalBody .assign-list input:checked").map(function (c) { return c.value; });
      var newName = $("#asNew").value.trim();
      var p = newName
        ? RC.putTopic({ id: uid("topic"), name: newName, description: "", archived: false, createdAt: nowISO() })
            .then(function (t) { ids.push(t.id); })
        : Promise.resolve();
      p.then(function () {
        entity.topics = ids;
        return (saveFn || RC.putDoc)(entity);
      }).then(function () {
        closeRModal(); refresh();
        if (S.cur && S.curAnnos.indexOf(entity) >= 0) renderNotes();
        toast("✅ 主题归属已更新");
      });
    };
  }

  function openAssignTopics(what) { /* what = {type, id} */
    if (what.type === "doc") {
      var d = S.docs.filter(function (x) { return x.id === what.id; })[0];
      if (d) openAssignTargets(d, d.title, d.topics || [], RC.putDoc);
    } else {
      var a = S.annos.filter(function (x) { return x.id === what.id; })[0];
      if (a) openAssignTargets(a, (a.kind === "excerpt" ? "摘录" : "思考") + "：" + a.text.slice(0, 16) + "…", a.topics || [], RC.putAnnotation);
    }
  }

  /* ================= 阅读器 ================= */
  function openDoc(id, cb) {
    RC.getDoc(id).then(function (d) {
      if (!d) return;
      S.cur = d; S.readMode = "text"; S.pdfDoc = null; S.pdfPage = 1; S.fontSize = 16;
      return RC.listAnnotations(id).then(function (annos) {
        S.curAnnos = annos;
        $("#readerView").classList.remove("hidden");
        document.body.classList.add("reader-open");
        $("#readerTitle").textContent = d.title;
        $("#readerMeta").textContent = (FORMAT_LABEL[d.format] || d.format) +
          (d.pageCount ? " · " + d.pageCount + " 页" : "") + " · " + (d.charCount || 0) + " 字" +
          " · 导入于 " + fmtDT(d.importedAt);
        $("#readerStatusSel").value = d.status;
        var modeBtn = $("#readerModeBtn");
        modeBtn.classList.toggle("hidden", d.format !== "pdf");
        if (d.format === "pdf" && d.textExtracted === false) {
          S.readMode = "canvas";
          toast("该 PDF 未提取到文本（疑似扫描件），已切换为原版模式");
        }
        renderContent(); renderToc(); renderNotes(); fillInfoForm();
        if (d.status === "inbox") { d.status = "reading"; $("#readerStatusSel").value = "reading"; RC.putDoc(d); }
        /* 恢复阅读位置 */
        requestAnimationFrame(function () {
          var el = $("#readerContent");
          if (d.reading && d.reading.ratio > 0.02) {
            el.scrollTop = d.reading.ratio * Math.max(1, el.scrollHeight - el.clientHeight);
          } else el.scrollTop = 0;
        });
        if (cb) cb();
      });
    });
  }

  function closeReader() {
    $("#readerView").classList.add("hidden");
    document.body.classList.remove("reader-open");
    if (S.scrollTimer) { clearTimeout(S.scrollTimer); S.scrollTimer = null; }
    S.cur = null;
    refresh();
  }

  function saveReadingDebounced() {
    if (!S.cur) return;
    if (S.scrollTimer) clearTimeout(S.scrollTimer);
    S.scrollTimer = setTimeout(function () {
      var el = $("#readerContent");
      if (!el || !S.cur) return;
      var total = el.scrollHeight - el.clientHeight;
      var ratio = total > 0 ? Math.min(1, el.scrollTop / total) : 0;
      S.cur.reading = { ratio: ratio, lastReadAt: nowISO() };
      RC.updateReading(S.cur.id, S.cur.reading);
    }, 600);
  }

  /* ---------- 内容渲染 ---------- */
  function renderContent() {
    var d = S.cur, el = $("#readerContent");
    el.style.fontSize = S.fontSize + "px";
    el.scrollTop = 0;
    $("#pdfModeTip").classList.toggle("hidden", S.readMode !== "canvas");
    $("#readerCanvasWrap").classList.toggle("hidden", S.readMode !== "canvas");
    el.classList.toggle("hidden", S.readMode === "canvas");

    if (S.readMode === "canvas") { renderCanvas(); return; }

    var html = "";
    if (d.format === "pdf") {
      var g = 0;
      html = d.content.pages.map(function (p) {
        var paras = RC.splitParagraphs(p.text.replace(/\n/g, "\n\n"));
        var inner = paras.length ? paras.map(function (t) {
          return '<p data-para="' + (g++) + '">' + esc(t) + "</p>";
        }).join("") : '<p class="muted">（本页无可提取文本）</p>';
        return '<div class="pg" data-page="' + p.no + '">' +
          '<div class="pg-no">— 第 ' + p.no + " / " + d.pageCount + " 页 —</div>" + inner + "</div>";
      }).join("");
      if (!d.textExtracted) html = '<div class="warn-box">该 PDF 疑似扫描件，未提取到文本。可点右上「原版模式」查看原貌（扫描件暂不支持摘录，OCR 属于后续版本）。</div>';
    } else if (d.format === "docx") {
      html = d.content.html || "";
    } else {
      html = (d.content.paragraphs || []).map(function (t, i) {
        return '<p data-para="' + i + '">' + esc(t) + "</p>";
      }).join("");
    }
    el.innerHTML = html;

    if (d.format === "docx") {
      var blocks = el.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr");
      Array.prototype.forEach.call(blocks, function (b, i) { b.dataset.para = i; });
    }
    applyHighlights();
  }

  function toggleReadMode() {
    if (!S.cur || S.cur.format !== "pdf") return;
    S.readMode = S.readMode === "text" ? "canvas" : "text";
    if (S.readMode === "text" && !S.cur.textExtracted) { S.readMode = "canvas"; return; }
    renderContent();
  }

  /* ---------- 原版模式（canvas 渲染 PDF） ---------- */
  function renderCanvas() {
    var d = S.cur;
    if (!S.pdfDoc) {
      if (typeof pdfjsLib === "undefined") { toast("PDF 组件未加载"); return; }
      RC.getBlob(d.id).then(function (buf) {
        if (!buf) {
          $("#pdfModeTip").innerHTML = "⚠️ 原始 PDF 二进制未保留（备份恢复后的文献），仅可用文本模式。";
          return;
        }
        pdfjsLib.GlobalWorkerOptions.workerSrc = "js/libs/pdf.worker.min.js";
        pdfjsLib.getDocument({ data: buf }).promise.then(function (pdf) {
          S.pdfDoc = pdf;
          drawPage();
        });
      });
    } else drawPage();
  }
  function drawPage() {
    var pdf = S.pdfDoc;
    if (!pdf) return;
    if (S.pdfPage < 1) S.pdfPage = 1;
    if (S.pdfPage > pdf.numPages) S.pdfPage = pdf.numPages;
    pdf.getPage(S.pdfPage).then(function (page) {
      var canvas = $("#readerCanvas");
      var wrapW = $("#readerCanvasWrap").clientWidth - 32;
      var base = page.getViewport({ scale: 1 });
      var scale = Math.max(0.6, Math.min(2, (wrapW || 700) / base.width));
      var vp = page.getViewport({ scale: scale });
      canvas.width = vp.width; canvas.height = vp.height;
      page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
      $("#pdfPageNo").textContent = S.pdfPage + " / " + pdf.numPages;
    });
  }
  function bindCanvasNav() {
    $("#pdfPrev").addEventListener("click", function () { S.pdfPage--; drawPage(); });
    $("#pdfNext").addEventListener("click", function () { S.pdfPage++; drawPage(); });
  }

  /* ---------- 目录 ---------- */
  function renderToc() {
    var d = S.cur, box = $("#readerToc"), html = "";
    if (S.readMode === "canvas" || d.format === "pdf") {
      if (d.format === "pdf") {
        html = '<div class="toc-h">📑 页面</div>';
        for (var i = 1; i <= d.pageCount; i++) {
          html += '<button class="toc-item" data-page="' + i + '">第 ' + i + " 页</button>";
        }
      }
    } else if (d.format === "docx") {
      var hs = $("#readerContent").querySelectorAll("h1,h2,h3");
      html = '<div class="toc-h">📑 目录</div>';
      if (hs.length) {
        Array.prototype.forEach.call(hs, function (h) {
          html += '<button class="toc-item lv' + h.tagName[1] + '" data-para="' + h.dataset.para + '">' +
            esc(h.textContent.trim().slice(0, 30)) + "</button>";
        });
      } else html += '<p class="muted">（未识别到标题）</p>';
    } else {
      var ps = d.content.paragraphs || [];
      html = '<div class="toc-h">📑 段落</div>';
      var step = Math.max(1, Math.ceil(ps.length / 60));
      for (var j = 0; j < ps.length; j += step) {
        html += '<button class="toc-item" data-para="' + j + '">' + esc(ps[j].slice(0, 22)) + "</button>";
      }
    }
    box.innerHTML = html || '<p class="muted">（无目录）</p>';
    box.onclick = function (e) {
      var b = e.target.closest(".toc-item");
      if (!b) return;
      var content = $("#readerContent");
      if (S.readMode === "canvas") {
        if (b.dataset.page) { S.pdfPage = parseInt(b.dataset.page, 10); drawPage(); }
        return;
      }
      var target = b.dataset.page != null
        ? content.querySelector('[data-page="' + b.dataset.page + '"]')
        : content.querySelector('[data-para="' + b.dataset.para + '"]');
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  }

  /* ---------- 摘录高亮 ---------- */
  function collectTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        /* 排除页码标签等非正文文本，其余全部纳入（含纯空白节点，
           保证与 Selection.toString() 的拼接一致，跨段摘录可精确回显） */
        if (p && p.closest(".pg-no")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var out = [];
    while (walker.nextNode()) out.push(walker.currentNode);
    return out;
  }

  function unwrapMark(mark) {
    var parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  }

  function applyHighlights() {
    var content = $("#readerContent");
    Array.prototype.forEach.call(content.querySelectorAll("mark.hl"), unwrapMark);
    var d = S.cur;
    if (!d) return;
    S.curAnnos.forEach(function (a) {
      if (a.kind !== "excerpt" || !a.locator || !a.locator.exactText) return;
      var nodes = collectTextNodes(content);
      var stream = "", map = [];
      nodes.forEach(function (n) {
        map.push({ node: n, start: stream.length });
        stream += n.nodeValue;
      });
      var needle = a.locator.exactText;
      var candidates = [], pos = 0, idx;
      while ((idx = stream.indexOf(needle, pos)) >= 0) { candidates.push(idx); pos = idx + 1; }
      if (!candidates.length) { a._locateFail = true; return; }
      a._locateFail = false;
      var chosen = candidates[0];
      if (candidates.length > 1 && a.locator.prefix) {
        for (var i = 0; i < candidates.length; i++) {
          var pre = stream.slice(Math.max(0, candidates[i] - a.locator.prefix.length), candidates[i]);
          if (pre.slice(-a.locator.prefix.length) === a.locator.prefix) { chosen = candidates[i]; break; }
        }
      }
      /* 逐节点包 mark */
      var start = chosen, end = chosen + needle.length;
      map.forEach(function (m) {
        var nStart = m.start, nEnd = m.start + m.node.nodeValue.length;
        if (nEnd <= start || nStart >= end) return;
        var node = m.node;
        var s = Math.max(start - nStart, 0);
        var e = Math.min(end - nStart, node.nodeValue.length);
        if (s > 0) node = node.splitText(s);
        var len = e - s;
        if (node.nodeValue.length > len) node.splitText(len);
        var mark = document.createElement("mark");
        mark.className = "hl";
        mark.dataset.anno = a.id;
        node.parentNode.insertBefore(mark, node);
        mark.appendChild(node);
      });
    });
    content.normalize();
  }

  function locateAnno(annoId) {
    var mark = $("#readerContent mark.hl[data-anno='" + annoId + "']");
    if (!mark) { toast("⚠️ 定位失效：原文位置无法匹配（原文可能已被修改）"); return; }
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    mark.classList.add("flash");
    setTimeout(function () { mark.classList.remove("flash"); }, 1600);
  }

  /* ---------- 划选工具条 ---------- */
  function bindSelection() {
    var content = $("#readerContent");
    ["mouseup", "touchend"].forEach(function (ev) {
      content.addEventListener(ev, function (e) {
        setTimeout(function () { onSelection(e); }, 30);
      });
    });
    document.addEventListener("selectionchange", function () {
      var sel = window.getSelection();
      if (sel && sel.isCollapsed) $("#selPop").classList.add("hidden");
    });
    $("#selPop").addEventListener("mousedown", function (e) {
      e.preventDefault(); /* 防止选区丢失 */
    });
    $("#selPop").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b || !S.pendingSel) return;
      var act = b.dataset.act, sel = S.pendingSel;
      S.pendingSel = null;
      $("#selPop").classList.add("hidden");
      if (act === "excerpt") createExcerpt(sel);
      else if (act === "excerpt-think") createExcerpt(sel, function (anno) {
        openThoughtModal(null, [anno.id]);
      });
      else if (act === "copy") {
        var d = S.cur;
        RC.copyText(RC.buildCitation(d, { text: sel.text, locator: sel.locator }))
          .then(function () { toast("✅ 引文已复制（含出处）"); },
            function () { toast("❌ 复制失败"); });
      }
      window.getSelection().removeAllRanges();
    });
  }

  function onSelection(e) {
    var content = $("#readerContent");
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return hideSelPop();
    var text = sel.toString();
    if (!text || text.trim().length < 2) return hideSelPop();
    var node = sel.anchorNode;
    if (!node) return hideSelPop();
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el || !content.contains(el)) return hideSelPop();

    var loc = buildLocatorFromSel(sel);
    S.pendingSel = { text: text.trim(), locator: loc };

    var rect = sel.getRangeAt(0).getBoundingClientRect();
    var pop = $("#selPop");
    pop.classList.remove("hidden");
    var top = rect.top > 60 ? rect.top - 46 : rect.bottom + 8;
    var left = Math.max(10, Math.min(window.innerWidth - 240, rect.left + rect.width / 2 - 110));
    pop.style.top = top + "px";
    pop.style.left = left + "px";
  }
  function hideSelPop() { $("#selPop").classList.add("hidden"); }

  function buildLocatorFromSel(sel) {
    var content = $("#readerContent");
    var anchor = sel.anchorNode, focus = sel.focusNode;
    var aEl = anchor.nodeType === 1 ? anchor : anchor.parentElement;
    var loc = { type: S.cur.format === "pdf" ? "pdf" : S.cur.format };
    var pgEl = aEl && aEl.closest ? aEl.closest("[data-page]") : null;
    var paraEl = aEl && aEl.closest ? aEl.closest("[data-para]") : null;
    if (pgEl) loc.page = parseInt(pgEl.dataset.page, 10);
    if (paraEl) loc.para = parseInt(paraEl.dataset.para, 10);
    if (loc.page == null && loc.para == null) loc.para = 0;
    loc.exactText = sel.toString();
    /* 前后文（用于消歧定位） */
    try {
      if (anchor.nodeType === 3) {
        var off = sel.anchorOffset;
        loc.prefix = anchor.nodeValue.slice(Math.max(0, off - 24), off);
      }
      if (focus && focus.nodeType === 3) {
        var foff = sel.focusOffset;
        loc.suffix = focus.nodeValue.slice(foff, foff + 24);
      }
    } catch (e) { /* ignore */ }
    return loc;
  }

  function createExcerpt(selInfo, cb) {
    /* locator.exactText 保留原始选区文本（未 trim），用于高亮精确回显 */
    var loc = JSON.parse(JSON.stringify(selInfo.locator));
    var anno = {
      id: uid("anno"), docId: S.cur.id, kind: "excerpt",
      text: selInfo.text, locator: loc,
      topics: [], tags: [], relatedIds: [],
      createdAt: nowISO(), updatedAt: nowISO()
    };
    RC.putAnnotation(anno).then(function (a) {
      S.curAnnos.unshift(a);
      rerenderKeepScroll();
      renderNotes();
      toast("✅ 已摘录（" + RC.locatorSummary(loc) + "）");
      if (cb) cb(a);
    });
  }

  function rerenderKeepScroll() {
    var el = $("#readerContent");
    var top = el.scrollTop;
    renderContent();
    el.scrollTop = top;
    renderToc();
  }

  /* ---------- 右侧笔记面板 ---------- */
  function bindNotesPanel() {
    $$(".rn-tab").forEach(function (t) {
      t.addEventListener("click", function () {
        $$(".rn-tab").forEach(function (x) { x.classList.remove("active"); });
        $$(".rn-pane").forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active");
        $("[data-rn-pane='" + t.dataset.rn + "']").classList.add("active");
      });
    });
    $("#newThoughtBtn").addEventListener("click", function () { openThoughtModal(null, []); });
    $("#noteList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.dataset.act, id = b.dataset.id;
      var a = S.curAnnos.filter(function (x) { return x.id === id; })[0];
      if (!a) return;
      if (act === "locate-anno") locateAnno(id);
      else if (act === "add-thought") openThoughtModal(null, [id]);
      else if (act === "cite-anno") {
        RC.copyText(RC.buildCitation(S.cur, a)).then(function () { toast("✅ 引文已复制"); });
      } else if (act === "edit-thought") openThoughtModal(id, null);
      else if (act === "del-anno") {
        if (confirm("删除这条" + (a.kind === "excerpt" ? "摘录" : "思考") + "？")) {
          RC.deleteAnnotation(id).then(function () {
            S.curAnnos = S.curAnnos.filter(function (x) { return x.id !== id; });
            rerenderKeepScroll(); renderNotes();
          });
        }
      } else if (act === "assign-anno") openAssignTargets(a,
        (a.kind === "excerpt" ? "摘录" : "思考") + "：" + a.text.slice(0, 14) + "…", a.topics || [], RC.putAnnotation);
    });
  }

  function renderNotes() {
    var list = S.curAnnos.slice().sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
    $("#rnCount").textContent = list.length;
    $("#noteList").innerHTML = list.length
      ? list.map(function (a) { return annoCard(a, {}); }).join("")
      : '<p class="muted">暂无笔记。在正文中<b>划选一段文字</b>即可摘录；点上方「新建思考」可写独立笔记。</p>';
  }

  function openThoughtModal(editId, relatedPreselect) {
    var editing = editId ? S.curAnnos.filter(function (x) { return x.id === editId; })[0] : null;
    var excerpts = S.curAnnos.filter(function (a) { return a.kind === "excerpt"; });
    var checked = editing ? (editing.relatedIds || []) : (relatedPreselect || []);
    rModal(
      '<h3 class="rm-title">' + (editing ? "✏️ 编辑个人思考" : "💭 新建个人思考") + "</h3>" +
      '<div class="form-row"><label>思考内容</label><textarea id="thText" rows="6" placeholder="写下你的分析、观点、写作线索…">' +
      esc(editing ? editing.text : "") + "</textarea></div>" +
      (excerpts.length ? '<div class="form-row"><label>关联摘录（可选）</label><div class="assign-list">' +
        excerpts.map(function (a) {
          return '<label class="assign-row"><input type="checkbox" value="' + a.id + '"' +
            (checked.indexOf(a.id) >= 0 ? " checked" : "") + "> 📌 " +
            esc(a.text.slice(0, 30)) + (a.text.length > 30 ? "…" : "") + "</label>";
        }).join("") + "</div></div>" : "") +
      '<div class="rm-actions"><button class="btn btn-primary" id="thSave">保存</button></div>'
    );
    $("#thSave").onclick = function () {
      var text = $("#thText").value.trim();
      if (!text) { toast("请填写思考内容"); return; }
      var rel = $$("#readerModalBody .assign-list input:checked").map(function (c) { return c.value; });
      var anno = editing || {
        id: uid("anno"), docId: S.cur.id, kind: "thought",
        topics: [], tags: [], relatedIds: [], createdAt: nowISO()
      };
      anno.text = text;
      anno.relatedIds = rel;
      RC.putAnnotation(anno).then(function (a) {
        if (!editing) S.curAnnos.push(a);
        closeRModal(); renderNotes();
        toast("✅ 思考已保存（自动保存至本机）");
      });
    };
  }

  /* ---------- 来源信息表单 ---------- */
  function bindInfoForm() {
    $("#saveInfoBtn").addEventListener("click", function () {
      if (!S.cur) return;
      S.cur.title = $("#infoTitle").value.trim() || S.cur.title;
      S.cur.authors = $("#infoAuthors").value.trim() || null;
      S.cur.sourceType = $("#infoType").value;
      S.cur.sourceUrl = $("#infoUrl").value.trim() || null;
      S.cur.publishedDate = $("#infoDate").value || null;
      S.cur.note = $("#infoNote").value.trim() || null;
      RC.putDoc(S.cur).then(function () {
        toast("✅ 来源信息已保存");
        $("#readerTitle").textContent = S.cur.title;
        refresh();
      });
    });
  }

  function fillInfoForm() {
    var d = S.cur;
    $("#infoTitle").value = d.title;
    $("#infoAuthors").value = d.authors || "";
    $("#infoType").value = d.sourceType;
    $("#infoUrl").value = d.sourceUrl || "";
    $("#infoDate").value = d.publishedDate ? String(d.publishedDate).slice(0, 10) : "";
    $("#infoNote").value = d.note || "";
    var warn = [];
    if (!d.authors) warn.push("作者");
    if (!d.sourceUrl) warn.push("来源链接");
    if (!d.publishedDate) warn.push("发布日期");
    $("#infoWarn").innerHTML = warn.length
      ? "⚠️ 出处信息不全：缺 " + warn.join("/") + "。导出与复制引文时会带警告标记。"
      : "✅ 出处信息完整";
  }

  function editInfoModal(docId) {
    RC.getDoc(docId).then(function (d) {
      if (!d) return;
      rModal(
        '<h3 class="rm-title">✏️ 编辑来源信息</h3>' +
        '<div class="form-row"><label>标题</label><input id="eiTitle" value="' + esc(d.title) + '"></div>' +
        '<div class="form-row"><label>作者 / 机构</label><input id="eiAuthors" value="' + esc(d.authors || "") + '"></div>' +
        '<div class="form-row"><label>来源类型</label><select id="eiType">' +
        RC.SOURCE_TYPES.map(function (t) {
          return '<option value="' + t.v + '"' + (d.sourceType === t.v ? " selected" : "") + ">" + t.label + "</option>";
        }).join("") + "</select></div>" +
        '<div class="form-row"><label>来源链接</label><input id="eiUrl" value="' + esc(d.sourceUrl || "") + '"></div>' +
        '<div class="form-row"><label>发布日期</label><input id="eiDate" type="date" value="' + (d.publishedDate ? String(d.publishedDate).slice(0, 10) : "") + '"></div>' +
        '<div class="form-row"><label>备注</label><input id="eiNote" value="' + esc(d.note || "") + '"></div>' +
        '<div class="rm-actions"><button class="btn btn-primary" id="eiSave">保存</button></div>'
      );
      $("#eiSave").onclick = function () {
        d.title = $("#eiTitle").value.trim() || d.title;
        d.authors = $("#eiAuthors").value.trim() || null;
        d.sourceType = $("#eiType").value;
        d.sourceUrl = $("#eiUrl").value.trim() || null;
        d.publishedDate = $("#eiDate").value || null;
        d.note = $("#eiNote").value.trim() || null;
        RC.putDoc(d).then(function () { closeRModal(); refresh(); toast("✅ 已保存"); });
      };
    });
  }

  function setFont(px) {
    S.fontSize = Math.max(12, Math.min(24, px));
    $("#readerContent").style.fontSize = S.fontSize + "px";
  }

  /* ================= 主题导出 ================= */
  function openExportModal() {
    var tid = S.view.slice(6);
    var rows = S.topics.map(function (t) {
      var n = S.annos.filter(function (a) { return a.topics.indexOf(t.id) >= 0; }).length +
        S.docs.filter(function (d) { return d.topics.indexOf(t.id) >= 0; }).length;
      return '<label class="assign-row"><input type="checkbox" class="ex-topic" value="' + t.id + '"' +
        (t.id === tid ? " checked" : "") + (n ? "" : " disabled") + "> " + esc(t.name) +
        (n ? "（" + n + " 条）" : "（空）") + "</label>";
    }).join("");
    rModal(
      '<h3 class="rm-title">⬇️ 按主题导出 JSON</h3>' +
      '<div class="form-row"><label>选择主题（可多选并集）</label><div class="assign-list">' + rows + "</div></div>" +
      '<div class="form-row"><label>内容范围</label>' +
      '<label class="assign-row"><input type="checkbox" id="exExcerpt" checked> 📌 原文摘录</label>' +
      '<label class="assign-row"><input type="checkbox" id="exThought" checked> 💭 个人思考</label>' +
      '<label class="assign-row"><input type="checkbox" id="exMeta" checked> 📄 关联文献元数据</label>' +
      '<label class="assign-row"><input type="checkbox" id="exFull"> 📃 包含文献全文（默认关闭）</label>' +
      "</div>" +
      '<div id="exPreview" class="upload-msg"></div>' +
      '<div class="rm-actions"><button class="btn btn-primary" id="exGo">生成并下载</button></div>'
    );
    var upd = function () {
      var topics = $$("#readerModalBody .ex-topic:checked").map(function (c) {
        return S.topics.filter(function (t) { return t.id === c.value; })[0];
      });
      var data = RC.buildTopicExport(topics, S.docs, S.annos, {
        includeExcerpt: $("#exExcerpt").checked,
        includeThought: $("#exThought").checked,
        includeDocMeta: $("#exMeta").checked,
        includeFullText: $("#exFull").checked
      });
      $("#exPreview").innerHTML = "预览：文献 <b>" + data.documents.length + "</b> · 笔记 <b>" + data.annotations.length +
        "</b>（摘录 " + data.annotations.filter(function (a) { return a.kind === "verbatim_excerpt"; }).length +
        " / 思考 " + data.annotations.filter(function (a) { return a.kind === "personal_thought"; }).length +
        "）· 警告 <b>" + data.warnings.length + "</b>（缺失来源 / 定位未核验）";
      return data;
    };
    $$("#readerModalBody input").forEach(function (c) { c.addEventListener("change", upd); });
    upd();
    $("#exGo").onclick = function () {
      var data = upd();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "智慧识别-主题导出-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
      closeRModal();
      toast("✅ 已导出（UTF-8 JSON，可用标准解析器读取）");
    };
  }

  /* ================= 备份恢复 ================= */
  function doBackup() {
    RC.exportBackup().then(function (data) {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "智慧识别-完整备份-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("✅ 备份已下载（不含原始 PDF 二进制，详见备份说明）");
    });
  }

  function previewRestore(data) {
    rModal(
      '<h3 class="rm-title">♻️ 恢复备份预览</h3>' +
      '<p class="muted">备份时间：' + fmtDT(data.exported_at) + " · 版本 " + esc(data.app_version || "?") + "</p>" +
      '<ul class="pts">' +
      "<li>文献 <b>" + (data.docs || []).length + "</b> 篇</li>" +
      "<li>笔记 <b>" + (data.annotations || []).length + "</b> 条（摘录 " +
      (data.annotations || []).filter(function (a) { return a.kind === "excerpt"; }).length + " / 思考 " +
      (data.annotations || []).filter(function (a) { return a.kind === "thought"; }).length + "）</li>" +
      "<li>主题 <b>" + (data.topics || []).length + "</b> 个</li>" +
      "</ul>" +
      '<p class="muted">⚠️ 恢复采用「相同 ID 覆盖、新记录追加」策略，不删除现有数据。原始 PDF 二进制不在备份内，恢复后原版模式不可用（文本阅读不受影响）。</p>' +
      '<div class="rm-actions"><button class="btn btn-primary" id="rsGo">确认恢复</button></div>'
    );
    $("#rsGo").onclick = function () {
      RC.restoreBackup(data).then(function (stat) {
        closeRModal(); refresh();
        toast("✅ 恢复完成：新增文献 " + (stat.docs.total - stat.docs.existed) +
          " 篇 / 覆盖 " + stat.docs.existed + " 篇");
      }, function (err) { toast("❌ 恢复失败：" + err.message); });
    };
  }

  /* ---------------- 启动 ---------------- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else init();

  return { init: init, openDoc: openDoc, refresh: refresh, S: S };
})();
