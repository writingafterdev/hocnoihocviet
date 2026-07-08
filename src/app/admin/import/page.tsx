'use client';
import { useState, useRef } from 'react';
import { UploadCloud, FileType2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function AdminImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'importing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [importedTitle, setImportedTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.html') && !file.type.includes('html')) {
      setErrorMsg('Please upload a valid .html file.');
      setStatus('error');
      return;
    }

    try {
      setStatus('parsing');
      const text = await file.text();
      
      // Parse locally using DOMParser
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');

      // Extract Cover Image (og:image)
      let coverImage = '';
      const ogImg = doc.querySelector('meta[property="og:image"]');
      if (ogImg) coverImage = ogImg.getAttribute('content') || '';

      // Extract Canonical URL
      let url = '';
      const canonical = doc.querySelector('link[rel="canonical"]');
      if (canonical) {
        url = canonical.getAttribute('href') || '';
      } else {
        const ogUrl = doc.querySelector('meta[property="og:url"]');
        if (ogUrl) url = ogUrl.getAttribute('content') || '';
      }

      // --- CHART SANDBOXING ---
      // Extract all original CSS styles to inject into the iframe sandboxes
      const originalStyles = Array.from(doc.querySelectorAll('style')).map(s => s.outerHTML).join('\\n');
      
      const chartMap = new Map<string, string>();
      let chartIndex = 0;

      // Find potential charts (SVGs inside figures or svelte containers)
      const svgs = doc.querySelectorAll('svg');
      svgs.forEach(svg => {
        // Skip tiny icons
        const w = svg.getAttribute('width');
        if (w && parseInt(w) < 100) return;

        // Find the highest-level layout container for the chart so we don't break CSS grids.
        // We look for .container wrappers first, then fallback to figure or the nearest svelte class.
        let container: any = svg.closest('.container[class*="svelte-"]') || 
                             svg.closest('.layout-article-graphic') || 
                             svg.closest('figure') || 
                             svg.closest('[class*="svelte-"]');
                             
        if (!container) container = svg;

        if (container.dataset.sandboxed === 'true') return;
        container.dataset.sandboxed = 'true';

        // Calculate aspect ratio for responsive iframe height
        let ratio = '16/9';
        const viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
          const parts = viewBox.split(' ');
          if (parts.length === 4) {
            const width = parseFloat(parts[2]);
            const height = parseFloat(parts[3]);
            if (height > 0) ratio = `${width}/${height}`;
          }
        }

        const placeholderId = `CHART_SANDBOX_PLACEHOLDER_${chartIndex++}`;
        const placeholder = doc.createElement('p');
        placeholder.id = placeholderId;
        placeholder.textContent = placeholderId; // Add text so Readability doesn't strip it!
        
        // Build the iframe HTML
        const chartHTML = container.outerHTML;
        const srcDoc = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
              </style>
              ${originalStyles}
            </head>
            <body>
              ${chartHTML}
            </body>
          </html>
        `;

        const iframeHTML = `<iframe 
          srcdoc="${escapeHtml(srcDoc)}" 
          style="width: 100%; border: none; overflow: hidden; margin: 2rem 0; background: transparent;" 
          scrolling="no"
          sandbox="allow-scripts allow-same-origin"
          onload="this.style.height = this.contentWindow.document.documentElement.scrollHeight + 'px';"
        ></iframe>`;

        chartMap.set(placeholderId, iframeHTML);
        container.replaceWith(placeholder);
      });

      // Run Readability on the modified DOM
      const reader = new Readability(doc);
      const article = reader.parse();

      if (!article) {
        throw new Error('Readability failed to parse the article content.');
      }

      // Sanitize the HTML
      // We must explicitly allow the id attribute so our placeholders survive
      const cleanHTML = DOMPurify.sanitize(article.content || '', { ADD_ATTR: ['id'] });

      // Re-inject the sandboxed iframes
      let finalHTML = cleanHTML;
      chartMap.forEach((iframeHTML, placeholderId) => {
        // Regex to replace the placeholder <p> (and its text) with our iframe
        const regex = new RegExp(`<p[^>]*id="${placeholderId}"[^>]*>.*?${placeholderId}.*?</p>`, 'g');
        finalHTML = finalHTML.replace(regex, iframeHTML);
      });

      const payload = {
        title: article.title,
        author: article.byline,
        content: finalHTML,
        textContent: article.textContent,
        excerpt: article.excerpt,
        coverImage,
        url,
        siteName: article.siteName
      };

      setImportedTitle(article.title || 'Untitled');
      setStatus('importing');

      // Send to backend API
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import article');
      }

      setStatus('success');

    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'An error occurred during parsing.');
      setStatus('error');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-[800px] flex flex-col gap-8">
      <div>
        <h2 className="text-[32px] font-heading leading-none text-[#111]">HTML Importer</h2>
        <p className="text-[14px] font-serif text-[#111]/70 mt-4 leading-relaxed">
          Bypass paywalls and anti-copy scripts instantly. Save the webpage as an <b>.html</b> file in your browser, then drag and drop it here. We will parse it locally and extract the content, images, and author automatically.
        </p>
      </div>

      <div 
        className={`w-full h-[300px] border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer
          ${isDragging ? 'border-[#111] bg-[#111]/5' : 'border-black/10 hover:border-black/30 hover:bg-black/[0.02]'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          accept=".html,text/html" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileSelect}
        />
        
        <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center text-[#111]/50 mb-2">
          <UploadCloud className="w-8 h-8" />
        </div>
        <div className="text-center">
          <span className="text-[14px] font-sans font-bold text-[#111] block">Click to upload or drag and drop</span>
          <span className="text-[12px] font-sans text-[#111]/50 mt-1 block">HTML files only (.html)</span>
        </div>
      </div>

      {status === 'parsing' && (
        <div className="flex items-center gap-3 p-4 border border-[#2b4c7e]/20 bg-[#2b4c7e]/5 text-[#2b4c7e]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-[12px] font-sans uppercase tracking-widest font-bold">Extracting local DOM...</span>
        </div>
      )}

      {status === 'importing' && (
        <div className="flex items-center gap-3 p-4 border border-[#b85d19]/20 bg-[#b85d19]/5 text-[#b85d19]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-[12px] font-sans uppercase tracking-widest font-bold">AI extracting hook & saving...</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-1 p-4 border border-[#111]/30 bg-[#111]/5">
          <div className="flex items-center gap-2 text-[#111]">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-[12px] font-sans uppercase tracking-widest font-bold">Import Failed</span>
          </div>
          <p className="text-[13px] font-serif text-[#111]/80 ml-7">{errorMsg}</p>
          <button 
            onClick={() => setStatus('idle')}
            className="text-[11px] font-sans uppercase tracking-widest font-bold text-[#111] underline ml-7 mt-2 text-left"
          >
            Try Again
          </button>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col gap-1 p-4 border border-green-700/30 bg-green-700/5">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-[12px] font-sans uppercase tracking-widest font-bold">Successfully Imported</span>
          </div>
          <p className="text-[14px] font-serif text-green-900/80 ml-7 mt-1">
            <b>{importedTitle}</b> has been formatted and saved to your library.
          </p>
          <button 
            onClick={() => setStatus('idle')}
            className="text-[11px] font-sans uppercase tracking-widest font-bold text-green-800 underline ml-7 mt-3 text-left"
          >
            Import Another
          </button>
        </div>
      )}
    </div>
  );
}
