import React from "react";

/**
 * LivePreviewPanel
 * 
 * Props:
 * - title?: string                // Optional panel title
 * - html?: string                 // HTML string to render in the preview
 * - isLoading?: boolean           // Show loading overlay when true
 * - error?: string | null         // Error message to show instead of preview
 * - onRefresh?: () => void        // Optional refresh button handler
 * - footerNote?: string           // Optional small note under the preview
 */
function LivePreviewPanel({
  title = "Live Preview",
  html = "",
  isLoading = false,
  error = null,
  onRefresh,
  footerNote,
}) {
  return (
    <div className="flex flex-col h-full rounded-2xl border border-zinc-800 bg-zinc-950/90 shadow-xl shadow-black/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
          <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
            {title}
          </h2>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs px-3 py-1.5 rounded-full border border-emerald-500/60 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 hover:border-emerald-400 transition-colors"
          >
            Refresh
          </button>
        )}
      </div>

      {/* Body / Preview Area */}
      <div className="relative flex-1 bg-zinc-950">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="h-8 w-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mb-3" />
            <p className="text-xs text-zinc-300 tracking-wide uppercase">
              Rendering Live Preview…
            </p>
          </div>
        )}

        {/* Error state */}
        {error ? (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 rounded-full bg-red-500/10 p-2 border border-red-500/40">
              <span className="text-red-400 text-lg font-semibold">!</span>
            </div>
            <p className="text-sm text-red-300 font-medium mb-1">
              Preview Error
            </p>
            <p className="text-xs text-red-200/80 max-w-md">
              {error}
            </p>
          </div>
        ) : (
          <div className="h-full overflow-auto bg-zinc-950">
            <div className="min-h-full w-full bg-zinc-950">
              {/* Actual preview – HTML string */}
              <div
                className="min-h-full w-full px-4 py-4 md:px-6 md:py-6 bg-zinc-950"
                dangerouslySetInnerHTML={{ __html: html || defaultEmptyState }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer note */}
      {footerNote && (
        <div className="px-4 py-2.5 border-t border-zinc-800/80 bg-zinc-900/70 text-[11px] text-zinc-400 flex items-center justify-between">
          <span>{footerNote}</span>
        </div>
      )}
    </div>
  );
}

const defaultEmptyState = `
  <div style="
    height: 100%;
    min-height: 260px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
    color: #d4d4d8;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
    background: radial-gradient(circle at top, rgba(74,222,128,0.12), transparent 55%);
  ">
    <div style="
      display: inline-flex;
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid rgba(161, 161, 170, 0.5);
      background: rgba(24, 24, 27, 0.95);
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #a1a1aa;
    ">
      Live Preview • Waiting for design
    </div>
    <div style="font-size: 13px; max-width: 320px; line-height: 1.6; color: #a1a1aa;">
      Trigger a design, layout, or section update on the left panel to see it rendered here in real time.
    </div>
  </div>
`;

export default LivePreviewPanel;
