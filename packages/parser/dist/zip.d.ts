/**
 * ZIP handling for .vmod files
 * .vmod files are ZIP archives containing build.xml and resources
 */
export interface VassalArchiveOptions {
    /** Path to the .vmod file */
    filePath?: string;
    /** ArrayBuffer (for browser File API) */
    buffer?: ArrayBuffer;
}
export interface ArchiveEntry {
    /** Relative path within the archive */
    path: string;
    /** Entry name (filename) */
    name: string;
    /** Is this entry a directory? */
    isDirectory: boolean;
    /** Entry size in bytes */
    size: number;
}
export declare class VassalArchive {
    private zip;
    private entries;
    constructor(filePath: string);
    constructor(buffer: ArrayBuffer, fileName?: string);
    private loadEntries;
    /**
     * List all files in the archive
     */
    listFiles(): ArchiveEntry[];
    /**
     * Check if a file exists in the archive
     */
    hasFile(filePath: string): boolean;
    /**
     * Read a text file from the archive
     */
    readAsText(filePath: string): string | null;
    /**
     * Read a binary file from the archive as Buffer
     */
    readAsBuffer(filePath: string): Buffer | null;
    /**
     * Read an image file and return as base64 data URL
     */
    readAsImage(filePath: string): string | null;
    /**
     * Get all image files from the archive
     */
    getImages(): Map<string, string>;
    /**
     * Extract all resources (images, sounds) as a map
     */
    getResources(): Map<string, Buffer>;
    private getMimeType;
    /**
     * Get the buildFile.xml OR buildFile content
     */
    getBuildXml(): string | null;
    /**
     * Get the vassal.info content
     */
    getVassalInfo(): string | null;
}
//# sourceMappingURL=zip.d.ts.map