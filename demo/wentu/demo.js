"use strict";
(() => {
  const get = (id) => document.getElementById(id);
  let step = -1;
  const sample = { product: "青苔绿陶瓷杯（演示商品）", facts: "【预设演示资料，非真实商品规格】\n商品：青苔绿陶瓷杯\n示例容量：350mL\n示例材质：陶瓷\n示例卖点：青苔绿配色、带柄造型，适合桌面与日常饮水场景。\n不包含保温、抗菌、认证等未经核实的营销承诺。" };
  const slides = [
    ["01 / 商品资料", "先把商品说清楚", "示例资料已填入下方表单：商品名称、参考规格与卖点均可修改。真实使用时，应先核实参数与素材来源。", []],
    ["02 / 卖点预览", "把商品信息，整理成内容结构", "以下为预先编写的示例文案，不是本次调用 AI 的结果。它展示主标题、场景说明和信息说明的层级。", ["主标题｜给日常，添一点青苔绿。", "场景说明｜让桌面多一处温和的色彩。", "信息说明｜示例容量 350mL，陶瓷材质；以实际商品为准。"]],
    ["03 / 渠道适配", "同一件商品，用合适的方式表达", "表单平台已切换至小红书。下面展示同一商品的两种预设表达；真实发布前仍需人工审核。", ["电商详情页｜外观配色 → 商品结构 → 场景 → 参数", "小红书图文｜桌面的一点绿：一只杯子的日常搭配", "创作边界｜不把示例参数当作商品事实，不虚构功效。"]],
    ["04 / 资料交付", "把准备工作，交给下一步制作", "你现在可以导出这份示例资料，也可以回到工作区修改内容。导出文件记录用户输入与文件名，不包含 AI 图片。", ["已准备：商品名称、卖点、目标平台", "可导出：JSON 创作资料", "完整 AI 生成：在本地应用连接相应模型后使用"]]
  ];
  function render() {
    const slide = slides[step];
    get("tour-kicker").textContent = slide[0]; get("tour-title").textContent = slide[1]; get("tour-copy").textContent = slide[2];
    const results = get("tour-results"); results.replaceChildren(); results.hidden = !slide[3].length;
    slide[3].forEach(text => { const item = document.createElement("p"); item.textContent = text; results.append(item); });
    get("tour-steps").querySelectorAll("li").forEach((li, index) => { if(index === step) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current"); li.classList.toggle("done", index < step); });
    get("tour-next").textContent = step === 3 ? "导出示例资料 ↓" : "下一步 →";
    get("tour-status").textContent = `第 ${step + 1} / 4 步 · 预设内容演示，不调用 AI。`;
  }
  get("tour-next").addEventListener("click", () => {
    if (step === 3) { get("export").click(); get("tour-status").textContent = get("product").value.trim() ? "已触发资料下载，演示完成。可继续修改表单或重置示例。" : "请在工作区补充商品名称后导出。"; return; }
    if (step === -1) {
      const changed = get("product").value.trim() || get("facts").value.trim();
      if (changed && !window.confirm("载入示例会替换你填写的名称、平台与卖点，是否继续？")) return;
      get("product").value = sample.product; get("facts").value = sample.facts; get("platform").value = "通用电商";
    }
    step++; if (step === 2) get("platform").value = "小红书"; render();
  });
  get("tour-reset").addEventListener("click", () => {
    step = -1; get("tour-kicker").textContent = "01 / 准备商品资料"; get("tour-title").textContent = "先把商品说清楚"; get("tour-copy").textContent = "点击「开始演示」，把示例名称、平台与已确认的卖点填入下方工作区。重置导览会保留表单中的内容。"; get("tour-results").hidden = true; get("tour-next").textContent = "开始演示 →"; get("tour-status").textContent = "导览已重置，表单资料已保留。"; get("tour-steps").querySelectorAll("li").forEach((li,index) => {li.classList.remove("done"); if(index===0)li.setAttribute("aria-current","step");else li.removeAttribute("aria-current");});
  });
})();