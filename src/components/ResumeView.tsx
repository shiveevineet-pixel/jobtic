import { confirmAction } from '../services/confirmAction';
import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, Star, Zap, TrendingUp, Target, Award, ChevronDown,
  ChevronUp, Loader2, AlertCircle, RefreshCw, X, Sparkles, Download, CheckCircle2, Lightbulb
} from 'lucide-react';
import { resumeService, ResumeRating, EnhancedResume, ResumePages } from '../services/resumeService';
import { useSettings } from '../context/SettingsContext';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { nativeDocumentService } from '../services/nativeDocumentService';
import ResumeTemplate from './ResumeTemplate';

type ViewTab = 'upload' | 'rating' | 'enhanced';

// ── Circular Score Widget ──────────────────────────────────────────────────────
const CircularScore: React.FC<{ score: number; size?: number; strokeWidth?: number }> = ({
  score, size = 100, strokeWidth = 8
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="var(--border-dim)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="score-ring"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: size > 90 ? '1.5rem' : '1rem', fontWeight: 800, color, fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
          {score}
        </span>
        {size > 90 && <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: 2 }}>/ 100</span>}
      </div>
    </div>
  );
};
/**
 * Pure jsPDF resume builder — no html2canvas, no DOM rendering.
 * Works reliably on Android WebViews.
 */
const buildResumePdf = async (data: EnhancedResume['data']): Promise<Blob> => {
  // Keep the sizeable PDF library out of the initial Android WebView bundle.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = 210;
  const pageH = 297;
  const marginX = 18;
  const contentW = pageW - marginX * 2;
  let y = 20;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageH - 15) {
      doc.addPage();
      y = 20;
    }
  };

  const drawHRule = () => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, pageW - marginX, y);
    y += 4;
  };

  const addSection = (title: string) => {
    checkPageBreak(12);
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title.toUpperCase(), marginX, y);
    y += 2;
    drawHRule();
  };

  const addWrappedText = (text: string, fontSize: number, style: 'normal' | 'bold' | 'italic', indent = 0) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentW - indent);
    lines.forEach((line: string) => {
      checkPageBreak(fontSize * 0.4);
      doc.text(line, marginX + indent, y);
      y += fontSize * 0.38;
    });
    y += 1;
  };

  // ── Header ────────────────────────────────────────────────────────────────
  const name = data.personalInfo?.name || 'Resume';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(name.toUpperCase(), pageW / 2, y, { align: 'center' });
  y += 8;

  const contactParts: string[] = [];
  if (data.personalInfo?.location) contactParts.push(data.personalInfo.location);
  if (data.personalInfo?.phone) contactParts.push(data.personalInfo.phone);
  if (data.personalInfo?.email) contactParts.push(data.personalInfo.email);
  if (data.personalInfo?.linkedin) contactParts.push(data.personalInfo.linkedin);

  if (contactParts.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(contactParts.join('  •  '), pageW / 2, y, { align: 'center' });
    y += 5;
  }
  drawHRule();

  // ── Summary ───────────────────────────────────────────────────────────────
  if (data.summary) {
    addWrappedText(data.summary, 10, 'normal');
    y += 2;
  }

  // ── Experience ────────────────────────────────────────────────────────────
  if (data.experience?.length > 0) {
    addSection('Professional Experience');
    data.experience.forEach((exp) => {
      checkPageBreak(20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(exp.title || '', marginX, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (exp.date) doc.text(exp.date, pageW - marginX, y, { align: 'right' });
      y += 4.5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9.5);
      doc.text(exp.company || '', marginX, y);
      if (exp.location) {
        doc.setFont('helvetica', 'normal');
        doc.text(exp.location, pageW - marginX, y, { align: 'right' });
      }
      y += 5;
      (exp.bullets || []).forEach((bullet: string) => {
        const lines = doc.splitTextToSize(`• ${bullet}`, contentW - 4);
        lines.forEach((line: string) => {
          checkPageBreak(4);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.text(line, marginX + 2, y);
          y += 4;
        });
      });
      y += 3;
    });
  }

  // ── Projects ──────────────────────────────────────────────────────────────
  if (data.projects?.length > 0) {
    addSection('Projects');
    data.projects.forEach((proj) => {
      checkPageBreak(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const projTitle = proj.technologies ? `${proj.name}  |  ${proj.technologies}` : proj.name;
      doc.text(projTitle || '', marginX, y);
      if (proj.date) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(proj.date, pageW - marginX, y, { align: 'right' });
      }
      y += 5;
      if (proj.description) addWrappedText(proj.description, 9.5, 'normal');
      y += 2;
    });
  }

  // ── Education ─────────────────────────────────────────────────────────────
  if (data.education?.length > 0) {
    addSection('Education');
    data.education.forEach((edu) => {
      checkPageBreak(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.text(edu.school || '', marginX, y);
      if (edu.date) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(edu.date, pageW - marginX, y, { align: 'right' });
      }
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(edu.degree || '', marginX, y);
      if (edu.location) doc.text(edu.location, pageW - marginX, y, { align: 'right' });
      y += 6;
    });
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  if (data.skills?.length > 0) {
    addSection('Skills');
    data.skills.forEach((skill) => {
      checkPageBreak(6);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      const label = `${skill.category}: `;
      const labelW = doc.getTextWidth(label);
      doc.text(label, marginX, y);
      doc.setFont('helvetica', 'normal');
      const items = (skill.items || []).join(', ');
      const lines = doc.splitTextToSize(items, contentW - labelW);
      doc.text(lines[0] || '', marginX + labelW, y);
      y += 4.5;
      if (lines.length > 1) {
        lines.slice(1).forEach((line: string) => {
          checkPageBreak(4);
          doc.setFont('helvetica', 'normal');
          doc.text(line, marginX + labelW, y);
          y += 4.5;
        });
      }
    });
  }

  if (data.certifications?.length > 0) {
    addSection('Certifications');
    data.certifications.forEach(cert => {
      checkPageBreak(6);
      const details = [cert.name, cert.issuer].filter(Boolean).join(' — ');
      addWrappedText(`${details}${cert.date ? ` (${cert.date})` : ''}`, 9.5, cert.name ? 'normal' : 'italic');
    });
  }

  if (data.awards?.length > 0) {
    addSection('Awards & Achievements');
    data.awards.forEach(item => addWrappedText(`• ${item}`, 9.5, 'normal', 2));
  }

  if (data.languages?.length > 0) {
    addSection('Languages');
    addWrappedText(data.languages.join('  •  '), 9.5, 'normal');
  }

  data.additionalSections?.forEach(section => {
    if (!section.title || section.items.length === 0) return;
    addSection(section.title);
    section.items.forEach(item => addWrappedText(`• ${item}`, 9.5, 'normal', 2));
  });

  return doc.output('blob');
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ResumeView: React.FC<{ onUseForInterview?: (text: string) => void }> = ({ onUseForInterview }) => {
  const { settings } = useSettings();

  // View state
  const [activeTab, setActiveTab] = useState<ViewTab>('upload');

  // File / text state
  const [pages, setPages] = useState<ResumePages | null>(null);   // images + text from PDF
  const [manualText, setManualText] = useState('');                // pasted text
  const [fileName, setFileName] = useState('');
  const [targetRole, setTargetRole] = useState('');

  // AI results
  const [rating, setRating] = useState<(ResumeRating & { usedVision: boolean }) | null>(null);
  const [enhanced, setEnhanced] = useState<EnhancedResume | null>(null);

  // Loading / UI flags
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [error, setError] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    strengths: true, improvements: true, keywords: false, changes: true,
  });

  const fileRef = useRef<HTMLInputElement>(null);

  // API keys from settings (Google Gemini / NVIDIA / Groq)
  const nvidiaKey = settings.nvidiaApiKey || import.meta.env.VITE_NVIDIA_API_KEY || '';
  const groqKey = settings.groqApiKey || '';
  const geminiKey = settings.geminiApiKey || '';

  // The "resume content" used for analysis — prefer uploaded file, fallback to pasted text
  const hasContent = !!pages || manualText.trim().length > 80;
  const textForEnhancement = pages?.text || manualText;

  const toggleSection = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── File Handling ──────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setError('');
    setIsExtracting(true);
    try {
      const result = await resumeService.processFile(file);
      setPages(result);
      setFileName(file.name);
      setRating(null);
      setEnhanced(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to read file';
      setError(msg);
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── AI Analysis ────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    setError('');
    setIsAnalyzing(true);
    try {
      const analyzePages: ResumePages = pages || { images: [], text: manualText };
      const result = await resumeService.analyzeResume(
        analyzePages,
        targetRole || '',
        nvidiaKey || undefined,
        groqKey || undefined,
        geminiKey || undefined
      );
      setRating(result);
      setEnhanced(null);
      setActiveTab('rating');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      setError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEnhance = async () => {
    setError('');
    setIsEnhancing(true);
    try {
      const improvements = rating?.improvements || [];
      const result = await resumeService.enhanceResume(
        textForEnhancement,
        targetRole || '',
        improvements,
        groqKey || undefined,
        geminiKey || undefined
      );
      setEnhanced(result);
      setActiveTab('enhanced');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Enhancement failed';
      setError(msg);
    } finally {
      setIsEnhancing(false);
    }
  };

  // ── Download / Share / Print ───────────────────────────────────────────────
  const enhancedToPlainText = (data: EnhancedResume['data']): string => {
    const lines: string[] = [];
    if (data.personalInfo?.name) lines.push(data.personalInfo.name.toUpperCase());
    const contactParts: string[] = [];
    if (data.personalInfo?.email) contactParts.push(data.personalInfo.email);
    if (data.personalInfo?.phone) contactParts.push(data.personalInfo.phone);
    if (data.personalInfo?.location) contactParts.push(data.personalInfo.location);
    if (data.personalInfo?.linkedin) contactParts.push(data.personalInfo.linkedin);
    if (contactParts.length) lines.push(contactParts.join(' | '));
    if (data.summary) { lines.push('', 'PROFESSIONAL SUMMARY', data.summary); }
    if (data.experience?.length) {
      lines.push('', 'EXPERIENCE');
      data.experience.forEach(exp => {
        lines.push(`${exp.title} — ${exp.company}${exp.date ? ` | ${exp.date}` : ''}${exp.location ? ` | ${exp.location}` : ''}`);
        exp.bullets?.forEach(b => lines.push(`  • ${b}`));
      });
    }
    if (data.projects?.length) {
      lines.push('', 'PROJECTS');
      data.projects.forEach(project => {
        lines.push(`${project.name}${project.technologies ? ` — ${project.technologies}` : ''}${project.date ? ` | ${project.date}` : ''}`);
        if (project.description) lines.push(`  • ${project.description}`);
      });
    }
    if (data.education?.length) {
      lines.push('', 'EDUCATION');
      data.education.forEach(edu => {
        lines.push(`${edu.degree} — ${edu.school}${edu.date ? ` | ${edu.date}` : ''}${edu.location ? ` | ${edu.location}` : ''}`);
      });
    }
    if (data.certifications?.length) {
      lines.push('', 'CERTIFICATIONS');
      data.certifications.forEach(cert => {
        lines.push(`${cert.name}${cert.issuer ? ` — ${cert.issuer}` : ''}${cert.date ? ` | ${cert.date}` : ''}`);
      });
    }
    if (data.skills?.length) {
      lines.push('', 'SKILLS');
      data.skills.forEach(s => lines.push(`${s.category}: ${s.items.join(', ')}`));
    }
    if (data.awards?.length) {
      lines.push('', 'AWARDS & ACHIEVEMENTS');
      data.awards.forEach(item => lines.push(`  • ${item}`));
    }
    if (data.languages?.length) {
      lines.push('', 'LANGUAGES', data.languages.join(' | '));
    }
    data.additionalSections?.forEach(section => {
      if (!section.title || section.items.length === 0) return;
      lines.push('', section.title.toUpperCase());
      section.items.forEach(item => lines.push(`  • ${item}`));
    });
    return lines.join('\n');
  };

  const handleShareResume = async () => {
    if (!enhanced) return;
    try {
      const text = enhancedToPlainText(enhanced.data);
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'Enhanced Resume', text, dialogTitle: 'Share Resume' });
      } else {
        await navigator.clipboard.writeText(text);
        setDownloadSuccess('Resume text copied to clipboard!');
      }
    } catch (err) {
      console.error('Share failed:', err);
      setError('Could not share your resume. Your improved version is still here; try downloading the PDF instead.');
    }
  };

  const handlePrintResume = async () => {
    if (!enhanced) return;
    try {
      const pdfBlob = await buildResumePdf(enhanced.data);
      const url = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      } else {
        setError('The print window could not open. Allow pop-ups or download the PDF instead. Your resume is unchanged.');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error('Print failed:', err);
      setError('Could not prepare your resume for printing. Your improved version is still here; please try again.');
    }
  };

  const handleDownloadPdf = () => {
    if (!enhanced) return;
    setIsGeneratingPdf(true);
    setDownloadSuccess('');
    setError('');

    const safeFilename = `${(enhanced.data.personalInfo?.name || 'Candidate').replace(/[^a-zA-Z0-9._-]/g, '_')}_Resume.pdf`;

    setTimeout(async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const result = await nativeDocumentService.saveTextPdf({
            filename: safeFilename,
            // A resume must start with the candidate's name, never app branding.
            title: '',
            content: enhancedToPlainText(enhanced.data)
          });
          setDownloadSuccess(`Resume saved to ${result.location}`);
          return;
        }

        // Desktop browser
        const pdfBlob = await buildResumePdf(enhanced.data);
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setDownloadSuccess(`Resume downloaded: ${safeFilename}`);
      } catch (err: unknown) {
        console.error('Resume PDF export failed:', err);
        setError('Could not save the PDF. Your improved resume is still here. Check your connection or available storage, then try again.');
      } finally {
        setIsGeneratingPdf(false);
      }
    }, 100);
  };

  const handleReset = async () => {
    if (!await confirmAction('Start over? This clears your current resume draft and analysis. Download your improved version first if you want to keep it.')) return;
    setActiveTab('upload');
    setPages(null);
    setManualText('');
    setFileName('');
    setTargetRole('');
    setRating(null);
    setEnhanced(null);
    setError('');
    setDownloadSuccess('');
  };

  const scoreColor = (s: number) => s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--danger)';
  const scoreBg = (s: number) => s >= 80 ? 'var(--success-glow)' : s >= 60 ? 'var(--warning-glow)' : 'var(--danger-glow)';

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="resume-view-container">
      <header className="resume-page-heading"><span className="eyebrow">Your experience, well told</span><h1>Resume workspace</h1><p>Review the original. Refine the story. Take a clean version with you.</p></header>

      {/* Tab bar */}
      <div className="resume-tabs">
        <button className={`resume-tab ${activeTab === 'upload' ? 'active' : ''}`} aria-pressed={activeTab === 'upload'} disabled={isAnalyzing || isExtracting || isEnhancing} onClick={() => setActiveTab('upload')}>
          <Upload size={16} /> Original
        </button>
        <button className={`resume-tab ${activeTab === 'rating' ? 'active' : ''}`}
          aria-pressed={activeTab === 'rating'} onClick={() => rating && setActiveTab('rating')} disabled={!rating || isAnalyzing || isExtracting || isEnhancing}>
          <Star size={16} /> Analysis
          {rating && <span className="tab-score-badge" style={{ background: scoreBg(rating.overallScore), color: scoreColor(rating.overallScore) }}>{rating.overallScore}</span>}
        </button>
        <button className={`resume-tab ${activeTab === 'enhanced' ? 'active' : ''}`}
          aria-pressed={activeTab === 'enhanced'} onClick={() => enhanced && setActiveTab('enhanced')} disabled={!enhanced || isAnalyzing || isExtracting || isEnhancing}>
          <Sparkles size={16} /> Improved
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="resume-error-banner" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button className="icon-btn" aria-label="Dismiss resume error" onClick={() => setError('')}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Success banner */}
      {downloadSuccess && (
        <div className="alert alert-success" role="status">
          <CheckCircle2 size={16} />
          <span style={{ flex: 1 }}>{downloadSuccess}</span>
          <button className="icon-btn" aria-label="Dismiss export message" onClick={() => setDownloadSuccess('')}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ══════════════ UPLOAD TAB ══════════════ */}
      {activeTab === 'upload' && (
        <div className="resume-upload-layout" aria-busy={isExtracting || isAnalyzing}>
          <div className="resume-upload-actions">
          {/* Drop zone */}
          <div
            className={`resume-drop-zone ${dragOver ? 'drag-over' : ''} ${pages ? 'has-file' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { if (isAnalyzing || isExtracting || isEnhancing) { e.preventDefault(); return; } handleDrop(e); }}
            onClick={() => !pages && !isExtracting && !isAnalyzing && !isEnhancing && fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" disabled={isAnalyzing || isExtracting || isEnhancing}
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />

            {isExtracting ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Loader2 size={28} className="spin-icon" style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Processing resume…
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  Rendering pages for vision analysis
                </span>
              </div>
            ) : pages ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div className="file-success-icon">
                  <FileText size={22} style={{ color: 'var(--success)' }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--success)' }}>
                  {fileName}
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className="file-meta-chip text-chip">
                    <FileText size={11} /> Ready for analysis
                  </span>
                </div>
                <button className="resume-clear-btn"
                  disabled={isAnalyzing}
                  onClick={e => { e.stopPropagation(); setPages(null); setFileName(''); setRating(null); setEnhanced(null); }}>
                  <X size={12} /> Remove
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div className="drop-zone-icon"><Upload size={24} /></div>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Drop your resume here</span>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>PDF, TXT, DOC, DOCX · Max 10 MB</span>
                <button className="btn-outline-sm"
                  disabled={isAnalyzing || isExtracting}
                  onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                  Browse Files
                </button>
              </div>
            )}
          </div>

          {/* Tip */}
          <div className="resume-pdf-tip">
            <Lightbulb size={14} />
            <span>For best results, upload a <strong>PDF</strong> of your resume. You can also paste your resume text directly below.</span>
          </div>

          </div>
          <div className="resume-upload-actions">
          {/* Paste fallback */}
          <div className="resume-or-divider"><span>or paste resume text</span></div>

          <div className="form-group">
            <label htmlFor="resume-text">Original resume text</label>
            <textarea id="resume-text" className="resume-textarea"
              disabled={isAnalyzing || isExtracting || isEnhancing}
              value={manualText}
              onChange={e => { setManualText(e.target.value); if (pages) { setPages(null); setFileName(''); } setRating(null); setEnhanced(null); }}
              placeholder="Paste your full resume text here…"
              rows={7}
            />
            <p className="caption">Include at least 80 characters so there’s enough context for a useful review.</p>
          </div>

          {/* Target role */}
          <div className="form-group">
            <label htmlFor="resume-target">Target role <span className="caption">(Optional)</span></label>
            <input id="resume-target" type="text" value={targetRole} disabled={isAnalyzing || isExtracting || isEnhancing} onChange={e => { setTargetRole(e.target.value); setRating(null); setEnhanced(null); }}
              placeholder="e.g. Senior Frontend Engineer, Product Manager…" />
          </div>

          {/* Analyze button */}
          <button className="btn-primary resume-analyze-btn"
            onClick={handleAnalyze} disabled={isAnalyzing || isExtracting || !hasContent}>
            {isExtracting ? (
              <><Loader2 size={16} className="spin-icon" /> Reading file…</>
            ) : isAnalyzing ? (
              <><Loader2 size={16} className="spin-icon" /> Analyzing resume…</>
            ) : (
              <><TrendingUp size={16} /> Analyze My Resume</>
            )}
          </button>

          {/* Use for interview */}
          {hasContent && onUseForInterview && (
            <button className="resume-use-for-interview-btn"
              disabled={!textForEnhancement.trim() || isAnalyzing || isExtracting}
              onClick={() => onUseForInterview(textForEnhancement)}>
              <Target size={14} /> Practice with this resume
            </button>
          )}
          </div>
        </div>
      )}

      {/* ══════════════ RATING TAB ══════════════ */}
      {activeTab === 'rating' && rating && (
        <div className="resume-workspace">
        <aside className="document-panel"><span className="eyebrow">Original · {fileName || 'Pasted text'}</span><div className="document-paper">{pages?.images.length ? pages.images.map((image, index) => <img key={index} src={'data:image/jpeg;base64,' + image} alt={'Original resume page ' + (index + 1)} loading="lazy" />) : textForEnhancement}</div></aside>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p className="caption">AI review of your original resume. Scores are guidance, not a hiring outcome or an ATS guarantee.</p>
          {/* Overall score hero */}
          <div className="rating-hero glass-glow">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <CircularScore score={rating.overallScore} size={110} strokeWidth={10} />
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600 }}>OVERALL</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                {rating.summary}
              </p>
              {targetRole && (
                <div className="target-role-chip">
                  <Target size={10} /> {targetRole}
                </div>
              )}
            </div>
          </div>

          {/* Sub-score grid */}
          <div className="sub-scores-grid">
            {[
              { label: 'ATS', score: rating.atsScore },
              { label: 'Content', score: rating.contentScore },
              { label: 'Format', score: rating.formattingScore },
              { label: 'Impact', score: rating.impactScore },
            ].map(({ label, score }) => (
              <div key={label} className="sub-score-card glass">
                <CircularScore score={score} size={62} strokeWidth={6} />
                <span className="sub-score-label">{label}</span>
              </div>
            ))}
          </div>

          {/* Strengths */}
          <div className="rating-section glass">
            <button className="rating-section-header" aria-expanded={expandedSections.strengths} onClick={() => toggleSection('strengths')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={14} style={{ color: 'var(--success)' }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Strengths</span>
                <span className="count-badge success-badge">{rating.strengths.length}</span>
              </div>
              {expandedSections.strengths ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
            </button>
            {expandedSections.strengths && (
              <div className="rating-section-body">
                {rating.strengths.map((s, i) => (
                  <div key={i} className="rating-list-item success-item">
                    <div className="item-dot success-dot" />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Improvements */}
          <div className="rating-section glass">
            <button className="rating-section-header" aria-expanded={expandedSections.improvements} onClick={() => toggleSection('improvements')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--warning-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={14} style={{ color: 'var(--warning)' }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Improvements</span>
                <span className="count-badge warning-badge">{rating.improvements.length}</span>
              </div>
              {expandedSections.improvements ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
            </button>
            {expandedSections.improvements && (
              <div className="rating-section-body">
                {rating.improvements.map((imp, i) => (
                  <div key={i} className="rating-list-item warning-item">
                    <div className="item-dot warning-dot" />
                    <span>{imp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Missing Keywords */}
          <div className="rating-section glass">
            <button className="rating-section-header" aria-expanded={expandedSections.keywords} onClick={() => toggleSection('keywords')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--danger-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={14} style={{ color: 'var(--danger)' }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Missing Keywords</span>
                <span className="count-badge danger-badge">{rating.missingKeywords.length}</span>
              </div>
              {expandedSections.keywords ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
            </button>
            {expandedSections.keywords && (
              <div className="rating-section-body">
                <div className="keyword-chips">
                  {rating.missingKeywords.map((kw, i) => (
                    <span key={i} className="keyword-chip">{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn-primary resume-analyze-btn" onClick={handleEnhance} disabled={isEnhancing}>
              {isEnhancing
                ? <><Loader2 size={16} className="spin-icon" /> Enhancing Resume…</>
                : <><Sparkles size={16} /> Create improved version</>}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn-outline-sm" onClick={() => setActiveTab('upload')} style={{ justifyContent: 'center' }}>
                <RefreshCw size={13} /> Re-analyze
              </button>
              {onUseForInterview && (
                <button className="btn-outline-sm" disabled={!textForEnhancement.trim()} onClick={() => onUseForInterview(textForEnhancement)} style={{ justifyContent: 'center' }}>
                  <Target size={13} /> Practice Interview
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ══════════════ ENHANCED TAB ══════════════ */}
      {activeTab === 'enhanced' && enhanced && (
        <div className="resume-workspace">
        <aside className="document-panel"><span className="eyebrow">Improved · Document preview</span><div className="improved-document"><ResumeTemplate data={enhanced.data} preview /></div><p className="caption">Review every detail for accuracy before sharing.</p></aside>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Changes */}
          <div className="rating-section glass">
            <button className="rating-section-header" aria-expanded={expandedSections.changes} onClick={() => toggleSection('changes')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>Changes Made</span>
                <span className="count-badge primary-badge">{enhanced.changesSummary.length}</span>
              </div>
              {expandedSections.changes ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
            </button>
            {expandedSections.changes && (
              <div className="rating-section-body">
                {enhanced.changesSummary.map((change, i) => (
                  <div key={i} className="rating-list-item primary-item">
                    <div className="item-dot primary-dot" />
                    <span>{change}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PDF Download CTA */}
          <div className="enhanced-resume-wrapper glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={28} style={{ color: 'var(--success)' }} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Your improved version</h3>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                A clean, text-based PDF of your improved resume. Verify names, dates, and claims before sending it.
              </p>
            </div>
            
            <button className="btn-primary" onClick={handleDownloadPdf} disabled={isGeneratingPdf} style={{ width: '100%', maxWidth: '280px', justifyContent: 'center', marginTop: '8px' }}>
              {isGeneratingPdf ? (
                <><Loader2 size={16} className="spin-icon" /> Generating PDF…</>
              ) : (
                <><Download size={16} /> Download improved PDF</>
              )}
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: '280px' }}>
              <button className="btn-secondary" onClick={handlePrintResume} style={{ justifyContent: 'center', fontSize: '14px', padding: '8px 12px' }}>
                Print / Save PDF
              </button>
              <button className="btn-secondary" onClick={handleShareResume} style={{ justifyContent: 'center', fontSize: '14px', padding: '8px 12px' }}>
                Share Text
              </button>
            </div>
          </div>
          {onUseForInterview && <button className="resume-use-for-interview-btn" onClick={() => onUseForInterview(enhancedToPlainText(enhanced.data))}><Target size={16} />Practice with improved resume</button>}
          <details className="context-details"><summary>Compare with original</summary><div className="document-paper">{textForEnhancement || 'Original text could not be extracted. Return to Analysis to see uploaded pages.'}</div></details>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button className="btn-outline-sm" onClick={() => setActiveTab('rating')} style={{ justifyContent: 'center' }}>
              <Star size={13} /> View analysis
            </button>
            <button className="btn-outline-sm" onClick={handleReset} style={{ justifyContent: 'center' }}>
              <RefreshCw size={13} /> Start Over
            </button>
          </div>
        </div>
        </div>
      )}
      
      {/* No hidden DOM template needed — PDF is built directly from data */}
    </div>
  );
};

export default ResumeView;
