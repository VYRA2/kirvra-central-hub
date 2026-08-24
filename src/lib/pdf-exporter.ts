import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ReportData, ReportFilters } from "@/services/report-service";
import type { CentralSession } from "@/services/auth-service";

export async function exportReportToPDF(
  data: ReportData,
  filters: ReportFilters,
  session: CentralSession | null
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const now = new Date();
  const dateStr = format(now, "yyyy-MM-dd");
  const timeStr = format(now, "HH:mm");
  
  // Cores KIRVRA (Midnight Indigo / Neon Mint)
  const colors = {
    primary: [10, 25, 27], // Midnight Indigo aproximado
    secondary: [20, 184, 166], // Neon Mint aproximado
    text: [30, 41, 59],
    muted: [100, 116, 139],
  };

  // 1. Cabeçalho
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, 210, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("KIRVRA", 15, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("CENTRAL DE VIGILÂNCIA", 15, 26);

  doc.setFontSize(14);
  doc.text("Relatório Operacional", 195, 20, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Gerado em: ${format(now, "dd/MM/yyyy")} às ${timeStr}`, 195, 26, { align: "right" });

  let y = 50;

  // 2. Informações do Relatório
  doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo do Período", 15, y);
  y += 8;

  const periodLabel = filters.period === "7d" ? "Últimos 7 dias" : 
                     filters.period === "30d" ? "Últimos 30 dias" :
                     filters.period === "90d" ? "Últimos 90 dias" : "Período personalizado";

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${periodLabel}`, 15, y);
  doc.text(`Operador: ${session?.employee.fullName || "Sistema"}`, 195, y, { align: "right" });
  y += 15;

  // 3. Indicadores (Cartões)
  autoTable(doc, {
    startY: y,
    head: [["Sessões", "Alertas Críticos", "Resposta Média", "Falsos Positivos"]],
    body: [[
      data.metrics.sessions.toString(),
      data.metrics.criticalAlerts.toString(),
      data.metrics.avgResponseTime,
      `${data.metrics.falsePositivesRate.toFixed(1)}%`
    ]],
    theme: "grid",
    headStyles: { 
      fillColor: colors.primary as [number, number, number],
      textColor: [255, 255, 255],
      fontSize: 10,
      halign: "center"
    },
    columnStyles: {
      0: { halign: "center", fontSize: 12, fontStyle: "bold" },
      1: { halign: "center", fontSize: 12, fontStyle: "bold" },
      2: { halign: "center", fontSize: 12, fontStyle: "bold" },
      3: { halign: "center", fontSize: 12, fontStyle: "bold" },
    },
    margin: { left: 15, right: 15 }
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // 4. Ameaças por Categoria
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Ameaças por Categoria", 15, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Categoria", "Quantidade", "Percentual"]],
    body: data.categories.map(c => [
      c.category,
      c.count.toString(),
      `${c.percentage.toFixed(1)}%`
    ]),
    theme: "striped",
    headStyles: { fillColor: [50, 50, 50] },
    margin: { left: 15, right: 15 }
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // 5. Qualidade da IA
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Qualidade da IA", 15, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Confirmações humanas: ${data.quality.humanConfirmationsRate.toFixed(1)}%`, 15, y);
  doc.text(`Total de análises revisadas: ${data.quality.totalReviewed}`, 15, y + 5);
  
  y += 20;

  // 6. Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    doc.text(
      `Página ${i} de ${pageCount} — KIRVRA Central Relatório Operacional — Confidencial`,
      105,
      285,
      { align: "center" }
    );
  }

  doc.save(`kirvra-relatorio-operacional-${dateStr}.pdf`);
}
