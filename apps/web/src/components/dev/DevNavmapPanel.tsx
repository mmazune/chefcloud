/**
 * Phase I3: Navmap Dev Panel
 * 
 * Developer panel for viewing and exporting navmap capture data.
 * Only visible when NEXT_PUBLIC_NAVMAP_MODE=1
 */

import { useState } from 'react';
import { 
  isNavmapEnabled, 
  getCapture, 
  downloadCapture, 
  exportCaptureJSON,
  exportCaptureMarkdown,
  clearCapture 
} from '@/lib/navmap';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Trash2, ChevronDown, ChevronUp, Map } from 'lucide-react';

export function DevNavmapPanel() {
  const [expanded, setExpanded] = useState(false);
  
  // Only render if navmap mode is enabled
  if (!isNavmapEnabled()) return null;
  
  const capture = getCapture();
  
  const handleDownload = () => {
    if (capture?.role) {
      downloadCapture(capture.role);
    }
  };
  
  const handleClear = () => {
    clearCapture();
    setExpanded(false);
  };
  
  const handleCopyJSON = () => {
    navigator.clipboard.writeText(exportCaptureJSON());
  };
  
  const handleCopyMD = () => {
    navigator.clipboard.writeText(exportCaptureMarkdown());
  };
  
  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Card className="bg-purple-950 text-white border-purple-700 shadow-xl max-w-sm">
        <div 
          className="flex items-center justify-between p-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-purple-300" />
            <span className="text-sm font-medium">Navmap Capture</span>
            {capture && (
              <span className="text-xs bg-purple-700 px-2 py-0.5 rounded">
                {capture.role}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </div>
        
        {expanded && capture && (
          <div className="p-3 pt-0 border-t border-purple-700 space-y-3">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-purple-900 rounded p-2">
                <div className="text-lg font-bold">{capture.routesVisited.length}</div>
                <div className="text-xs text-purple-300">Routes</div>
              </div>
              <div className="bg-purple-900 rounded p-2">
                <div className="text-lg font-bold">{capture.sidebarLinks.length}</div>
                <div className="text-xs text-purple-300">Links</div>
              </div>
              <div className="bg-purple-900 rounded p-2">
                <div className="text-lg font-bold">{capture.actions.length}</div>
                <div className="text-xs text-purple-300">Actions</div>
              </div>
            </div>
            
            {/* Routes visited */}
            <div>
              <div className="text-xs text-purple-300 mb-1">Routes visited:</div>
              <div className="text-xs bg-purple-900 rounded p-2 max-h-20 overflow-y-auto">
                {capture.routesVisited.length === 0 ? (
                  <span className="text-purple-400">None yet</span>
                ) : (
                  capture.routesVisited.map(r => (
                    <div key={r} className="text-purple-200">{r}</div>
                  ))
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 bg-purple-800 border-purple-600 hover:bg-purple-700"
                onClick={handleCopyJSON}
              >
                Copy JSON
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 bg-purple-800 border-purple-600 hover:bg-purple-700"
                onClick={handleCopyMD}
              >
                Copy MD
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleDownload}
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleClear}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        
        {expanded && !capture && (
          <div className="p-3 pt-0 border-t border-purple-700">
            <p className="text-xs text-purple-300">
              No capture data. Login as a role to start capturing.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
