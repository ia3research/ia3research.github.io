(() => {
  const REAL_COLOR = "#22c55e"; // green
  const ESTIMADO_COLOR = "#2563eb"; // blue

  const CSV_URL = "/demos/confia/series.csv";

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

  const loadSeries = async () => {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    return parseCsv(await res.text());
  };

  const getColorForType = (type) => (type === "real" ? REAL_COLOR : ESTIMADO_COLOR);

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
            tension: 0,
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
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 8,
              callback: (value, index) => {
                const label = labels[index];
                // Show DD/MM
                const [y, m, d] = String(label).split("-");
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

    if (!btn || !wrap || !canvas) return;

    btn.addEventListener("click", async () => {
      setBusy(btn, statusEl, true);
      wrap.style.display = "none";

      // Simulate computation time
      await new Promise((r) => setTimeout(r, 2000));

      try {
        const series = await loadSeries();
        buildChart(canvas, series);
        wrap.style.display = "block";
      } catch (e) {
        console.error(e);
        if (statusEl) statusEl.textContent = "Could not load the series.";
      } finally {
        setBusy(btn, statusEl, false);
      }
    });
  });
})();
