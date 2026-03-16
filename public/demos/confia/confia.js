(() => {
  const REAL_COLOR = "#22c55e"; // green
  const ESTIMADO_COLOR = "#2563eb"; // blue

  const CSV_URL = "/demos/confia/series.csv";
  const KPI_CSV_URL = "/demos/confia/kpis.csv";

  const parseCsv = (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length <= 1) return [];

    const header = lines[0].split(",").map((h) => h.trim());
    const idxDate = header.indexOf("date");
    const idxValue = header.indexOf("value");
    const idxType = header.indexOf("type");

    return lines.slice(1).map((line) => {
      const cols = line.split(",");
      const date = (cols[idxDate] ?? "").trim();
      const rawValue = (cols[idxValue] ?? "").trim();
      const type = (cols[idxType] ?? "").trim();
      const value = Number(rawValue.replace(",", "."));
      return { date, value, type };
    }).filter((row) => row.date && Number.isFinite(row.value) && (row.type === "real" || row.type === "estimado"));
  };

  const formatDateEs = (yyyyMmDd) => {
    const [y, m, d] = yyyyMmDd.split("-");
    if (!y || !m || !d) return yyyyMmDd;
    return `${d}/${m}/${y}`;
  };

  const formatEur = (value) => {
    if (!Number.isFinite(value)) return "---";
    // Keep it simple: number + € (matches the request for the € symbol)
    const formatted = new Intl.NumberFormat("en-GB", {
      maximumFractionDigits: 0,
    }).format(value);
    return `${formatted} €`;
  };

  const formatPct = (value) => {
    if (!Number.isFinite(value)) return "---";
    const formatted = new Intl.NumberFormat("en-GB", {
      maximumFractionDigits: 1,
    }).format(value);
    return `${formatted} %`;
  };

  const loadSeries = async () => {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    return parseCsv(await res.text());
  };

  const parseKpiCsv = (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length <= 1) return [];
    const header = lines[0].split(",").map((h) => h.trim());
    const idx = (name) => header.indexOf(name);
    const toNum = (raw) => {
      const s = String(raw ?? "").trim();
      if (!s) return null;
      const n = Number(s.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };

    return lines.slice(1).map((line) => {
      const cols = line.split(",");
      const date = String(cols[idx("date")] ?? "").trim();
      if (!date) return null;
      return {
        date,
        creditUsage_real: toNum(cols[idx("creditUsage_real")]),
        creditUsage_est: toNum(cols[idx("creditUsage_est")]),
        financingCost_real: toNum(cols[idx("financingCost_real")]),
        financingCost_est: toNum(cols[idx("financingCost_est")]),
        collectionPeriod_real: toNum(cols[idx("collectionPeriod_real")]),
        collectionPeriod_est: toNum(cols[idx("collectionPeriod_est")]),
        paymentPeriod_real: toNum(cols[idx("paymentPeriod_real")]),
        paymentPeriod_est: toNum(cols[idx("paymentPeriod_est")]),
      };
    }).filter(Boolean);
  };

  const loadKpis = async () => {
    const res = await fetch(KPI_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`KPI CSV fetch failed: ${res.status}`);
    return parseKpiCsv(await res.text());
  };

  const getColorForType = (type) => (type === "real" ? REAL_COLOR : ESTIMADO_COLOR);

  const ensureBasePointSettings = (dataset) => {
    if (!dataset || typeof dataset !== "object") return;
    if (!Object.hasOwn(dataset, "__confiaBasePointRadius")) {
      dataset.__confiaBasePointRadius = dataset.pointRadius;
    }
    if (!Object.hasOwn(dataset, "__confiaBasePointHoverRadius")) {
      dataset.__confiaBasePointHoverRadius = dataset.pointHoverRadius;
    }
  };

  const setReferencePoints = (chart, enabled) => {
    if (!chart?.data?.datasets) return;

    for (const ds of chart.data.datasets) {
      ensureBasePointSettings(ds);
      ds.pointRadius = enabled ? 2 : (ds.__confiaBasePointRadius ?? 0);
      ds.pointHoverRadius = enabled ? 5 : (ds.__confiaBasePointHoverRadius ?? 4);
      ds.pointHitRadius = enabled ? 14 : 10;
    }
  };

  const syncReferencePointsFromState = (chart) => {
    let isZoomedOrPanned = false;
    if (typeof chart?.isZoomedOrPanned === "function") {
      isZoomedOrPanned = chart.isZoomedOrPanned();
    } else if (typeof chart?.getZoomLevel === "function") {
      isZoomedOrPanned = chart.getZoomLevel() > 1.01;
    }

    setReferencePoints(chart, isZoomedOrPanned);
  };

  const wireDoubleClickResetZoom = (canvas, chart) => {
    if (!canvas || !chart) return;
    if (canvas.__confiaDblClickWired) return;
    canvas.__confiaDblClickWired = true;

    canvas.addEventListener("dblclick", () => {
      if (typeof chart.resetZoom === "function") {
        chart.resetZoom("none");
        setReferencePoints(chart, false);
        chart.update("none");
      }
    });
  };

  const buildKpiSeries = (rows, keyReal, keyEst) => {
    const labels = rows.map((r) => r.date);

    let lastRealIdx = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
      const v = rows[i]?.[keyReal];
      if (v !== null && v !== undefined && Number.isFinite(v)) {
        lastRealIdx = i;
        break;
      }
    }

    const real = rows.map((r, i) => (i <= lastRealIdx ? r?.[keyReal] ?? null : null));
    const est = rows.map((r, i) => (i > lastRealIdx ? r?.[keyEst] ?? null : null));
    if (lastRealIdx >= 0 && lastRealIdx < rows.length) {
      est[lastRealIdx] = real[lastRealIdx];
    }

    return { labels, real, est };
  };

  const buildKpiChart = (canvas, labels, realData, estData) => {
    if (canvas.__confiaChart) {
      canvas.__confiaChart.destroy();
      canvas.__confiaChart = null;
    }

    const chart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Actual",
            data: realData,
            borderColor: REAL_COLOR,
            backgroundColor: "rgba(34, 197, 94, 0.08)",
            tension: 0.35,
            spanGaps: false,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 10,
          },
          {
            label: "Estimated",
            data: estData,
            borderColor: ESTIMADO_COLOR,
            backgroundColor: "rgba(37, 99, 235, 0.08)",
            tension: 0.35,
            spanGaps: false,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHitRadius: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "nearest", intersect: false },
        plugins: {
          legend: { display: false },
          zoom: {
            limits: {
              x: { min: 0, max: Math.max(0, labels.length - 1) },
            },
            pan: {
              enabled: true,
              mode: "x",
              modifierKey: "ctrl",
              onPan: ({ chart }) => {
                syncReferencePointsFromState(chart);
              },
              onPanComplete: ({ chart }) => {
                syncReferencePointsFromState(chart);
              },
            },
            zoom: {
              mode: "x",
              wheel: { enabled: true },
              pinch: { enabled: true },
              drag: { enabled: true, modifierKey: "shift" },
              onZoom: ({ chart }) => {
                syncReferencePointsFromState(chart);
              },
              onZoomComplete: ({ chart }) => {
                syncReferencePointsFromState(chart);
              },
            },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const first = items?.[0];
                const label = first?.label ?? "";
                return formatDateEs(label);
              },
              label: (ctx) => {
                if (ctx.parsed?.y === null || ctx.parsed?.y === undefined) return null;
                const label = ctx.dataset?.label ?? "";
                return `${label}: ${formatPct(ctx.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: { display: false },
          y: {
            ticks: {
              callback: (v) => formatPct(Number(v)),
              maxTicksLimit: 4,
            },
          },
        },
      },
    });

    canvas.__confiaChart = chart;

    // Keep clean by default; show reference points once zoomed/panned.
    setReferencePoints(chart, false);
    wireDoubleClickResetZoom(canvas, chart);
  };

  const buildChart = (canvas, series) => {
    const labels = series.map((p) => p.date);
    const data = series.map((p) => ({ x: p.date, y: p.value, type: p.type }));

    // Destroy any previous chart attached to canvas
    if (canvas.__confiaChart) {
      canvas.__confiaChart.destroy();
      canvas.__confiaChart = null;
    }

    const chart = new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Serie",
            data,
            parsing: false,
            borderWidth: 2,
            tension: 0.35,
            // Hide points until hover
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHitRadius: 12,
            fill: false,
            segment: {
              borderColor: (ctx) => {
                const p0 = ctx.p0?.raw;
                const p1 = ctx.p1?.raw;
                const t0 = p0?.type;
                const t1 = p1?.type;
                // If both ends are real -> green; otherwise blue
                if (t0 === "real" && t1 === "real") return REAL_COLOR;
                return ESTIMADO_COLOR;
              },
            },
            pointBackgroundColor: (ctx) => {
              const raw = ctx.raw;
              return getColorForType(raw?.type);
            },
            pointBorderColor: (ctx) => {
              const raw = ctx.raw;
              return getColorForType(raw?.type);
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "nearest" },
        plugins: {
          legend: { display: false },
          zoom: {
            limits: {
              x: { min: 0, max: Math.max(0, labels.length - 1) },
            },
            pan: {
              enabled: true,
              mode: "x",
              modifierKey: "ctrl",
              onPan: ({ chart }) => {
                syncReferencePointsFromState(chart);
              },
              onPanComplete: ({ chart }) => {
                syncReferencePointsFromState(chart);
              },
            },
            zoom: {
              mode: "x",
              wheel: { enabled: true },
              pinch: { enabled: true },
              drag: { enabled: true, modifierKey: "shift" },
              onZoom: ({ chart }) => {
                syncReferencePointsFromState(chart);
              },
              onZoomComplete: ({ chart }) => {
                syncReferencePointsFromState(chart);
              },
            },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const first = items?.[0];
                const label = first?.label ?? "";
                return formatDateEs(label);
              },
              label: (ctx) => {
                const val = ctx.parsed?.y;
                const raw = ctx.raw;
                const kind = raw?.type === "real" ? "Actual" : "Estimated";
                if (!Number.isFinite(val)) return `${kind}: ---`;
                return `${kind}: ${formatEur(val)}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "category",
            title: {
              display: true,
              text: "2025",
            },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              callback: (value, index) => {
                const label = typeof value === "string" ? value : labels[value] ?? labels[index];
                // Show DD/MM
                const [, m, d] = String(label).split("-");
                if (!d || !m) return label;
                return `${d}/${m}`;
              },
            },
            grid: { display: false },
          },
          y: {
            ticks: {
              callback: (v) => formatEur(Number(v)),
            },
          },
        },
      },
    });

    canvas.__confiaChart = chart;

    // Keep clean by default; show reference points once zoomed/panned.
    setReferencePoints(chart, false);
    wireDoubleClickResetZoom(canvas, chart);
  };

  const setBusy = (btn, statusEl, busy) => {
    if (!btn) return;
    btn.disabled = busy;
    btn.textContent = busy ? "Calculating…" : "Calculate";
    if (statusEl) statusEl.textContent = "";
  };

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("confiaCalcular");
    const statusEl = document.getElementById("confiaEstado");
    const wrap = document.getElementById("confiaChartWrap");
    const canvas = document.getElementById("confiaChart");
    const kpiWrap = document.getElementById("confiaKpiWrap");
    const legend = document.getElementById("confiaLegend");

    if (!btn || !wrap || !canvas) return;

    btn.addEventListener("click", async () => {
      setBusy(btn, statusEl, true);
      wrap.style.display = "none";
      if (kpiWrap) kpiWrap.style.display = "none";
      if (legend) legend.style.display = "none";

      // Simulate computation time
      await new Promise((r) => setTimeout(r, 2000));

      try {
        const series = await loadSeries();
        buildChart(canvas, series);
        wrap.style.display = "block";

        const kpiRows = await loadKpis();
        const mappings = [
          {
            canvasId: "kpiCreditUsageChart",
            keyReal: "creditUsage_real",
            keyEst: "creditUsage_est",
          },
          {
            canvasId: "kpiFinancingCostChart",
            keyReal: "financingCost_real",
            keyEst: "financingCost_est",
          },
          {
            canvasId: "kpiCollectionPeriodChart",
            keyReal: "collectionPeriod_real",
            keyEst: "collectionPeriod_est",
          },
          {
            canvasId: "kpiPaymentPeriodChart",
            keyReal: "paymentPeriod_real",
            keyEst: "paymentPeriod_est",
          },
        ];

        for (const m of mappings) {
          const kpiCanvas = document.getElementById(m.canvasId);
          if (kpiCanvas) {
            const { labels, real, est } = buildKpiSeries(kpiRows, m.keyReal, m.keyEst);
            buildKpiChart(kpiCanvas, labels, real, est);
          }
        }

        if (kpiWrap) kpiWrap.style.display = "block";
        if (legend) legend.style.display = "flex";
      } catch (e) {
        console.error(e);
        if (statusEl) statusEl.textContent = "Could not load the series.";
      } finally {
        setBusy(btn, statusEl, false);
      }
    });
  });
})();
