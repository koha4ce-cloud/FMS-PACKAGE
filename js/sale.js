// js/sale.js
import { db } from "./firebase.js";
import { doc, collection, query, orderBy, onSnapshot, updateDoc } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

export function initSale(classId, audit) {
  const salesCol = collection(db, "Classes", classId, "Sales");
  const q = query(salesCol, orderBy("created_at", "desc"));

  const container = document.getElementById("salesContainer");

  const modal = document.getElementById("salesModal");
  const closeBtn = document.getElementById("ScloseModal");
  const cancelBtn = document.getElementById("cancelSalesBtn");

  const pieCanvas = document.getElementById("salesPie");
  let pieChart = null;

  // ---- 円グラフ描画（Chart.jsファイル無し=CDNのwindow.Chart利用）----
  function renderPie(byProduct) {
    if (!pieCanvas) return;

    const ChartLib = window.Chart;
    if (!ChartLib) {
      console.warn("Chart.js が読み込まれていません（window.Chart が undefined）");
      return;
    }

    // タブが display:none の瞬間に描くと幅0で死ぬ → 次フレームに回す
    const rect = pieCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      requestAnimationFrame(() => renderPie(byProduct));
      return;
    }

    const labels = Array.from(byProduct.keys());
const values = Array.from(byProduct.values()).map(v => v.sales);

    // データなし：グラフを消す
    if (labels.length === 0) {
      if (pieChart) {
        pieChart.destroy();
        pieChart = null;
      }
      const ctx = pieCanvas.getContext("2d");
      ctx && ctx.clearRect(0, 0, pieCanvas.width, pieCanvas.height);
      return;
    }

    if (pieChart) {
      pieChart.data.labels = labels;
      pieChart.data.datasets[0].data = values;
      pieChart.update();
      return;
    }

    pieChart = new ChartLib(pieCanvas, {
      type: "pie",
      data: {
        labels,
        datasets: [{ data: values }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // ←親(#PIE)の高さで制御
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const name = ctx.label ?? "";
                const v = Number(ctx.parsed ?? 0);
                const total = values.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                return `${name}: ${v}円 (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  // 売上タブを開いた時にサイズ再計算（タブUI対策）
  const salesTab = document.getElementById("salesTab");
  if (salesTab) {
    new MutationObserver(() => {
      if (salesTab.classList.contains("active") && pieChart) {
        pieChart.resize();
        pieChart.update();
      }
    }).observe(salesTab, { attributes: true, attributeFilter: ["class"] });
  }
  // ---- 追加ここまで ----

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (modal) modal.style.display = "none";
      if (cancelBtn) cancelBtn.dataset.saleId = "";
    });
  }

  audit?.("SALE_LISTEN_START", { classId });

  onSnapshot(q, (snap) => {
    if (!container) return;
    container.innerHTML = "";

    const byProduct = new Map();

    if (snap.size === 0) {
      container.innerHTML = "<p>売上がまだありません。</p>";
      renderPie(byProduct);
      return;
    }

    snap.forEach((ds) => {
      const d = ds.data();
      const dId = ds.id;
      const status = d.status ?? "Active";
      const total = Number(d.total ?? 0);

      const dt = d.created_at?.toDate ? d.created_at.toDate() : null;
      const dtStr = dt ? dt.toLocaleString("ja-JP") : "";

      const card = document.createElement("div");
      card.className = "sales-card";
      card.style.border = "1px solid rgba(0,0,0,.1)";
      card.style.borderRadius = "12px";
      card.style.padding = "10px";
      card.style.marginBottom = "10px";
      card.style.cursor = "pointer";

      const badge = status === "Canceled"
        ? `<span style="color:#fff;background:#999;padding:2px 8px;border-radius:999px;font-size:12px;">取消</span>`
        : `<span style="color:#fff;background:#4caf50;padding:2px 8px;border-radius:999px;font-size:12px;">有効</span>`;
      //divタグにID付与。ボタンを押すと有効無効切り替えのファンクション呼び出し
      card.innerHTML = `
        <div id="salesBtn" style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div>
            <div style="font-weight:700;">合計：${total}円</div>
            <div style="font-size:12px;opacity:.75;">${dtStr}</div>
          </div>
          <div>${badge}</div>
        </div>
      `;

      card.addEventListener("click", () => switchBatch(d, dId));

      container.appendChild(card);

      if (status !== "Canceled") {
        const items = Array.isArray(d.items) ? d.items : [];
        for (const it of items) {
          const name = String(it.product_name ?? "不明");
          const qty = Number(it.quantity ?? 0);
          const subtotal = Number(it.subtotal ?? 0);
          if (!byProduct.has(name)) {
            byProduct.set(name, {
              qty: 0,
              sales: 0
            });
          }
          const row = byProduct.get(name);
          row.qty += qty;
          row.sales += subtotal;
        }
      }

    });
    renderSalesSummary(byProduct);
    renderPie(byProduct);
  });

  async function switchBatch(d, dId) {
    const newStatus = d.status === "Active" ? "Canceled" : "Active";
    try {
      await updateDoc(
        doc(db, "Classes", classId, "Sales", dId),
        {
          status: newStatus
        }
      );
      audit?.("SALES_UPDATE", {
        classId,
        salesId: dId,
        status: newStatus
      });
    } catch (e) {
      console.error("編集失敗", e);
      alert("編集に失敗しました（権限/通信）");
    }
  }

  function renderSalesSummary(byProduct) {
    const el = document.getElementById("salesSummary");
    console.log("render")
    if (!el) return;

    let totalSales = 0;

    let html = `
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <th>商品</th>
          <th>数量</th>
          <th>売上</th>
        </tr>
    `;

    byProduct.forEach((v, name) => {
      totalSales += v.sales;

      html += `
        <tr>
          <td>${name}</td>
          <td>${v.qty}</td>
          <td>${v.sales}円</td>
        </tr>
      `;
    });

    html += `
      </table>
      <hr>
      <h4>売上合計：<b>${totalSales}円</b></h4>
    `;

    el.innerHTML = html;
    console.log("表示")
  }


}

