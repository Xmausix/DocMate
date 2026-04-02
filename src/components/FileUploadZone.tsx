import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Plus } from "lucide-react";

interface FileUploadZoneProps {
  onFileAccepted: (file: File) => void;
  isLoading: boolean;
  compact?: boolean;
}

const FileUploadZone = ({ onFileAccepted, isLoading, compact }: FileUploadZoneProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) onFileAccepted(acceptedFiles[0]);
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: isLoading,
  });

  if (compact) {
    return (
      <div
        {...getRootProps()}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-all text-xs
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-surface-hover'}
          ${isLoading ? 'opacity-60 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        {isLoading ? (
          <div className="w-4 h-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        ) : (
          <Plus className="h-4 w-4 text-primary" />
        )}
        <span className="text-muted-foreground">{isLoading ? 'Processing...' : 'Add PDF'}</span>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`relative flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300
        ${isDragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/40 hover:bg-surface-hover'}
        ${isLoading ? 'opacity-60 pointer-events-none' : ''}
      `}
    >
      <input {...getInputProps()} />
      {isLoading ? (
        <>
          <div className="w-12 h-12 rounded-full border-3 border-primary/30 border-t-primary animate-spin mb-4" />
          <p className="text-sm font-medium text-foreground">Processing document...</p>
          <p className="text-xs text-muted-foreground mt-1">Extracting text and preparing chunks</p>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            {isDragActive ? <FileText className="h-8 w-8 text-primary" /> : <Upload className="h-8 w-8 text-primary" />}
          </div>
          <p className="text-base font-medium text-foreground mb-1">
            {isDragActive ? "Drop your PDF here" : "Drag & drop a PDF"}
          </p>
          <p className="text-sm text-muted-foreground">or click to browse your files</p>
          <span className="mt-3 text-xs text-muted-foreground/70 px-3 py-1 rounded-full bg-muted">PDF files only • Max 20MB</span>
        </>
      )}
    </div>
  );
};

export default FileUploadZone;
