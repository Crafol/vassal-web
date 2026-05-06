/**
 * ZIP handling for .vmod files
 * .vmod files are ZIP archives containing build.xml and resources
 */
import AdmZip from 'adm-zip';
export class VassalArchive {
    zip;
    entries = new Map();
    constructor(filePathOrBuffer, fileName) {
        if (typeof filePathOrBuffer === 'string') {
            this.zip = new AdmZip(filePathOrBuffer);
        }
        else {
            // Browser File API - ArrayBuffer
            const buffer = filePathOrBuffer;
            this.zip = new AdmZip(Buffer.from(buffer));
        }
        this.loadEntries();
    }
    loadEntries() {
        const zipEntries = this.zip.getEntries();
        for (const entry of zipEntries) {
            this.entries.set(entry.entryName, entry);
        }
    }
    /**
     * List all files in the archive
     */
    listFiles() {
        const files = [];
        for (const [path, entry] of this.entries) {
            files.push({
                path,
                name: path.split('/').pop() || path,
                isDirectory: entry.isDirectory,
                size: entry.header.size,
            });
        }
        return files;
    }
    /**
     * Check if a file exists in the archive
     */
    hasFile(filePath) {
        return this.entries.has(filePath);
    }
    /**
     * Read a text file from the archive
     */
    readAsText(filePath) {
        const entry = this.entries.get(filePath);
        if (!entry) {
            return null;
        }
        return entry.getData().toString('utf8');
    }
    /**
     * Read a binary file from the archive as Buffer
     */
    readAsBuffer(filePath) {
        const entry = this.entries.get(filePath);
        if (!entry) {
            return null;
        }
        return entry.getData();
    }
    /**
     * Read an image file and return as base64 data URL
     */
    readAsImage(filePath) {
        const entry = this.entries.get(filePath);
        if (!entry) {
            return null;
        }
        const buffer = entry.getData();
        const extension = filePath.split('.').pop()?.toLowerCase() || 'png';
        const mimeType = this.getMimeType(extension);
        const base64 = buffer.toString('base64');
        return `data:${mimeType};base64,${base64}`;
    }
    /**
     * Get all image files from the archive
     */
    getImages() {
        const images = new Map();
        for (const [path, entry] of this.entries) {
            const ext = path.split('.').pop()?.toLowerCase();
            if (ext && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
                const base64 = entry.getData().toString('base64');
                const mimeType = this.getMimeType(ext);
                images.set(path, `data:${mimeType};base64,${base64}`);
            }
        }
        return images;
    }
    /**
     * Extract all resources (images, sounds) as a map
     */
    getResources() {
        const resources = new Map();
        for (const [path, entry] of this.entries) {
            if (!entry.isDirectory) {
                resources.set(path, entry.getData());
            }
        }
        return resources;
    }
    getMimeType(extension) {
        const mimeTypes = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            webp: 'image/webp',
            wav: 'audio/wav',
            au: 'audio/basic',
        };
        return mimeTypes[extension] || 'application/octet-stream';
    }
    /**
     * Get the buildFile.xml OR buildFile content
     */
    getBuildXml() {
        // Try buildFile.xml first, then buildFile
        return this.readAsText('buildFile.xml') || this.readAsText('buildFile');
    }
    /**
     * Get the vassal.info content
     */
    getVassalInfo() {
        return this.readAsText('vassal.info');
    }
}
//# sourceMappingURL=zip.js.map