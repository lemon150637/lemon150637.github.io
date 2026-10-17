"use strict";
const $ = (selector) => document.querySelector(selector);
let selected = [];
let mode = "single";
let panel = "create";
let urls = [];
const feedback = (message, error = false) => { $("#feedback").textContent = message; $("#feedback").classList.toggle("error", error); };
function renderImages() {
  urls.forEach(URL.revokeObjectURL); urls = [];
  $("#previews").replaceChildren();
  selected.forEach((file, index) => {
    const card = document.createElement("div"); card.className = "preview";
    const image = document.createElement("img"); const url = URL.createObjectURL(file); urls.push(url); image.src = url; image.alt = file.name;
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", `移除 ${file.name}`); remove.onclick = () => { selected.splice(index, 1); renderImages(); feedback(`已选择 ${selected.length} 张图片。`); };
    const name = document.createElement("small"); name.textContent = file.name;
    card.append(image, remove, name); $("#previews").append(card);
  });
}
function addFiles(files) {
  let rejected = 0;
  for (const file of files) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024 || selected.length >= 8) { rejected++; continue; }
    if (!selected.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) selected.push(file);
  }
  renderImages(); feedback(`已选择 ${selected.length} 张图片，仅在当前浏览器预览。${rejected ? ` ${rejected} 个文件未添加，请检查类型、大小或数量。` : ""}`, rejected > 0);
}
$("#images").addEventListener("change", (event) => { addFiles(event.target.files); event.target.value = ""; });
for (const name of ["dragenter", "dragover"]) $("#drop-zone").addEventListener(name, event => { event.preventDefault(); $("#drop-zone").classList.add("dragging"); });
$("#drop-zone").addEventListener("dragleave", () => $("#drop-zone").classList.remove("dragging"));
$("#drop-zone").addEventListener("drop", event => { event.preventDefault(); $("#drop-zone").classList.remove("dragging"); addFiles(event.dataTransfer.files); });
document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
  mode = button.dataset.mode;
  document.querySelectorAll("[data-mode]").forEach(item => { const active = item === button; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); });
  feedback(mode === "batch" ? "批量资料模式：可为这批商品整理共同要求；文件夹分批和 AI 批处理请使用本地应用。" : "单件商品模式：多角度参考图将作为同一件商品的资料导出。");
}));
const sections = {
  create: ["开始制作 / CREATE", "今天，为哪件商品上新？", "准备商品参考图与真实卖点，先把这一轮上新的素材梳理清楚。"],
  translate: ["多语言内容 / TRANSLATE", "让商品信息，跨越语言。", "上传已有商品图，在资料中填写目标语言与术语。此页面仅整理需求，图片翻译需运行本地应用。"],
  social: ["推广内容 / SOCIAL", "把商品卖点，写进推广图文。", "填写商品卖点、人群与内容要求，导出创作资料。AI 文案与图片制作需运行本地应用。"],
  guide: ["本地运行 / GET STARTED", "准备好工具，再开始制作。", ""]
};
document.querySelectorAll("[data-panel]").forEach(button => button.addEventListener("click", () => {
  panel = button.dataset.panel; const text = sections[panel];
  document.querySelectorAll("[data-panel]").forEach(item => { const active = item === button; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); });
  $("#section-label").textContent = text[0]; $("#section-title").textContent = text[1]; $("#intro").textContent = text[2];
  $("#editor").hidden = panel === "guide"; $("#guide").hidden = panel !== "guide"; $(".mode").hidden = panel !== "create";
  $("#workspace").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
}));
$("#export").addEventListener("click", () => {
  const product = $("#product").value.trim();
  if (!product) { feedback("请先填写商品名称，再导出资料。", true); $("#product").focus(); return; }
  const brief = { application: "文图 Wentu", kind: "user-authored-brief", aiGenerated: false, scene: panel, mode, product, platform: $("#platform").value, facts: $("#facts").value.trim(), referenceFiles: selected.map(file => ({ name: file.name, bytes: file.size, type: file.type })), note: "仅包含用户填写的商品资料与图片文件名，不包含图片内容或 AI 结果。" };
  const blob = new Blob([JSON.stringify(brief, null, 2)], { type: "application/json;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "wentu-product-brief.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); feedback("商品资料已导出。请妥善保管图片原文件，在本地应用中继续制作。");
});
window.addEventListener("beforeunload", () => urls.forEach(URL.revokeObjectURL));
