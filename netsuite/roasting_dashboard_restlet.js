/**
 * Roasting Dashboard RESTlet
 *
 * Loads a NetSuite saved search by internal ID and returns:
 *   - `columns`: array of column metadata in original order
 *   - `rows`:    array of arrays, one per result row, values aligned to columns
 *
 * The consumer can zip `columns` + each `rows[i]` to build whatever lookup
 * is convenient. Index-based rows avoid the label-collision problem with
 * formula columns that share generic default labels like "Formula (Numeric)".
 *
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/search', 'N/error', 'N/log'], (search, error, log) => {

    const PAGE_SIZE = 1000;

    const describeColumns = (columns) =>
        columns.map((col, index) => ({
            index: index,
            name: col.name || null,
            label: col.label || null,
            formula: col.formula || null,
            type: col.type || null,
            join: col.join || null,
            summary: col.summary || null,
            sortDir: col.sort || null,
        }));

    const runSearch = (savedSearchId) => {
        const loaded = search.load({ id: savedSearchId });
        const columns = loaded.columns;

        const rows = [];
        const paged = loaded.runPaged({ pageSize: PAGE_SIZE });

        paged.pageRanges.forEach((pageRange) => {
            const page = paged.fetch({ index: pageRange.index });
            page.data.forEach((result) => {
                const row = columns.map((col) => {
                    const value = result.getValue(col);
                    const text = result.getText(col);
                    return (text !== null && text !== '') ? text : value;
                });
                rows.push(row);
            });
        });

        return { columns: describeColumns(columns), rows: rows };
    };

    const get = (params) => {
        const savedSearchId = params && params.savedSearchId;
        if (!savedSearchId) {
            throw error.create({
                name: 'MISSING_PARAM',
                message: 'Query parameter "savedSearchId" is required.',
            });
        }

        try {
            const { columns, rows } = runSearch(savedSearchId);
            return {
                savedSearchId: String(savedSearchId),
                rowCount: rows.length,
                columns: columns,
                rows: rows,
            };
        } catch (e) {
            log.error({
                title: 'RESTlet failed loading saved search ' + savedSearchId,
                details: 'name=' + (e.name || '') +
                         ' | message=' + (e.message || '') +
                         ' | stack=' + (e.stack || ''),
            });
            return {
                error: true,
                savedSearchId: String(savedSearchId),
                errorName: e.name || null,
                errorMessage: e.message || String(e),
                errorStack: e.stack || null,
            };
        }
    };

    return { get };
});
