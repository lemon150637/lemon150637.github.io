/* ============================================================
 * ReaderCore —— 法律个人文献阅读核心层
 * 职责：IndexedDB 存储 / 文件解析 / 文献模型 / 引用与导出 / 备份
 * 设计原则（对应 PRD）：
 *   - 原始资料与加工结果分开：docs 存元数据+提取内容，blobs 存原始二进制
 *   - 原文摘录与个人思考分类型，导出可区分
 *   - 缺失信息保持 null，不编造
 *   - 纯函数在 Node 下可测试（module.exports）
 * ============================================================ */
var ReaderCore = (function () {
  "use strict";

  var APP_VERSION = "2.0.0";
  var DB_NAME = "zhihui_reader";
  var DB_VER = 1;
  var MAX_FILE_SIZE = 60 * 1024 * 1024; /* 60MB */

  /* ---------------- 基础工具 ---------------- */
  function uid(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2, 8);
  }
  function nowISO() { return new Date().toISOString(); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* 复制文本：安全上下文用 clipboard API，否则 execCommand 兜底 */
  function copyText(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("复制失败"));
      } catch (e) { reject(e); }
    });
  }

  /* ---------------- 纯函数：HTML 净化 ---------------- */
  function sanitizeHtml(html) {
    var s = String(html || "");
    s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, "");
    s = s.replace(/<style[\s\S]*?<\/style\s*>/gi, "");
    s = s.replace(/<\/?(iframe|object|embed|form|input|button|link|meta|base)[^>]*>/gi, "");
    /* 去事件属性与 javascript: 伪协议 */
    s = s.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
    s = s.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
    s = s.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");
    s = s.replace(/javascript:/gi, "blocked:");
    return s;
  }

  /* ---------------- 纯函数：段落切分 ---------------- */
  function splitParagraphs(text) {
    return String(text || "").split(/\n\s*\n/)
      .map(function (t) { return t.replace(/[ \t]*\n[ \t]*/g, " ").trim(); })
      .filter(function (t) { return t.length > 0; });
  }

  /* ---------------- 纯函数：来源类型与引用 ---------------- */
  var SOURCE_TYPES = [
    { v: "journal_article", label: "期刊论文" },
    { v: "law", label: "法律规范" },
    { v: "case", label: "裁判案例" },
    { v: "web", label: "网页资讯" },
    { v: "book", label: "书籍" },
    { v: "other", label: "其他" }
  ];
  function sourceTypeLabel(v) {
    for (var i = 0; i < SOURCE_TYPES.length; i++) {
      if (SOURCE_TYPES[i].v === v) return SOURCE_TYPES[i].label;
    }
    return "其他";
  }
  function locatorSummary(loc) {
    if (!loc) return "位置未知";
    if (loc.type === "pdf") return "第 " + loc.page + " 页";
    return "第 " + (loc.para + 1) + " 段";
  }

  /* 复制含出处引文：缺失字段给出提示，不编造 */
  function buildCitation(doc, anno) {
    var parts = [];
    parts.push("「" + String(anno.text || "").trim() + "」");
    var src = [];
    if (doc.title) src.push("《" + doc.title + "》");
    if (doc.authors) src.push(String(doc.authors));
    if (doc.sourceUrl) src.push(doc.sourceUrl);
    else if (doc.publication) src.push(doc.publication);
    if (doc.publishedDate) src.push(String(doc.publishedDate).slice(0, 10));
    if (anno.locator) src.push(locatorSummary(anno.locator));
    parts.push("—— " + src.join("，"));
    var missing = [];
    if (!doc.authors) missing.push("作者");
    if (!doc.sourceUrl && !doc.publication) missing.push("来源");
    if (!doc.publishedDate) missing.push("日期");
    if (missing.length) parts.push("（〔出处信息不全：缺" + missing.join("/") + "，请补充后使用〕）");
    return parts.join("\n");
  }

  /* ---------------- 纯函数：主题导出 ---------------- */
  /* 遵循 PRD 6.1 契约的简化实现：documents / annotations / warnings */
  function buildTopicExport(topics, docs, annos, opts) {
    opts = opts || {};
    var topicIds = topics.map(function (t) { return t.id; });
    var includeExcerpt = opts.includeExcerpt !== false;
    var includeThought = opts.includeThought !== false;
    var includeFullText = !!opts.includeFullText;

    /* 选中主题的笔记（直接归属） */
    var selAnnos = annos.filter(function (a) {
      var inTopic = a.topics && a.topics.some(function (tid) {
        return topicIds.indexOf(tid) >= 0;
      });
      if (!inTopic) return false;
      if (a.kind === "excerpt") return includeExcerpt;
      if (a.kind === "thought") return includeThought;
      return false;
    });
    /* 思考引用了被过滤摘录时，补入关联摘录（避免悬空 ID） */
    if (includeThought && !includeExcerpt) {
      var needIds = {};
      selAnnos.forEach(function (a) {
        (a.relatedIds || []).forEach(function (rid) { needIds[rid] = 1; });
      });
      annos.forEach(function (a) {
        if (a.kind === "excerpt" && needIds[a.id] &&
            selAnnos.indexOf(a) < 0) selAnnos.push(a);
      });
    }

    /* 涉及的文献 */
    var docIds = {};
    selAnnos.forEach(function (a) { docIds[a.docId] = 1; });
    if (opts.includeDocMeta !== false) {
      docs.forEach(function (d) {
        if (d.topics && d.topics.some(function (tid) { return topicIds.indexOf(tid) >= 0; })) {
          docIds[d.id] = 1;
        }
      });
    }
    var selDocs = docs.filter(function (d) { return docIds[d.id]; });

    var warnings = [];
    var out = {
      schema_version: "1.0.0",
      exported_at: nowISO(),
      app_version: APP_VERSION,
      scope: {
        topic_ids: topicIds,
        mode: "direct_annotation_membership",
        included_kinds: [].concat(
          includeExcerpt ? ["verbatim_excerpt"] : [],
          includeThought ? ["personal_thought"] : []
        ),
        include_full_text: includeFullText
      },
      topics: topics.map(function (t) {
        return { id: t.id, name: t.name, description: t.description || null, archived: !!t.archived };
      }),
      documents: selDocs.map(function (d) {
        var o = {
          id: d.id, title: d.title, source_type: d.sourceType, format: d.format,
          authors: d.authors || null, publication: d.publication || null,
          published_date: d.publishedDate || null, source_url: d.sourceUrl || null,
          imported_at: d.importedAt, topics: d.topics || []
        };
        if (includeFullText) o.full_text = docPlainText(d);
        if (!d.authors || !d.sourceUrl) {
          warnings.push({
            document_id: d.id, code: "SOURCE_INCOMPLETE",
            fields: [].concat(!d.authors ? ["authors"] : [], !d.sourceUrl ? ["source_url"] : [])
          });
        }
        return o;
      }),
      annotations: selAnnos.map(function (a) {
        if (!a.locator) warnings.push({ annotation_id: a.id, code: "LOCATOR_UNVERIFIED" });
        return {
          id: a.id,
          kind: a.kind === "excerpt" ? "verbatim_excerpt" : "personal_thought",
          document_id: a.docId,
          text: a.text,
          locator: a.locator ? {
            type: a.locator.type,
            page_number: a.locator.page || null,
            para_index: (a.locator.para != null ? a.locator.para : null),
            exact_text: a.locator.exactText || null,
            prefix: a.locator.prefix || null,
            suffix: a.locator.suffix || null,
            verification: "unverified"
          } : null,
          related_annotation_ids: a.relatedIds || [],
          topic_ids: a.topics || [],
          tags: a.tags || [],
          created_at: a.createdAt,
          updated_at: a.updatedAt
        };
      }),
      warnings: warnings
    };
    return out;
  }

  /* 文献纯文本（导出全文 / 搜索用） */
  function docPlainText(d) {
    if (!d || !d.content) return "";
    if (d.content.pages) return d.content.pages.map(function (p) { return p.text; }).join("\n\n");
    if (d.content.paragraphs) return d.content.paragraphs.join("\n\n");
    if (d.content.html) return d.content.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return "";
  }

  /* ---------------- 文档规范化 ---------------- */
  function normalizeDoc(f) {
    f = f || {};
    var text = f.content && (f.content.pages || f.content.paragraphs) ? "" : "";
    return {
      id: f.id || uid("doc"),
      title: f.title || "未命名文献",
      authors: f.authors || null,
      sourceType: f.sourceType || "other",
      publication: f.publication || null,
      sourceUrl: f.sourceUrl || null,
      publishedDate: f.publishedDate || null,
      importedAt: f.importedAt || nowISO(),
      note: f.note || null,
      captureMethod: f.captureMethod || "file_import",
      format: f.format || "txt",
      topics: f.topics || [],
      status: f.status || "inbox",
      content: f.content || { paragraphs: [] },
      pageCount: f.pageCount || 0,
      charCount: f.charCount != null ? f.charCount : docPlainText({ content: f.content }).length,
      textExtracted: f.textExtracted !== false,
      reading: f.reading || { ratio: 0, lastReadAt: null },
      deleted: !!f.deleted,
      deletedAt: f.deletedAt || null
    };
  }

  /* ---------------- IndexedDB 存储层（仅浏览器） ---------------- */
  var dbPromise = null;
  function openDB() {
    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("当前环境不支持 IndexedDB（本地存储不可用）"));
    }
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains("docs")) db.createObjectStore("docs", { keyPath: "id" });
        if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs", { keyPath: "docId" });
        if (!db.objectStoreNames.contains("annotations")) {
          var s = db.createObjectStore("annotations", { keyPath: "id" });
          s.createIndex("docId", "docId", { unique: false });
        }
        if (!db.objectStoreNames.contains("topics")) db.createObjectStore("topics", { keyPath: "id" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }
  function tx(storeName, mode, fn) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, mode);
        var store = t.objectStore(storeName);
        var out;
        try { out = fn(store); } catch (e) { reject(e); return; }
        t.oncomplete = function () { resolve(out && out.__val !== undefined ? out.__val : out); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }
  function wrapReq(r) {
    return new Promise(function (resolve, reject) {
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  /* 文档 CRUD */
  function putDoc(doc) {
    var copy = {};
    for (var k in doc) copy[k] = doc[k]; /* 不写 fileData 进 docs 记录 */
    delete copy.fileData;
    return tx("docs", "readwrite", function (s) { s.put(copy); return copy; }).then(function(){ return copy; });
  }
  function getDoc(id) {
    return openDB().then(function (db) {
      return wrapReq(db.transaction("docs").objectStore("docs").get(id));
    });
  }
  function listDocs() {
    return openDB().then(function (db) {
      return wrapReq(db.transaction("docs").objectStore("docs").getAll());
    }).then(function (rows) { return (rows || []).map(normalizeDoc); });
  }
  function softDeleteDoc(id) {
    return getDoc(id).then(function (d) {
      if (!d) return;
      d.deleted = true; d.deletedAt = nowISO();
      return putDoc(d);
    });
  }
  function restoreDoc(id) {
    return getDoc(id).then(function (d) {
      if (!d) return;
      d.deleted = false; d.deletedAt = null;
      return putDoc(d);
    });
  }
  /* 永久删除：连带二进制与笔记 */
  function purgeDoc(id) {
    return Promise.all([
      listAnnotations(id).then(function (annos) {
        return tx("annotations", "readwrite", function (s) {
          annos.forEach(function (a) { s.delete(a.id); });
        });
      }),
      tx("docs", "readwrite", function (s) { s.delete(id); }),
      tx("blobs", "readwrite", function (s) { s.delete(id); })
    ]);
  }
  function updateReading(id, reading) {
    return getDoc(id).then(function (d) {
      if (!d) return;
      d.reading = reading;
      return putDoc(d);
    });
  }

  /* 二进制（原始 PDF 等） */
  function putBlob(docId, buffer) {
    return tx("blobs", "readwrite", function (s) { s.put({ docId: docId, data: buffer }); });
  }
  function getBlob(docId) {
    return openDB().then(function (db) {
      return wrapReq(db.transaction("blobs").objectStore("blobs").get(docId));
    }).then(function (r) { return r ? r.data : null; });
  }

  /* 笔记 CRUD */
  function putAnnotation(a) {
    a.updatedAt = nowISO();
    return tx("annotations", "readwrite", function (s) { s.put(a); }).then(function () { return a; });
  }
  function deleteAnnotation(id) {
    return tx("annotations", "readwrite", function (s) { s.delete(id); });
  }
  function listAnnotations(docId) {
    return openDB().then(function (db) {
      return wrapReq(db.transaction("annotations").objectStore("annotations").getAll());
    }).then(function (rows) {
      rows = rows || [];
      return docId ? rows.filter(function (a) { return a.docId === docId; }) : rows;
    });
  }

  /* 主题 CRUD */
  function putTopic(t) {
    t.updatedAt = nowISO();
    return tx("topics", "readwrite", function (s) { s.put(t); }).then(function () { return t; });
  }
  function listTopics() {
    return openDB().then(function (db) {
      return wrapReq(db.transaction("topics").objectStore("topics").getAll());
    }).then(function (rows) { return (rows || []).sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name), "zh");
    }); });
  }
  /* 删除主题：剥离文档与笔记中的引用 */
  function deleteTopic(id) {
    return Promise.all([listDocs(), listAnnotations()]).then(function (r) {
      var docs = r[0], annos = r[1];
      return tx("topics", "readwrite", function (s) { s.delete(id); }).then(function () {
        var jobs = [];
        docs.forEach(function (d) {
          if (d.topics && d.topics.indexOf(id) >= 0) {
            d.topics = d.topics.filter(function (t) { return t !== id; });
            jobs.push(putDoc(d));
          }
        });
        annos.forEach(function (a) {
          if (a.topics && a.topics.indexOf(id) >= 0) {
            a.topics = a.topics.filter(function (t) { return t !== id; });
            jobs.push(putAnnotation(a));
          }
        });
        return Promise.all(jobs);
      });
    });
  }

  /* ---------------- 备份与恢复 ---------------- */
  function exportBackup() {
    return Promise.all([listDocs(), listAnnotations(), listTopics()]).then(function (r) {
      return {
        schema_version: "1.0.0",
        kind: "zhihui-reader-backup",
        app_version: APP_VERSION,
        exported_at: nowISO(),
        docs: r[0].map(function (d) { var c = {}; for (var k in d) c[k] = d[k]; delete c.fileData; return c; }),
        annotations: r[1],
        topics: r[2],
        note: "备份不含原始 PDF/DOCX 二进制文件（遵循 JSON 不嵌二进制原则），恢复后文本阅读与笔记完整可用。"
      };
    });
  }
  function restoreBackup(data) {
    if (!data || data.kind !== "zhihui-reader-backup" || !Array.isArray(data.docs)) {
      return Promise.reject(new Error("不是有效的智慧识别备份文件"));
    }
    return Promise.all([listDocs(), listAnnotations(), listTopics()]).then(function (cur) {
      var curDocIds = {}, curAnnoIds = {}, curTopicIds = {};
      cur[0].forEach(function (d) { curDocIds[d.id] = 1; });
      cur[1].forEach(function (a) { curAnnoIds[a.id] = 1; });
      cur[2].forEach(function (t) { curTopicIds[t.id] = 1; });
      var stat = { docs: { total: data.docs.length, existed: 0 }, annotations: { total: 0, existed: 0 }, topics: { total: 0, existed: 0 } };
      var jobs = [];
      data.docs.forEach(function (d) {
        if (curDocIds[d.id]) stat.docs.existed++; else stat.docs.total++;
        jobs.push(putDoc(normalizeDoc(d)));
      });
      (data.annotations || []).forEach(function (a) {
        stat.annotations.total++;
        if (curAnnoIds[a.id]) stat.annotations.existed++;
        jobs.push(putAnnotation(a));
      });
      (data.topics || []).forEach(function (t) {
        stat.topics.total++;
        if (curTopicIds[t.id]) stat.topics.existed++;
        jobs.push(putTopic(t));
      });
      return Promise.all(jobs).then(function () { return stat; });
    });
  }

  /* ---------------- 文件解析（仅浏览器） ---------------- */
  function extOf(name) {
    var m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : "";
  }

  function parsePdf(arrayBuffer) {
    if (typeof pdfjsLib === "undefined") {
      return Promise.reject(new Error("PDF 解析组件未加载"));
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = "js/libs/pdf.worker.min.js";
    return pdfjsLib.getDocument({ data: arrayBuffer }).promise.then(function (pdf) {
      var n = pdf.numPages, pages = [];
      function readPage(i) {
        if (i > n) return pages;
        return pdf.getPage(i).then(function (page) {
          return page.getTextContent();
        }).then(function (tc) {
          var s = "";
          (tc.items || []).forEach(function (it) {
            s += it.str + (it.hasEOL ? "\n" : "");
          });
          pages.push({ no: i, text: s.trim() });
          return readPage(i + 1);
        });
      }
      return readPage(1).then(function () {
        var total = pages.reduce(function (acc, p) { return acc + p.text.length; }, 0);
        return {
          format: "pdf",
          pages: pages,
          pageCount: n,
          textExtracted: total >= 30,
          charCount: total,
          fileData: arrayBuffer
        };
      });
    });
  }

  function parseDocx(arrayBuffer) {
    if (typeof mammoth === "undefined") {
      return Promise.reject(new Error("DOCX 解析组件未加载"));
    }
    return mammoth.convertToHtml({ arrayBuffer: arrayBuffer }).then(function (res) {
      var html = sanitizeHtml(res.value || "");
      var plain = html.replace(/<\/(p|h[1-6]|li|table|blockquote)>/gi, "\n\n")
        .replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n\s*\n/g, "\n\n").trim();
      return {
        format: "docx",
        html: html,
        charCount: plain.length
      };
    });
  }

  function parseText(text) {
    var paras = splitParagraphs(text);
    return {
      format: "txt",
      paragraphs: paras,
      charCount: text.length
    };
  }

  /* 统一入口：File → 文献字段 */
  function parseFile(file) {
    var ext = extOf(file.name);
    if (file.size > MAX_FILE_SIZE) {
      return Promise.reject(new Error("文件超过 60MB 上限"));
    }
    if (ext === "doc") {
      return Promise.reject(new Error("暂不支持旧版 .doc，请在 Word 中另存为 .docx 后再导入"));
    }
    if (["pdf", "docx", "txt", "md"].indexOf(ext) < 0) {
      return Promise.reject(new Error("不支持的文件类型 ." + ext + "（支持 PDF / DOCX / TXT / MD）"));
    }
    var title = file.name.replace(/\.[^.]+$/, "");
    if (ext === "pdf") {
      return file.arrayBuffer().then(parsePdf);
    }
    if (ext === "docx") {
      return file.arrayBuffer().then(parseDocx);
    }
    return file.text().then(parseText);
  }

  /* 网页抓取：经自有服务端代理（/api/fetch），静态托管下会失败并回退手动粘贴 */
  function fetchViaServer(url) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    var opt = { headers: { "Accept": "application/json" } };
    if (ctrl) opt.signal = ctrl.signal;
    return fetch("/api/fetch?u=" + encodeURIComponent(url), opt)
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error("服务端返回 " + res.status);
        return res.json();
      }).then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.message) || "抓取失败");
        return j;
      });
  }

  /* ---------------- 导出 ---------------- */
  var api = {
    APP_VERSION: APP_VERSION,
    uid: uid, nowISO: nowISO, esc: esc, copyText: copyText,
    sanitizeHtml: sanitizeHtml, splitParagraphs: splitParagraphs,
    SOURCE_TYPES: SOURCE_TYPES, sourceTypeLabel: sourceTypeLabel,
    locatorSummary: locatorSummary, buildCitation: buildCitation,
    buildTopicExport: buildTopicExport, docPlainText: docPlainText,
    normalizeDoc: normalizeDoc,
    putDoc: putDoc, getDoc: getDoc, listDocs: listDocs,
    softDeleteDoc: softDeleteDoc, restoreDoc: restoreDoc, purgeDoc: purgeDoc,
    updateReading: updateReading,
    putBlob: putBlob, getBlob: getBlob,
    putAnnotation: putAnnotation, deleteAnnotation: deleteAnnotation, listAnnotations: listAnnotations,
    putTopic: putTopic, listTopics: listTopics, deleteTopic: deleteTopic,
    exportBackup: exportBackup, restoreBackup: restoreBackup,
    parseFile: parseFile, fetchViaServer: fetchViaServer
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api; /* Node 测试环境：纯函数可用 */
  }
  if (typeof window !== "undefined") window.ReaderCore = api;
  return api;
})();
