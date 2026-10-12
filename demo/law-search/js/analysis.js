/* ============================================================
 * LawAnalyzer —— 智能法律分析引擎
 * 输入：案情描述文本
 * 流程：场景规则匹配 → 条文检索融合 → 动态要素检查 → 结构化报告
 * ============================================================ */
var LawAnalyzer = (function () {
  "use strict";

  /* 场景规则匹配：统计关键词命中数 */
  function matchRules(text) {
    var matched = [];
    (window.ANALYSIS_RULES || ANALYSIS_RULES).forEach(function (rule) {
      var hits = 0, words = [];
      (rule.keywords || []).forEach(function (kw) {
        if (text.indexOf(kw) !== -1) { hits++; words.push(kw); }
      });
      if (hits > 0) {
        matched.push({
          rule: rule,
          hits: hits,
          words: words,
          strength: hits * (hits >= 3 ? 1.5 : 1)   // 命中越多越强
        });
      }
    });
    matched.sort(function (a, b) { return b.strength - a.strength; });
    return matched;
  }

  /* 金额要素提取 */
  function extractMoney(text) {
    var m = text.match(/(\d[\d,，.]*)\s*(万元|万|元|块)/g);
    if (!m) return [];
    return m.slice(0, 3);
  }

  /* 时间要素检查：检测年份 → 诉讼时效风险 */
  function checkTimeRisk(text) {
    var risks = [];
    var yearNow = new Date().getFullYear();
    var years = text.match(/20\d{2}\s*年/g) || [];
    var seen = {};
    years.forEach(function (y) {
      var n = parseInt(y, 10);
      if (!seen[n] && !isNaN(n)) {
        seen[n] = 1;
        var diff = yearNow - n;
        if (diff >= 3) {
          risks.push("案情提及 " + n + " 年，距今已约 " + diff +
            " 年——请特别注意 3 年诉讼时效（民法典第188条），尽快通过催告、起诉等方式中断时效。");
        }
      }
    });
    if (/多年|好几年|一直拖/.test(text)) {
      risks.push("描述中出现「多年/一直拖延」字样，请核实最后一次主张权利的时间，注意 3 年诉讼时效。");
    }
    return risks;
  }

  /* 证据线索检查 */
  function checkEvidence(text) {
    var ev = [];
    if (/借条|欠条|合同|协议|收据|发票/.test(text)) ev.push("书面凭证（借条/合同/收据）：注意保存原件。");
    if (/转账|微信|支付宝|银行|流水/.test(text)) ev.push("转账/支付记录：可到银行或支付平台调取盖章流水。");
    if (/聊天记录|微信|短信/.test(text)) ev.push("聊天记录：建议完整录屏保存并保留原始载体（手机）。");
    if (/照片|视频|监控|录音/.test(text)) ev.push("影像/录音证据：注意保留原始文件，不要只存截图。");
    if (!ev.length) ev.push("目前描述中未提及证据，建议尽快开始收集：书面凭证、转账记录、聊天记录、影像资料。");
    return ev;
  }

  /* 主分析函数 */
  function analyze(text) {
    text = (text || "").trim();
    var report = {
      ok: false, text: text,
      types: [], provisions: [], focusPoints: [],
      advice: [], reminders: [], evidences: [],
      money: [], timeRisks: []
    };
    if (!text) return report;

    report.ok = true;
    report.money = extractMoney(text);
    report.timeRisks = checkTimeRisk(text);
    report.evidences = checkEvidence(text);

    /* 1) 场景规则 */
    var matchedRules = matchRules(text);
    var topRules = matchedRules.slice(0, 3);
    report.types = topRules.map(function (m) {
      return { name: m.rule.name, hits: m.hits, words: m.words.slice(0, 5) };
    });

    /* 2) 条文检索融合 */
    var scored = {};   // id -> {prov, score, why[]}
    topRules.forEach(function (m) {
      (m.rule.provisions || []).forEach(function (pid) {
        var p = LawSearch.byId(pid);
        if (!p) return;
        if (!scored[pid]) scored[pid] = { prov: p, score: 0, why: [] };
        scored[pid].score += 22 + m.strength * 2;   /* 场景规则条文保底高权重 */
        scored[pid].why.push("「" + m.rule.name + "」场景适用");
      });
      (m.rule.focus || []).forEach(function (f) { report.focusPoints.push(f); });
      (m.rule.advice || []).forEach(function (a) { report.advice.push(a); });
      (m.rule.remind || []).forEach(function (r) { report.reminders.push(r); });
    });

    var searchRes = LawSearch.search(text, { limit: 10 });
    searchRes.forEach(function (r) {
      var pid = r.prov.id;
      if (!scored[pid]) scored[pid] = { prov: r.prov, score: 0, why: [] };
      scored[pid].score += r.score;
      var kws = r.matched.map(function (m) { return m.term; }).slice(0, 4);
      if (kws.length) {
        scored[pid].why.push("命中关键词：" + kws.join("、"));
      }
    });

    var provList = Object.keys(scored).map(function (k) { return scored[k]; });
    provList.sort(function (a, b) { return b.score - a.score; });

    /* 去掉与已命中要点重复的补充，取前 8 条 */
    report.provisions = provList.slice(0, 8).map(function (item) {
      return {
        prov: item.prov,
        score: Math.round(item.score * 10) / 10,
        why: item.why.slice(0, 2)
      };
    });

    /* 3) 通用提醒 */
    if (report.provisions.length) {
      report.reminders.unshift("以上分析基于你的文字描述自动匹配，实际适用需结合全部证据与具体事实由专业人士判断。");
    } else {
      report.types = [{ name: "暂未识别出明确纠纷类型", hits: 0, words: [] }];
      report.focusPoints.push("未能匹配到典型场景，可尝试用更具体的法律用语描述（如「借款」「违约」「抚养费」「赔偿」等关键词）。");
    }
    return report;
  }

  return { analyze: analyze, matchRules: matchRules };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = LawAnalyzer; }
