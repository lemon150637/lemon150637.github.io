/* ============================================================
 * LawSearch —— 中文法律条文检索引擎
 * 策略：查询串 → (a) 预置关键词字典命中  (b) 中文二元切词 bigram
 *       + IDF 权重 + 字段加权（标题/关键词/正文）+ 条文号直配
 * ============================================================ */
var LawSearch = (function () {
  "use strict";

  var provisions = [];      // 全量条文
  var dfBigram = {};        // bigram -> 出现文档数
  var dfKeyword = {};       // 关键词 -> 出现文档数
  var N = 0;

  function cjkRuns(s) {
    return (s || "").toString().match(/[\u4e00-\u9fa5]+/g) || [];
  }

  /* 中文二元切词（孤立单字噪声大，直接丢弃） */
  function bigrams(s) {
    var runs = cjkRuns(s), out = [];
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i];
      if (r.length === 1) continue;          // 孤字（常被数字/标点隔断）无检索价值
      for (var j = 0; j < r.length - 1; j++) out.push(r.substr(j, 2));
    }
    return out;
  }

  function countIn(hay, needle) {
    if (!hay || !needle) return 0;
    var c = 0, idx = 0;
    hay = hay.toString();
    while ((idx = hay.indexOf(needle, idx)) !== -1) { c++; idx += needle.length; }
    return c;
  }

  /* ---------- 建立索引 ---------- */
  function init(list) {
    provisions = list || [];
    dfBigram = {}; dfKeyword = {};
    N = provisions.length;
    provisions.forEach(function (p) {
      var text = (p.title || "") + " " + (p.content || "");
      var seen = {};
      bigrams(text).forEach(function (b) {
        if (!seen[b]) { seen[b] = 1; dfBigram[b] = (dfBigram[b] || 0) + 1; }
      });
      var seenK = {};
      (p.keywords || []).forEach(function (k) {
        if (!seenK[k]) { seenK[k] = 1; dfKeyword[k] = (dfKeyword[k] || 0) + 1; }
      });
    });
    return N;
  }

  /* ---------- 查询解析 ---------- */
  function parseQuery(q) {
    var terms = {};  // term -> weight(kind)
    // 1) 预置关键词命中（权重最高）
    provisions.forEach(function (p) {
      (p.keywords || []).forEach(function (k) {
        if (k.length >= 2 && q.indexOf(k) !== -1) {
          terms[k] = "keyword";
        }
      });
    });
    // 2) 中文 bigram
    var bg = bigrams(q);
    bg.forEach(function (b) { if (!terms[b]) terms[b] = "bigram"; });
    // 3) 长词组（>=3字连续串，整串命中加权）
    cjkRuns(q).forEach(function (r) {
      if (r.length >= 3 && !terms[r]) terms[r] = "phrase";
    });
    // 4) 条文号（如 188、第188条）
    var nums = q.match(/\d{2,4}/g) || [];
    nums.forEach(function (n) { terms["#" + n] = "number"; });
    return terms;
  }

  function idf(term, isKeyword) {
    var df = isKeyword ? (dfKeyword[term] || 0) : (dfBigram[term] || 0);
    return Math.log((N + 1) / (df + 1)) + 0.25;
  }

  /* ---------- 检索主函数 ----------
   * opts: { law, part, limit }
   * 返回 [{ prov, score, matched:[{term,field,count}] }]
   */
  function search(query, opts) {
    opts = opts || {};
    query = (query || "").trim();
    if (!query || !N) return [];

    var terms = parseQuery(query);
    var termList = Object.keys(terms);
    if (!termList.length) return [];

    var results = [];
    provisions.forEach(function (p) {
      if (opts.law && p.law !== opts.law) return;
      if (opts.part && p.part !== opts.part) return;

      var score = 0, matched = [];
      var lenNorm = Math.sqrt((p.content || "").length / 120) || 1;

      termList.forEach(function (term) {
        var kind = terms[term];
        var hit = null;

        if (kind === "keyword") {
          var kws = p.keywords || [];
          if (kws.indexOf(term) !== -1) {
            score += 5.5 * idf(term, true);
            hit = { term: term, field: "关键词", count: 1 };
          }
        }
        if (kind === "number") {
          var num = term.slice(1);
          if ((p.id || "").indexOf(num) !== -1) {
            score += 9;
            hit = { term: term, field: "条文号", count: 1 };
          }
        }
        if (!hit && kind !== "number") {
          var tCnt = countIn(p.title, term);
          var cCnt = countIn(p.content, term);
          var sCnt = countIn(p.summary, term);
          var kwCnt = countIn((p.keywords || []).join(" "), term);
          var w = 0;
          if (kwCnt) w += 4.5;
          if (tCnt)  w += 3.2 * (1 + Math.log(tCnt + 1));
          if (cCnt)  w += 1.6 * (1 + Math.log(cCnt + 1)) / lenNorm;
          if (sCnt)  w += 1.0;
          if (w > 0) {
            var mult = kind === "phrase" ? 2.2 : 1;
            score += w * idf(term, false) * mult;
            var field = tCnt ? "标题" : (cCnt ? "正文" : "解读");
            hit = { term: term, field: field, count: Math.max(tCnt, cCnt, kwCnt) };
          }
        }
        if (hit) matched.push(hit);
      });

      if (score > 0.05) {
        results.push({
          prov: p,
          score: Math.round(score * 100) / 100,
          matched: matched.sort(function (a, b) { return b.count - a.count; }).slice(0, 6)
        });
      }
    });

    results.sort(function (a, b) { return b.score - a.score; });
    var limit = opts.limit || 20;
    return results.slice(0, limit);
  }

  /* 依据主题找相关条文（详情页“相关条文”用） */
  function related(prov, limit) {
    limit = limit || 5;
    var topics = prov.topics || [];
    var out = [];
    provisions.forEach(function (p) {
      if (p === prov || p.law !== prov.law) return;
      var shared = (p.topics || []).filter(function (t) { return topics.indexOf(t) !== -1; });
      if (shared.length) out.push({ prov: p, shared: shared.length });
    });
    out.sort(function (a, b) { return b.shared - a.shared; });
    return out.slice(0, limit).map(function (x) { return x.prov; });
  }

  /* 获取某条条文（按 id） */
  function byId(id) {
    for (var i = 0; i < provisions.length; i++) {
      if (provisions[i].id === id) return provisions[i];
    }
    return null;
  }

  function stats() { return { count: N }; }

  return { init: init, search: search, related: related, byId: byId, stats: stats, bigrams: bigrams };
})();

/* 支持在 Node 环境下自检 */
if (typeof module !== "undefined" && module.exports) { module.exports = LawSearch; }
