/**
 * Preprocess markdown that may be stored as a single line.
 * If the text already contains newlines (properly formatted), return as-is.
 * Only preprocesses truly single-line text (no newlines).
 */
export function fixMarkdown(text: string): string {
    if (!text) return '';
    if (text.includes('\n')) return text;

    let result = text;
    result = result.replace(/(^|[^#])(#{1,6}\s)/g, '$1\n\n$2');

    const sepRegex = /\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|/g;
    let match;

    while ((match = sepRegex.exec(result)) !== null) {
        const sepStr = match[0];
        const sepIdx = match.index;
        const pipesPerRow = (sepStr.match(/\|/g) || []).length;

        let headerStart = sepIdx;
        let pipes = 0;
        for (let i = sepIdx - 1; i >= 0; i--) {
            if (result[i] === '|') pipes++;
            if (pipes === pipesPerRow) { headerStart = i; break; }
        }

        let dataEnd = sepIdx + sepStr.length;
        pipes = 0;
        let lastRowEnd = dataEnd;
        for (let i = dataEnd; i < result.length; i++) {
            if (result[i] === '|') pipes++;
            if (pipes === pipesPerRow) {
                lastRowEnd = i + 1;
                let hasMore = false;
                for (let j = i + 1; j < result.length; j++) {
                    if (result[j] === '|') { hasMore = true; break; }
                    if (result[j] === '#') break;
                    if (!/[ \t]/.test(result[j])) break;
                }
                if (!hasMore) break;
                pipes = 0;
            }
        }
        dataEnd = lastRowEnd;

        const tableText = result.substring(headerStart, dataEnd);
        const rows: string[] = [];
        let rowStart = 0;
        pipes = 0;
        for (let ci = 0; ci < tableText.length; ci++) {
            if (tableText[ci] === '|') pipes++;
            if (pipes === pipesPerRow) {
                rows.push(tableText.substring(rowStart, ci + 1).trim());
                rowStart = ci + 1;
                pipes = 0;
            }
        }

        const formatted = '\n' + rows.join('\n') + '\n';
        result = result.substring(0, headerStart) + formatted + result.substring(dataEnd);
        sepRegex.lastIndex = headerStart + formatted.length;
    }

    return result;
}
