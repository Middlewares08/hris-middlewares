import PropTypes from 'prop-types';
import DocumentListItem from './DocumentListItem';

/**
 * The employee's document library as a list of preview-able rows.
 * Mirrors the employee (PWA) end: click a row's name/icon to preview the file.
 */
function DocumentList({ documents = [], onDelete, canDelete = false, emptyLabel = 'No documents on file.' }) {
    if (!documents.length) {
        return (emptyLabel ? emptyLabel : <p className="text-sm text-slate-400">{emptyLabel}</p>)
    }

    return (
        <ul className="space-y-2 text-left">
            {documents.map((d) => (
                <DocumentListItem
                    key={d.id}
                    document={d}
                    onDelete={onDelete}
                    canDelete={canDelete}
                />
            ))}
        </ul>
    );
}

DocumentList.propTypes = {
    documents: PropTypes.array,
    onDelete: PropTypes.func,
    canDelete: PropTypes.bool,
    emptyLabel: PropTypes.node,
};

export default DocumentList;
